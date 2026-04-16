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
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => bool) public pendingIsFinalReveal;

    // --- Events ---
    event ProjectCreated(uint256 indexed projectId, address indexed sponsoree, uint256 deadline);
    
    // Notice: We don't need to emit the encrypted amount here anymore, 
    // because NOX's ERC7984 contract emits its own confidential transfer events!
    event SponsorshipAdded(uint256 indexed projectId, address indexed sponsor, uint256 timestamp);
    
    event RevealRequested(uint256 indexed projectId, bool isFinalReveal);
    event LeaderboardUpdated(uint256 indexed projectId, string ipfsHash);

    modifier onlyOracle() {
        require(msg.sender == teeOracleAddress, "Only TEE Oracle can call this");
        _;
    }

    constructor(address _fundMeTokenAddress) Ownable(msg.sender) {
        fundMeToken = IERC7984(_fundMeTokenAddress);
        teeOracleAddress = msg.sender; 
    }

    function createProject(
        uint256 durationDays, 
        uint8 topKLimit, 
        string calldata reclaimProofId
    ) external returns (uint256) {
        require(durationDays > 0, "Duration must be > 0");
        require(topKLimit > 0, "Top K must be > 0");

        uint256 projectId = nextProjectId++;
        
        projects[projectId] = Project({
            sponsoree: msg.sender,
            deadline: block.timestamp + (durationDays * 1 days),
            topKLimit: topKLimit,
            reclaimProofId: reclaimProofId,
            isFinalized: false,
            lastRevealTimestamp: 0,
            leaderboardIPFSHashes: new string[](0)
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

        // 4. Execute the ERC7984 Confidential Transfer (Sponsor -> Sponsoree)
        fundMeToken.confidentialTransferFrom(msg.sender, proj.sponsoree, amount);

        // 5. Emit event for off-chain indexing
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
            require(block.timestamp >= proj.lastRevealTimestamp + leaderboardCooldown, "Cooldown active");
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

    function getLeaderboardHistory(uint256 projectId) external view returns (string[] memory) {
        return projects[projectId].leaderboardIPFSHashes;
    }

    function setLeaderboardCooldown(uint256 newCooldownSeconds) external onlyOwner {
        leaderboardCooldown = newCooldownSeconds;
    }

    function setTeeOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid address");
        teeOracleAddress = _newOracle;
    }
}