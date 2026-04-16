// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IFundMeToken {
    function confidentialTransfer(address to, bytes32 encryptedAmount) external;
}

contract FundMePlatform is Ownable {
    
    IFundMeToken public fundMeToken;
    address public teeOracleAddress; // The address of the iExec TEE worker

    // --- State Variables ---
    uint256 public leaderboardCooldown = 12 hours; // Modifiable for Demo Mode
    uint256 public nextProjectId;

    struct Project {
        address sponsoree;
        uint256 deadline;
        uint8 topKLimit;
        string reclaimProofId;
        bool isFinalized;
        uint256 lastRevealTimestamp;
        string[] leaderboardIPFSHashes; // History of IPFS JSON files
    }

    mapping(uint256 => Project) public projects;
    
    // Tracks if a pending TEE request is the final reveal
    mapping(uint256 => bool) public pendingIsFinalReveal;

    // --- Events ---
    event ProjectCreated(uint256 indexed projectId, address indexed sponsoree, uint256 deadline);
    
    event SponsorshipAdded(
        uint256 indexed projectId, 
        address indexed sponsor, 
        bytes32 encryptedAmount, 
        uint256 timestamp
    );
    
    event RevealRequested(uint256 indexed projectId, bool isFinalReveal);
    event LeaderboardUpdated(uint256 indexed projectId, string ipfsHash);

    // --- Modifiers ---
    modifier onlyOracle() {
        require(msg.sender == teeOracleAddress, "Only TEE Oracle can call this");
        _;
    }

    constructor(address _fundMeTokenAddress) Ownable(msg.sender) {
        fundMeToken = IFundMeToken(_fundMeTokenAddress);
        // By default, set the deployer as the Oracle so you can manually test it
        teeOracleAddress = msg.sender; 
    }

    // --- Phase 1: Setup ---
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

    // --- Phase 2: Funding ---
    function sponsorProject(uint256 projectId, bytes32 encryptedAmount) external {
        Project storage proj = projects[projectId];
        require(block.timestamp < proj.deadline, "Funding campaign has ended");

        // Execute the confidential transfer via the token contract
        fundMeToken.confidentialTransfer(proj.sponsoree, encryptedAmount);

        // Emit the event so the iExec TEE knows to aggregate this later
        emit SponsorshipAdded(projectId, msg.sender, encryptedAmount, block.timestamp);
    }

    // --- Phase 3: Reveal Requests ---
    function requestLeaderboardRefresh(uint256 projectId, bool isFinalReveal) external payable {
        Project storage proj = projects[projectId];
        require(msg.sender == proj.sponsoree, "Only sponsoree can refresh");
        
        if (isFinalReveal) {
            require(block.timestamp >= proj.deadline, "Campaign not ended yet");
            require(!proj.isFinalized, "Project already finalized");
        } else {
            require(block.timestamp < proj.deadline, "Campaign has ended, use final reveal");
            require(
                block.timestamp >= proj.lastRevealTimestamp + leaderboardCooldown, 
                "Cooldown period active"
            );
        }

        // Mark what type of reveal the TEE should process
        pendingIsFinalReveal[projectId] = isFinalReveal;
        
        // Update the timestamp to reset the cooldown
        proj.lastRevealTimestamp = block.timestamp;

        // Emit event to wake up the iExec TEE Enclave
        emit RevealRequested(projectId, isFinalReveal);
    }

    // --- Phase 4: TEE Callbacks (IPFS Upload) ---
    function fulfillLeaderboard(uint256 projectId, string calldata ipfsHash) external onlyOracle {
        Project storage proj = projects[projectId];
        
        // Add the new IPFS hash to the project's history
        proj.leaderboardIPFSHashes.push(ipfsHash);

        // If this was the final reveal, lock the project so funds can be unshielded
        if (pendingIsFinalReveal[projectId]) {
            proj.isFinalized = true;
        }

        emit LeaderboardUpdated(projectId, ipfsHash);
    }

    // --- Helper Functions ---
    function getLeaderboardHistory(uint256 projectId) external view returns (string[] memory) {
        return projects[projectId].leaderboardIPFSHashes;
    }

    // --- Admin (Demo Mode) ---
    function setLeaderboardCooldown(uint256 newCooldownSeconds) external onlyOwner {
        leaderboardCooldown = newCooldownSeconds;
    }

    function setTeeOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid address");
        teeOracleAddress = _newOracle;
    }
}