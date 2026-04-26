// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";

contract FundMePlatform is Ownable {
    
    IERC7984 public fundMeToken;
    address public teeOracleAddress; 

    uint256 public leaderboardCooldown = 12 hours;
    uint256 public nextProjectId;

    struct Project {
        address sponsoree;
        uint256 deadline;
        uint8 topKLimit;
        string reclaimProofId;
        bool isFinalized;
        uint256 lastRevealTimestamp;
        string[] leaderboardIPFSHashes;
        string title;
        string description;
        bool isAuction;              // If true, only the top-1 sponsor wins; others get refunds.
        uint256 minBidAmount;        // Auction mode: minimum contribution required to qualify (in token units, 0 = no minimum).
        uint256 leaderboardCooldown; // Per-project cooldown between leaderboard refreshes (minimum 1 hour).
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => bool) public pendingIsFinalReveal;

    // Encrypted per-project contribution per sponsor, accumulated across multiple sponsorships.
    mapping(uint256 => mapping(address => euint256)) private _contributions;

    // Encrypted escrow balance per project (held by this contract until campaign ends).
    mapping(uint256 => euint256) private _projectEscrow;

    // Whether a project's escrowed funds have already been withdrawn by the sponsoree.
    mapping(uint256 => bool) public projectWithdrawn;

    // Auction mode: address of the winning sponsor (set by oracle after final reveal).
    mapping(uint256 => address) public auctionWinner;

    // Tracks whether a sponsor is in the top-K list (set by oracle after final reveal).
    mapping(uint256 => mapping(address => bool)) public isTopKSponsor;

    // List of top-K sponsor addresses for each project.
    mapping(uint256 => address[]) private _topKSponsorsList;

    // Whether the top-K sponsors have been set by the oracle.
    mapping(uint256 => bool) public topKSponsorsSet;

    // Tracks whether a non-top-K sponsor has already claimed their refund.
    mapping(uint256 => mapping(address => bool)) private _refundClaimed;

    // --- Events ---
    event ProjectCreated(uint256 indexed projectId, address indexed sponsoree, uint256 deadline);
    
    // Notice: We don't need to emit the encrypted amount here anymore, 
    // because NOX's ERC7984 contract emits its own confidential transfer events!
    event SponsorshipAdded(uint256 indexed projectId, address indexed sponsor, uint256 timestamp);
    
    event RevealRequested(uint256 indexed projectId, bool isFinalReveal);
    event LeaderboardUpdated(uint256 indexed projectId, string ipfsHash);
    event FundsWithdrawn(uint256 indexed projectId, address indexed sponsoree);
    event AuctionWinnerSet(uint256 indexed projectId, address indexed winner);
    event TopKSponsorsSet(uint256 indexed projectId, address[] winners);
    event RefundClaimed(uint256 indexed projectId, address indexed sponsor);

    modifier onlyOracle() {
        require(msg.sender == teeOracleAddress, "Only TEE Oracle can call this");
        _;
    }

    constructor(address _fundMeTokenAddress) Ownable(msg.sender) {
        fundMeToken = IERC7984(_fundMeTokenAddress);
        teeOracleAddress = msg.sender; 
    }

    function createProject(
        uint256 durationMinutes,
        uint8 topKLimit,
        string calldata reclaimProofId,
        string calldata title,
        string calldata description,
        bool isAuction,
        uint256 minBidAmount,
        uint256 cooldownSeconds
    ) external returns (uint256) {
        require(durationMinutes > 0, "Duration must be > 0");
        require(topKLimit > 0, "Top K must be > 0");
        require(cooldownSeconds >= 1 minutes, "Cooldown must be at least 1 minute");
        if (isAuction) {
            require(topKLimit == 1, "Auction mode requires topKLimit = 1");
        }

        uint256 projectId = nextProjectId++;

        projects[projectId] = Project({
            sponsoree: msg.sender,
            deadline: block.timestamp + (durationMinutes * 1 minutes),
            topKLimit: topKLimit,
            reclaimProofId: reclaimProofId,
            isFinalized: false,
            lastRevealTimestamp: 0,
            leaderboardIPFSHashes: new string[](0),
            title: title,
            description: description,
            isAuction: isAuction,
            minBidAmount: isAuction ? minBidAmount : 0,
            leaderboardCooldown: cooldownSeconds
        });

        emit ProjectCreated(projectId, msg.sender, projects[projectId].deadline);
        return projectId;
    }

    /**
     * @notice Sponsor a project using official NOX Encrypted types
     * @dev The Caller must first call `fundMeToken.setOperator(address(this), timestamp)`
     */
    function sponsorProject(
        uint256 projectId, 
        externalEuint256 encryptedAmount, 
        bytes calldata inputProof
    ) external {
        Project storage proj = projects[projectId];
        require(block.timestamp < proj.deadline, "Funding campaign has ended");

        // 1. Verify the Sponsor has authorized this platform to move their encrypted funds
        require(fundMeToken.isOperator(msg.sender, address(this)), "Platform is not an operator");

        // 2. Convert external encrypted bytes into internal NOX type
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);

        // 3. Temporarily allow the token contract to manipulate this encrypted value
        Nox.allowTransient(amount, address(fundMeToken));

        // 4. Execute the ERC7984 Confidential Transfer (Sponsor -> Contract escrow).
        //    Funds are held here until the campaign deadline passes; the sponsoree
        //    must call withdrawProjectFunds() after the deadline to claim them.
        fundMeToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // 5. Accumulate the sponsor's contribution for this project so the TEE oracle
        //    can decrypt and rank by actual amount contributed (not wallet balance).
        //
        //    Two subtleties:
        //    a) The zero handle (uninitialized euint256) is not a valid FHE operand, so
        //       we assign directly on the first contribution instead of calling Nox.add.
        //    b) After each write we must Nox.allow address(this) so that future
        //       transactions can supply the stored handle as an operand to Nox.add.
        //       Without this the contract loses ACL access after the first tx and
        //       Nox.add silently ignores the accumulated value, ranking only the
        //       most-recent fee instead of the cumulative total.
        euint256 existing = _contributions[projectId][msg.sender];
        if (euint256.unwrap(existing) == bytes32(0)) {
            _contributions[projectId][msg.sender] = amount;
        } else {
            _contributions[projectId][msg.sender] = Nox.add(existing, amount);
        }
        // Retain contract-level ACL so future sponsorships can accumulate correctly.
        Nox.allow(_contributions[projectId][msg.sender], address(this));
        // Grant the TEE oracle ACL read access to this sponsor's contribution handle.
        Nox.allow(_contributions[projectId][msg.sender], teeOracleAddress);
        // Grant the sponsor ACL access so they can reencrypt and reveal their own contribution.
        Nox.allow(_contributions[projectId][msg.sender], msg.sender);

        // 6. Accumulate into per-project escrow (mirrors contribution logic).
        euint256 existingEscrow = _projectEscrow[projectId];
        if (euint256.unwrap(existingEscrow) == bytes32(0)) {
            _projectEscrow[projectId] = amount;
        } else {
            _projectEscrow[projectId] = Nox.add(existingEscrow, amount);
        }
        Nox.allow(_projectEscrow[projectId], address(this));

        // 7. Emit event for off-chain indexing
        emit SponsorshipAdded(projectId, msg.sender, block.timestamp);
    }

    function requestLeaderboardRefresh(uint256 projectId, bool isFinalReveal) external payable {
        Project storage proj = projects[projectId];
        require(msg.sender == proj.sponsoree, "Only sponsoree can refresh");
        
        if (isFinalReveal) {
            require(block.timestamp >= proj.deadline, "Campaign not ended yet");
            require(!proj.isFinalized, "Project already finalized");
        } else {
            require(block.timestamp < proj.deadline, "Campaign has ended, use final reveal");
            require(block.timestamp >= proj.lastRevealTimestamp + proj.leaderboardCooldown, "Cooldown active");
        }

        pendingIsFinalReveal[projectId] = isFinalReveal;
        proj.lastRevealTimestamp = block.timestamp;

        emit RevealRequested(projectId, isFinalReveal);
    }

    function fulfillLeaderboard(uint256 projectId, string calldata ipfsHash) external onlyOracle {
        Project storage proj = projects[projectId];
        proj.leaderboardIPFSHashes.push(ipfsHash);

        if (pendingIsFinalReveal[projectId]) {
            proj.isFinalized = true;
        }

        emit LeaderboardUpdated(projectId, ipfsHash);
    }

    /**
     * @notice Withdraw all escrowed funds for a campaign after its deadline has passed.
     * @dev Funds from active campaigns are locked; only the sponsoree of a finished campaign
     *      may call this, and only once. The withdrawn amount is the total sponsored
     *      by the top-K sponsors, as determined by the oracle.
     */
    function withdrawProjectFunds(uint256 projectId) external {
        Project storage proj = projects[projectId];
        require(msg.sender == proj.sponsoree, "Only sponsoree can withdraw");
        require(block.timestamp >= proj.deadline, "Campaign still active: funds are locked until deadline");
        require(!projectWithdrawn[projectId], "Funds already withdrawn for this project");
        require(topKSponsorsSet[projectId], "Top-K sponsors not set by oracle yet");

        address[] storage winners = _topKSponsorsList[projectId];
        require(winners.length > 0, "No winning sponsors found");

        euint256 totalToWithdraw;
        for (uint256 i = 0; i < winners.length; i++) {
            euint256 contrib = _contributions[projectId][winners[i]];
            if (euint256.unwrap(contrib) != bytes32(0)) {
                if (euint256.unwrap(totalToWithdraw) == bytes32(0)) {
                    totalToWithdraw = contrib;
                } else {
                    totalToWithdraw = Nox.add(totalToWithdraw, contrib);
                }
            }
        }

        require(euint256.unwrap(totalToWithdraw) != bytes32(0), "No funds to withdraw");
        projectWithdrawn[projectId] = true;
        Nox.allowTransient(totalToWithdraw, address(fundMeToken));
        fundMeToken.confidentialTransfer(proj.sponsoree, totalToWithdraw);

        emit FundsWithdrawn(projectId, proj.sponsoree);
    }

    /**
     * @notice Called by the oracle after final reveal to set the top-K winning sponsors.
     * @dev Must be called after fulfillLeaderboard (which sets isFinalized = true).
     */
    function setTopKSponsors(uint256 projectId, address[] memory winners) public onlyOracle {
        Project storage proj = projects[projectId];
        require(proj.isFinalized, "Project must be finalized first");
        require(!topKSponsorsSet[projectId], "Winners already set");
        require(winners.length > 0, "At least one winner required");
        require(winners.length <= proj.topKLimit, "Exceeds top-K limit");

        for (uint256 i = 0; i < winners.length; i++) {
            require(winners[i] != address(0), "Invalid winner address");
            isTopKSponsor[projectId][winners[i]] = true;
            _topKSponsorsList[projectId].push(winners[i]);
        }

        topKSponsorsSet[projectId] = true;

        // Backward compatibility for auction mode
        if (proj.isAuction) {
            auctionWinner[projectId] = winners[0];
            emit AuctionWinnerSet(projectId, winners[0]);
        }

        emit TopKSponsorsSet(projectId, winners);
    }

    /**
     * @notice Called by the oracle after final reveal of an auction project to set the winner.
     * @dev Deprecated: use setTopKSponsors instead.
     */
    function setAuctionWinner(uint256 projectId, address winner) external onlyOracle {
        address[] memory winners = new address[](1);
        winners[0] = winner;
        setTopKSponsors(projectId, winners);
    }

    /**
     * @notice Allows a non-winning (non-top-K) sponsor to reclaim their contribution.
     * @dev Only callable after the project is finalized and the winners have been set by the oracle.
     */
    function claimRefund(uint256 projectId) public {
        Project storage proj = projects[projectId];
        require(proj.isFinalized, "Project not finalized yet");
        require(topKSponsorsSet[projectId], "Winners not set yet");
        require(!isTopKSponsor[projectId][msg.sender], "Top-K sponsors cannot claim refund");
        require(!_refundClaimed[projectId][msg.sender], "Refund already claimed");
        
        euint256 contrib = _contributions[projectId][msg.sender];
        require(euint256.unwrap(contrib) != bytes32(0), "No contribution to refund");
        
        _refundClaimed[projectId][msg.sender] = true;
        Nox.allowTransient(contrib, address(fundMeToken));
        fundMeToken.confidentialTransfer(msg.sender, contrib);
        
        emit RefundClaimed(projectId, msg.sender);
    }

    /**
     * @notice Deprecated: use claimRefund instead.
     */
    function claimAuctionRefund(uint256 projectId) external {
        claimRefund(projectId);
    }

    function getAuctionWinner(uint256 projectId) external view returns (address) {
        return auctionWinner[projectId];
    }

    function hasClaimedRefund(uint256 projectId, address sponsor) external view returns (bool) {
        return _refundClaimed[projectId][sponsor];
    }

    function hasClaimedAuctionRefund(uint256 projectId, address sponsor) external view returns (bool) {
        return _refundClaimed[projectId][sponsor];
    }

    function getTopKSponsors(uint256 projectId) external view returns (address[] memory) {
        return _topKSponsorsList[projectId];
    }

    function getLeaderboardHistory(uint256 projectId) external view returns (string[] memory) {
        return projects[projectId].leaderboardIPFSHashes;
    }

    /// @notice Returns the encrypted contribution handle for a sponsor on a given project.
    ///         Only the TEE oracle (granted via Nox.allow) can decrypt this in the TEE.
    function getContributionHandle(uint256 projectId, address sponsor) external view returns (bytes32) {
        return euint256.unwrap(_contributions[projectId][sponsor]);
    }

    function setLeaderboardCooldown(uint256 newCooldownSeconds) external onlyOwner {
        leaderboardCooldown = newCooldownSeconds;
    }

    function setTeeOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid address");
        teeOracleAddress = _newOracle;
    }
}