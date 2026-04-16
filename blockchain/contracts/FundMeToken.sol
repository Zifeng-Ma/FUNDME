// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";

/**
 * @title FundMeToken
 * @dev Official NOX ERC20 -> ERC7984 Confidential Wrapper
 */
contract FundMeToken is ERC20ToERC7984Wrapper {
    
    // The wrapper automatically handles encrypted balances, wrap(), and unwrap()
    constructor(IERC20 usdc)
        ERC20ToERC7984Wrapper(usdc)
        ERC7984("Confidential FUNDME", "FUNDME", "")
    {}

}