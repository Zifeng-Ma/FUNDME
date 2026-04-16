1. Project Overview & Status
FUNDME is a confidential crowdfunding platform that has just been upgraded to be fully compliant with the official iExec NOX Protocol and its @iexec-nox/nox-confidential-contracts SDK. The project's core mission is to enable "Blind Funding"—where sponsorship amounts remain encrypted on-chain—using the hardware-enforced privacy of Trusted Execution Environments (TEEs) as specified by the ERC-7984 Confidential Token Standard.

Current Status: The smart contract architecture phase is complete. The contracts have been re-written to inherit directly from the official ERC20ToERC7984Wrapper and utilize NOX's euint256 encrypted data types. The local deployment and verification scripts from the previous (mocked) version are now outdated and need to be updated to reflect the new, official NOX-compliant user flow.

2. Core Technical Mechanics (The New User Flow)
The integration of the official NOX SDK fundamentally changes the user interaction flow. The key changes are the "Operator Model" for permissions and the "Two-Step Unwrap" for withdrawals.

Shielding (Wrap - One Step):

User calls usdc.approve(fundMeTokenAddress, amount).

User calls fundMeToken.wrap(userAddress, amount).
This locks the USDC and mints an equivalent amount of encrypted $FUNDME tokens to the user in a single, efficient transaction.

Sponsoring a Project (The Operator Model):

Grant Permission: The Sponsor must first authorize the FundMePlatform contract to manage their encrypted funds by calling fundMeToken.setOperator(platformAddress, future_timestamp). This gives the platform temporary permission.

Encrypt Amount: The frontend, using the iExec NOX JS SDK, encrypts the desired sponsorship amount.

Sponsor: The user calls fundMePlatform.sponsorProject(projectId, encryptedAmount, inputProof). The platform contract then securely calls fundMeToken.confidentialTransferFrom on the user's behalf.

Unshielding (Unwrap - Two Steps):

Request Unwrap: The Sponsoree calls fundMeToken.unwrap(from, to, encryptedAmount, proof). This burns their encrypted $FUNDME tokens and returns a unique unwrapRequestId.

Off-Chain Decryption: The iExec NOX network detects the burn event and decrypts the amount inside a TEE.

Finalize Unwrap: The Sponsoree (or a relayer) calls fundMeToken.finalizeUnwrap(unwrapRequestId, decryptedAmountAndProof). The contract verifies the TEE's proof and releases the corresponding plaintext USDC.

Leaderboard Reveals: The logic remains the same: the Sponsoree triggers a TEE job that processes encrypted balances, sorts them, uploads a JSON file to IPFS, and returns only the IPFS hash to the blockchain.

3. Technical Stack
Smart Contracts: Solidity ^0.8.28 (Required by NOX SDK)

Toolchain: Hardhat v3 with @nomicfoundation/hardhat-viem and Hardhat Ignition.

Blockchain Library: Viem

Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS

Web3 Hooks: Wagmi v2, TanStack Query, RainbowKit

Confidential Layer: @iexec-nox/nox-confidential-contracts

4. Immediate Next Steps for the AI Assistant
Re-Compile & Re-Deploy:

Ensure hardhat.config.ts uses Solidity 0.8.28.

Run npx hardhat clean && npx hardhat compile.

Update the Ignition deployment module (ignition/modules/FundMe.ts) to reflect the new FundMeToken constructor (it only takes the mockUSDC address now).

Re-deploy to a fresh local Hardhat node.

Rewrite the Verification Script (scripts/verify-happy-path.ts):

This script is the highest priority. It must be updated to simulate the new user flow:

Sponsor approves USDC and wraps it.

Sponsor calls setOperator on FundMeToken to approve the FundMePlatform.

Sponsor calls sponsorProject (using a mocked encryptedAmount and inputProof).

Begin Frontend Integration: Once the backend is re-verified, proceed with building the web-app. The UI components must be designed to handle the multi-step transactions (approve/wrap, setOperator/sponsor, unwrap/finalizeUnwrap) gracefully.