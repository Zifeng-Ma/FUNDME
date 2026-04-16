// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        // Mint 1 million Mock USDC to the deployer for testing
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}