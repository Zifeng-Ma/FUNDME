1. Project Overview
FUNDME is a confidential crowdfunding platform built on the iExec NOX Protocol. It allows for "Blind Funding" where sponsorship amounts remain encrypted on-chain using the ERC-7984 standard.

Core Mechanics:
$FUNDME Token: A confidential wrapper for USDC. Users "Shield" USDC to get $FUNDME and "Unshield" to get USDC back.

Privacy-First Leaderboard: Sponsorees can trigger a Trusted Execution Environment (TEE) via iExec to reveal the rank (addresses only) of Top K sponsors without ever revealing the specific amounts.

Game Theory: A 12-hour cooldown on rank reveals prevents "incremental probing" attacks.

Economic Security: A 2% platform fee is taken upon Unshielding (withdrawal) to prevent wash-sponsoring.

Verifiable Identity: Sponsorees prove project ownership via Reclaim Protocol (zk-proofs of GitHub/Socials).

Gas Efficiency: All reveal data (rankings/history) is stored on IPFS, with only the CID hashes stored on-chain.

2. Technical Stack
Smart Contracts: Solidity 0.8.24

Toolchain: Hardhat v3 (using Hardhat Ignition for deployment)

Blockchain Library: Viem (Lean Ethers alternative, used in Hardhat via @nomicfoundation/hardhat-viem)

Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS

Web3 Hooks: Wagmi v2, TanStack Query, RainbowKit

Confidential Layer: iExec NOX (ERC-7984 / TEE Enclaves)

3. Current Development Status
The Backend/Smart Contract phase is complete and verified.

Contracts Developed:

MockUSDC.sol: Standard ERC20 for local testing.

FundMeToken.sol: The Shield/Unshield logic and confidential transfer events.

FundMePlatform.sol: Campaign management, TEE reveal triggers, and IPFS hash storage.

Deployment: Successfully deployed to a local Hardhat node using Hardhat Ignition.

Verification: A "Happy Path" script using Viem has successfully simulated:

Minting Mock USDC.

Approving and Shielding into $FUNDME.

Creating a Project (ID: 0).

Sponsoring a project with a bytes32 encrypted handle.

4. Deployed Contract Addresses (Localhost)
MockUSDC: 0x5FbDB2315678afecb367f032d93F642f64180aa3

FundMeToken: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

FundMePlatform: 0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0

5. Environment Config (hardhat.config.ts)
code
TypeScript

download

content_copy

expand_less
import hardhatViem from "@nomicfoundation/hardhat-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatViem],
  solidity: {
    profiles: {
      default: { version: "0.8.24" },
      production: {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 } }
      },
    },
  },
  networks: {
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    hardhatOp: { type: "edr-simulated", chainType: "op" },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    }
  },
});
6. Immediate Next Steps for the AI Assistant
Frontend Setup: Initialize the Next.js web-app directory.

Contract Integration:

Export ABIs from /blockchain/artifacts.

Configure wagmi with the local Hardhat chain.

UI Components:

Create a Shield/Unshield Dashboard.

Build the Project Creation Form (including Reclaim Protocol verification).

Develop the Project Discovery Feed and Project Detail Page with the "Blind" sponsorship input.

iExec Integration: Prepare the logic for encrypting sponsorship amounts using the iExec NOX SDK before sending transactions to sponsorProject.

Instruction to the next AI: Use the provided contract addresses and Viem-based logic to build out the React/Wagmi frontend. Ensure all data-heavy operations (like leaderboard history) are fetched from IPFS using the hashes stored in the FundMePlatform contract.

Useful links:
iExec Nox Starter Repo (Reference Architecture): https://github.com/iExec-Nox
iExec Nox Getting Started / Hello World:https://docs.iex.ec/nox-protocol/getting-started/hello-world
iExec Official Docs: https://docs.iex.ec/
Hardhat Documentation:https://hardhat.org/docs
Wagmi v2 Hooks Docs:https://wagmi.sh/react/getting-started
Viem Docs (Blockchain Interactions):https://viem.sh/