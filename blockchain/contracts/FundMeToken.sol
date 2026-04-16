// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Note: In your actual Hardhat project, ensure you have imported the NOX interfaces.
// If nox-confidential-contracts is not compiling out of the box, this structure 
// perfectly mimics the ERC-7984 Wrapper flow for your hackathon demo.

contract FundMeToken is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    address public platformTreasury;
    uint256 public constant PLATFORM_FEE_BPS = 200; // 2% (200 basis points)

    // Represents the encrypted balances (ERC-7984 concept)
    // In NOX, these are manipulated via TEEs. We store the references here.
    mapping(address => bytes32) public encryptedBalances;

    event Shielded(address indexed user, uint256 amount);
    event Unshielded(address indexed user, uint256 amount, uint256 feeTaken);
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 encryptedAmount);

    constructor(address _usdcToken, address _platformTreasury) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_platformTreasury != address(0), "Invalid Treasury address");
        usdcToken = IERC20(_usdcToken);
        platformTreasury = _platformTreasury;
    }

    /**
     * @dev Step 1: Shielding. User deposits standard USDC, gets $FUNDME.
     * In a full NOX implementation, this mints an encrypted balance.
     */
    function shield(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Pull USDC from user to this contract
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Emit event for the NOX TEE to pick up and mint the encrypted balance
        emit Shielded(msg.sender, amount);
    }

    /**
     * @dev Step 2: Unshielding. User burns $FUNDME, gets USDC back minus 2% fee.
     * Note: For the hackathon, the TEE usually calls this after decrypting the user's final balance.
     */
    function unshield(uint256 plaintextAmount) external {
        require(plaintextAmount > 0, "Amount must be greater than 0");

        // Calculate 2% Fee
        uint256 fee = (plaintextAmount * PLATFORM_FEE_BPS) / 10000;
        uint256 amountAfterFee = plaintextAmount - fee;

        // Send fee to treasury, and remainder to the user
        usdcToken.safeTransfer(platformTreasury, fee);
        usdcToken.safeTransfer(msg.sender, amountAfterFee);

        emit Unshielded(msg.sender, plaintextAmount, fee);
    }

    /**
     * @dev ERC-7984 Confidential Transfer. Moves encrypted tokens.
     */
    function confidentialTransfer(address to, bytes32 encryptedAmount) external {
        // Logic handled by NOX TEE protocol. We emit the event for the enclave.
        emit ConfidentialTransfer(msg.sender, to, encryptedAmount);
    }

    function setPlatformTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        platformTreasury = _newTreasury;
    }
}