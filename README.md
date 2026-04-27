# FUNDME — Confidential Crowdfunding on Blockchain

> The first crowdfunding platform where your contributions remain 100% private. Support creators, climb the leaderboard, and protect your financial data.

![Landing Page](images/0.png)

---

## Overview

FUNDME is a confidential crowdfunding platform built on **Arbitrum Sepolia**. Contribution amounts are encrypted on-chain using [iExec NOX](https://docs.iex.ec/) (Fully Homomorphic Encryption), so no one — not even the contract — can see how much you contributed. Rankings are computed off-chain inside a **Trusted Execution Environment (TEE)** oracle, then published to IPFS for permanent, verifiable history.

**Two campaign modes:**
- **Standard** — Top-K sponsors win; creator collects their pooled contributions.
- **Auction** — Highest single bidder wins; all others receive automatic refunds.

---

## Architecture

```
┌──────────────┐     sponsor / create       ┌──────────────────────┐
│   Web App    │ ──────────────────────── ▶ │  FundMePlatform.sol  │
│  (Next.js)   │ ◀ ───────────────────────  │  FundMeToken.sol     │
└──────────────┘     read state / events    │  (Arbitrum Sepolia)  │
                                            └──────────┬───────────┘
                                                       │ RevealRequested event
                                            ┌──────────▼───────────┐
                                            │   TEE Oracle (NOX)   │
                                            │  decrypt → rank →    │
                                            │  pin IPFS → fulfill  │
                                            └──────────────────────┘
```

| Layer | Stack |
|---|---|
| Smart Contracts | Solidity 0.8.28 · Hardhat · OpenZeppelin · iExec NOX (ERC-7984) |
| Oracle | Node.js · TypeScript · Viem · iExec NOX Handle Client · Pinata IPFS |
| Frontend | Next.js 16 · React 19 · Wagmi v2 · RainbowKit v2 · Tailwind CSS v4 · Framer Motion |
| Identity | Reclaim Protocol (Twitter/X proof) |

---

## Features

### Confidential Contributions
Sponsor amounts are encrypted with FHE before hitting the chain. Only the TEE oracle can decrypt them — contribution sizes are never exposed publicly.

### Live Leaderboards via TEE
![Campaign Detail](images/7.png)

Creators can request a leaderboard refresh at any time (subject to a configurable cooldown). The oracle decrypts all contributions inside a secure enclave, ranks sponsors, and pins the result to IPFS. Intermediate snapshots build an immutable revision history.

### Explore & Browse Campaigns
![Explore Campaigns](images/3.png)

Browse all active and finalized campaigns on Arbitrum Sepolia. Each card shows campaign mode, top-K slots, deadline, and current reveal status.

### Launch a Campaign
![Create Campaign — Standard Mode](images/6.png)
![Create Campaign — Auction Mode](images/4.png)

Configure your campaign:
- **Title & description**
- **Mode** — Standard (top-K) or Auction (winner-takes-all)
- **Minimum bid** (auction mode only)
- **Duration** (minutes)
- **Leaderboard refresh cooldown** (min 1 minute)
- **Top-K sponsors**
- **Optional Twitter/X identity verification** via Reclaim Protocol

### Verified Creator Identity
![Organizer Portal](images/2.png)

Use Reclaim Protocol zero-knowledge proofs to verify your Twitter/X account without exposing credentials. Verified creators display a badge, building trust with backers.

### Dashboard
![Dashboard](images/8.png)

Track your active campaigns and sponsored projects in one place. Wrap/unwrap USDC to confidential FUNDME tokens and monitor deadlines and reveal status.

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| `FundMePlatform` | `0xD74cC75D381d607f49Bb0D647f8f719E185EeF3A` |
| `FundMeToken` | `0x6D15F83cbCcCF396CB84E21805d54473864a67B9` |
| `USDC (testnet)` | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

---

## Getting Started

### Prerequisites
- Node.js 20+
- An Arbitrum Sepolia RPC URL
- Testnet USDC (faucet or bridge)

### 1. Blockchain

```bash
cd blockchain
cp .env.example .env   # fill in PRIVATE_KEY_DEPLOYER, ARBITRUM_SEPOLIA_RPC_URL
npm install
npx hardhat ignition deploy ignition/modules/FundMe.ts --network arbitrumSepolia
```

### 2. Oracle

```bash
cd oracle
cp .env.example .env   # fill in PRIVATE_KEY_ORACLE, RPC_URL, PINATA_JWT
npm install
npm start
```

The oracle replays missed `RevealRequested` events on startup (controlled by `STARTUP_LOOKBACK_BLOCKS`).

### 3. Web App

```bash
cd web-app
cp .env.example .env   # fill in contract addresses and Reclaim credentials
npm install
npm run dev            # http://localhost:3000
```

---

## How It Works

1. **Sponsor wraps USDC** into encrypted `FundMeToken` and sets `FundMePlatform` as operator.
2. **Sponsor calls `sponsorProject()`** with an encrypted contribution amount. The contract stores an FHE handle; the oracle is granted ACL access to decrypt it.
3. **Creator (or sponsor) calls `requestReveal()`** — a `RevealRequested` event is emitted on-chain.
4. **Oracle picks up the event**, decrypts all contributions in TEE, ranks by amount (block-number tiebreaker), pins JSON to IPFS, and calls `fulfillLeaderboard()` on-chain.
5. **After the deadline**, `setTopKSponsors()` is called, locking winners. Creator calls `withdrawProjectFunds()`; non-winners call `claimRefund()`.

---

## Privacy Model

| What | Visible |
|---|---|
| Contribution amounts | Never — encrypted with FHE |
| Sponsor addresses (winners) | Yes — required for fund distribution |
| Sponsor addresses (non-winners) | Pseudonymous — only exposed if they claim a refund |
| Leaderboard rankings | Public after each reveal (IPFS) |
| IPFS leaderboard history | Permanent and immutable |

---

## Project Structure

```
FUNDME/
├── blockchain/          # Solidity contracts + Hardhat config + deployment scripts
│   ├── contracts/
│   │   ├── FundMePlatform.sol
│   │   └── FundMeToken.sol
│   └── ignition/modules/FundMe.ts
├── oracle/              # TEE oracle service
│   └── src/index.ts
└── web-app/             # Next.js frontend
    └── src/
        ├── app/
        └── components/
```

---

## License

MIT
