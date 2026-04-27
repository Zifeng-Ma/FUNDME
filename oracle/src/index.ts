/**
 * FundMe Oracle Service
 *
 * Subscribes to RevealRequested events on Arbitrum Sepolia, computes the
 * top-K leaderboard (using iExec NOX TEE decryption where possible),
 * pins the result to IPFS via Pinata, and calls fulfillLeaderboard().
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { createViemHandleClient } from '@iexec-nox/handle';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ORACLE_PRIVATE_KEY = process.env.PRIVATE_KEY_ORACLE as `0x${string}`;
const RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
const PINATA_JWT = process.env.PINATA_JWT;
const STARTUP_LOOKBACK = BigInt(
  process.env.STARTUP_LOOKBACK_BLOCKS ?? '200000',
);

const FUNDME_PLATFORM_ADDRESS =
  '0xD74cC75D381d607f49Bb0D647f8f719E185EeF3A' as const;

// ---------------------------------------------------------------------------
// ABIs (minimal – only what the oracle needs)
// ---------------------------------------------------------------------------

const PLATFORM_ABI = parseAbi([
  'function projects(uint256) view returns (address sponsoree, uint256 deadline, uint8 topKLimit, string reclaimProofId, bool isFinalized, uint256 lastRevealTimestamp, string title, string description, bool isAuction, uint256 minBidAmount, uint256 leaderboardCooldown)',
  'function getLeaderboardHistory(uint256 projectId) view returns (string[])',
  'function getContributionHandle(uint256 projectId, address sponsor) view returns (bytes32)',
  'function fulfillLeaderboard(uint256 projectId, string calldata ipfsHash) external',
  'function setTopKSponsors(uint256 projectId, address[] calldata winners) external',
  'function topKSponsorsSet(uint256 projectId) view returns (bool)',
  'event RevealRequested(uint256 indexed projectId, bool isFinalReveal)',
  'event SponsorshipAdded(uint256 indexed projectId, address indexed sponsor, uint256 timestamp)',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  rank: number;
  sponsor: Address;
}

interface LeaderboardPayload {
  projectId: number;
  generatedAt: number;
  isFinal: boolean;
  isAuction?: boolean;
  winnerAddress?: string;
  totalFunded?: number;
  highestBid?: number;
  entries: LeaderboardEntry[];
}

interface SponsorStats {
  address: Address;
  firstBlock: bigint;
}

// ---------------------------------------------------------------------------
// IPFS: pin JSON via Pinata
// ---------------------------------------------------------------------------

async function pinJsonToIPFS(payload: LeaderboardPayload): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT is not set. Set it in oracle/.env before running the oracle.');
  }

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: payload,
      pinataMetadata: {
        name: `leaderboard-project${payload.projectId}-${payload.generatedAt}.json`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  console.warn('[IPFS] Pinned:', data.IpfsHash);
  return data.IpfsHash;
}

// ---------------------------------------------------------------------------
// NOX: attempt to decrypt a confidential balance handle
// Returns the USDC amount (in human-readable units) or null on failure.
// ---------------------------------------------------------------------------

async function tryDecryptBalance(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  encryptedHandle: `0x${string}`,
  sponsor: string,
): Promise<number | null> {
  const ZERO_HANDLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  if (encryptedHandle === ZERO_HANDLE) {
    console.warn(`    [decrypt] ${sponsor} → zero handle`);
    return 0;
  }

  try {
    const acl = await handleClient.viewACL(encryptedHandle as any);

    if (acl.isPublic) {
      const { value } = await handleClient.publicDecrypt(encryptedHandle as any);
      const amount = Number(value as bigint) / 1e6;
      console.warn(`    [decrypt] ${sponsor} → publicDecrypt OK`);
      return amount;
    }

    const { value } = await handleClient.decrypt(encryptedHandle as any);
    const amount = Number(value as bigint) / 1e6;
    console.warn(`    [decrypt] ${sponsor} → TEE decrypt OK`);
    return amount;
  } catch (err) {
    console.warn(`    [decrypt] ${sponsor} → FAILED`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core: process a single RevealRequested event
// ---------------------------------------------------------------------------

async function processReveal(
  projectId: bigint,
  isFinalReveal: boolean,
  publicClient: PublicClient,
  walletClient: WalletClient,
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
): Promise<void> {
  console.warn(`\n[Oracle] Processing project ${projectId} (isFinal=${isFinalReveal})`);

  // ── 1. Fetch project metadata ──────────────────────────────────────────
  const result = await publicClient.readContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'projects',
    args: [projectId],
  });

  const [sponsoree, , topKLimit, , , , , , isAuction, minBidAmountRaw] = result;
  // minBidAmountRaw is in token units (6 decimals); convert to human-readable for comparisons
  const minBidAmount = minBidAmountRaw ? Number(minBidAmountRaw) / 1e6 : 0;
  console.warn(`  Sponsoree: ${sponsoree}  topK: ${topKLimit}  isAuction: ${isAuction}`);

  // ── 2. Collect every unique sponsor for this project ──────────────────
  const sponsorLogs = await publicClient.getLogs({
    address: FUNDME_PLATFORM_ADDRESS,
    event: parseAbiItem(
      'event SponsorshipAdded(uint256 indexed projectId, address indexed sponsor, uint256 timestamp)',
    ),
    args: { projectId },
    fromBlock: 0n,
    toBlock: 'latest',
  });

  console.warn(`  Found ${sponsorLogs.length} SponsorshipAdded event(s)`);

  // Deduplicate sponsors, keeping earliest block per address.
  const sponsorMap = new Map<string, SponsorStats>();
  for (const log of sponsorLogs) {
    const { sponsor } = log.args as { sponsor: Address; timestamp: bigint };
    const key = sponsor.toLowerCase();
    if (!sponsorMap.has(key)) {
      sponsorMap.set(key, {
        address: sponsor,
        firstBlock: log.blockNumber ?? 0n,
      });
    }
  }

  // ── 3. Decrypt each sponsor's per-project contribution via the TEE oracle ─
  // The contract stores an encrypted accumulator (_contributions[projectId][sponsor])
  // and grants ACL access to teeOracleAddress, so the TEE can decrypt it here.
  // This is the amount they actually contributed to THIS project — not their
  // total wallet balance.
  const sponsorsRanked: Array<SponsorStats & { amount: number | null }> = [];

  console.warn(`  [rank] Decrypting contributions for ${sponsorMap.size} sponsor(s)…`);
  for (const stats of sponsorMap.values()) {
    let amount: number | null = null;

    try {
      const encryptedHandle = (await publicClient.readContract({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'getContributionHandle',
        args: [projectId, stats.address],
      })) as `0x${string}`;

      amount = await tryDecryptBalance(handleClient, encryptedHandle, stats.address);
    } catch (err) {
      console.error(`  [rank] getContributionHandle failed for ${stats.address}:`, err);
    }

    sponsorsRanked.push({ ...stats, amount });
  }

  // Sort: by decrypted contribution amount descending (primary).
  // Tiebreaker: earliest first-contribution block (first-come, first-served).
  // Sponsors whose handle couldn't be decrypted fall to the bottom.
  sponsorsRanked.sort((a, b) => {
    if (a.amount !== null && b.amount !== null) {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return Number(a.firstBlock - b.firstBlock);
    }
    if (a.amount !== null) return -1;
    if (b.amount !== null) return 1;
    return Number(a.firstBlock - b.firstBlock);
  });

  console.warn(`\n  [rank] Final leaderboard (topK=${topKLimit}):`);
  const topK = sponsorsRanked.slice(0, topKLimit);
  for (let i = 0; i < topK.length; i++) {
    console.warn(`    #${i + 1} ${topK[i].address}`);
  }

  // ── 4. Build leaderboard payload ───────────────────────────────────────
  // Aggregate stats (totalFunded, highestBid) are safe to publish.
  // Individual per-sponsor amounts are never included — they stay private.
  const totalFunded = parseFloat(
    sponsorsRanked.reduce((sum, s) => (s.amount !== null ? sum + s.amount : sum), 0).toFixed(6),
  );

  // For auction mode, the winner must meet the minimum bid threshold (if set).
  const auctionEligible = isAuction
    ? sponsorsRanked.filter((s) => s.amount !== null && (minBidAmount === 0 || s.amount >= minBidAmount))
    : [];

  const auctionWinnerAddress =
    isAuction && isFinalReveal && auctionEligible.length > 0
      ? auctionEligible[0].address
      : undefined;

  if (isAuction && isFinalReveal && sponsorsRanked.length > 0 && !auctionWinnerAddress) {
    console.warn(`[Oracle] Auction: no sponsor met the minimum bid threshold — no winner will be set`);
  }

  const leaderboard: LeaderboardPayload = {
    projectId: Number(projectId),
    generatedAt: Math.floor(Date.now() / 1000),
    isFinal: isFinalReveal,
    isAuction: isAuction as boolean,
    winnerAddress: auctionWinnerAddress,
    totalFunded,
    highestBid: isAuction && sponsorsRanked[0]?.amount != null
      ? parseFloat(sponsorsRanked[0].amount.toFixed(6))
      : undefined,
    entries: topK.map((s, i) => ({
      rank: i + 1,
      sponsor: s.address,
    })),
  };

  console.warn(`[Oracle] Leaderboard built: projectId=${leaderboard.projectId} entries=${leaderboard.entries.length} isFinal=${leaderboard.isFinal}`);

  // ── 5. Pin to IPFS ─────────────────────────────────────────────────────
  console.warn('[Oracle] Pinning to IPFS…');
  const ipfsHash = await pinJsonToIPFS(leaderboard);

  // ── 6. Call fulfillLeaderboard from the oracle wallet ──────────────────
  console.warn('[Oracle] Submitting fulfillLeaderboard…');
  const gasPrice = await publicClient.getGasPrice();

  const hash = await walletClient.writeContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'fulfillLeaderboard',
    args: [projectId, ipfsHash],
    gasPrice: (gasPrice * 130n) / 100n,
    chain: arbitrumSepolia,
    account: walletClient.account!,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.warn(`[Oracle] fulfillLeaderboard confirmed! tx: ${hash}`);

  // ── 7. For final reveals, set the top-K sponsors on-chain ─────────────
  if (isFinalReveal) {
    // Collect addresses that qualify for top-K (must meet min bid if auction)
    const winners = sponsorsRanked
      .filter((s) => !isAuction || (s.amount !== null && (minBidAmount === 0 || s.amount >= minBidAmount)))
      .slice(0, topKLimit)
      .map(s => s.address);

    if (winners.length === 0) {
      console.warn('[Oracle] No qualifying winners found — skipping setTopKSponsors');
    } else {
      console.warn(`[Oracle] Setting ${winners.length} top-K sponsor(s)…`);
      const freshGasPrice = await publicClient.getGasPrice();
      const winnerHash = await walletClient.writeContract({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'setTopKSponsors',
        args: [projectId, winners],
        gasPrice: (freshGasPrice * 130n) / 100n,
        chain: arbitrumSepolia,
        account: walletClient.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash: winnerHash });
      console.warn(`[Oracle] setTopKSponsors confirmed! tx: ${winnerHash}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Startup: replay any RevealRequested events we might have missed
// ---------------------------------------------------------------------------

async function replayMissedEvents(
  publicClient: PublicClient,
  walletClient: WalletClient,
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  currentBlock: bigint,
): Promise<void> {
  if (STARTUP_LOOKBACK === 0n) return;

  const fromBlock =
    currentBlock > STARTUP_LOOKBACK ? currentBlock - STARTUP_LOOKBACK : 0n;

  console.warn(
    `[Oracle] Scanning blocks ${fromBlock}–${currentBlock} for missed events…`,
  );

  const logs = await publicClient.getLogs({
    address: FUNDME_PLATFORM_ADDRESS,
    event: parseAbiItem(
      'event RevealRequested(uint256 indexed projectId, bool isFinalReveal)',
    ),
    fromBlock,
    toBlock: currentBlock,
  });

  if (logs.length === 0) {
    console.warn('[Oracle] No missed events found.');
    return;
  }

  console.warn(`[Oracle] Found ${logs.length} missed RevealRequested event(s).`);

  for (const log of logs) {
    const { projectId, isFinalReveal } = log.args as {
      projectId: bigint;
      isFinalReveal: boolean;
    };

    // Skip if the leaderboard was already fulfilled (has at least one IPFS hash).
    const history = (await publicClient.readContract({
      address: FUNDME_PLATFORM_ADDRESS,
      abi: PLATFORM_ABI,
      functionName: 'getLeaderboardHistory',
      args: [projectId],
    })) as string[];

    // A heuristic: if a final reveal was already fulfilled the project is
    // finalized – skip.  Intermediate reveals may still be re-processed but
    // will just append another hash, which is acceptable.
    if (isFinalReveal && history.length > 0) {
      console.warn(
        `[Oracle] Project ${projectId} already has ${history.length} leaderboard(s), skipping final replay.`,
      );
      continue;
    }

    try {
      await processReveal(
        projectId,
        isFinalReveal,
        publicClient,
        walletClient,
        handleClient,
      );
    } catch (err) {
      console.error(
        `[Oracle] Failed to replay project ${projectId}:`,
        err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!ORACLE_PRIVATE_KEY) {
    throw new Error(
      'PRIVATE_KEY_ORACLE is not set. Copy .env.example to .env and fill it in.',
    );
  }
  if (!PINATA_JWT) {
    throw new Error(
      'PINATA_JWT is not set. Copy .env.example to .env and fill it in.',
    );
  }

  const account = privateKeyToAccount(ORACLE_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(RPC_URL, { timeout: 30_000 }),
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(RPC_URL),
  });

  const handleClient = await createViemHandleClient(walletClient as any);

  console.warn('═══════════════════════════════════════════════');
  console.warn('  FundMe Oracle Service');
  console.warn('  Address :', account.address);
  console.warn('  RPC     :', RPC_URL);
  console.warn('  IPFS    : Pinata');
  console.warn('═══════════════════════════════════════════════\n');

  const currentBlock = await publicClient.getBlockNumber();

  // Replay any events that arrived while the oracle was offline.
  await replayMissedEvents(
    publicClient,
    walletClient,
    handleClient,
    currentBlock,
  );

  // Watch for new RevealRequested events in real time, with auto-restart on error.
  console.warn(
    '\n[Oracle] Watching for RevealRequested events on FundMePlatform…\n',
  );

  let unwatch: () => void = () => {};
  let shuttingDown = false;

  const startWatcher = () => {
    if (shuttingDown) return;
    unwatch = publicClient.watchContractEvent({
      address: FUNDME_PLATFORM_ADDRESS,
      abi: PLATFORM_ABI,
      eventName: 'RevealRequested',
      poll: true,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const log of logs) {
          const { projectId, isFinalReveal } = log.args as {
            projectId: bigint;
            isFinalReveal: boolean;
          };
          console.warn(
            `[Event] RevealRequested  projectId=${projectId}  isFinalReveal=${isFinalReveal}`,
          );
          processReveal(
            projectId,
            isFinalReveal,
            publicClient,
            walletClient,
            handleClient,
          ).catch((err) =>
            console.error(
              `[Error] processReveal(${projectId}):`,
              err,
            ),
          );
        }
      },
      onError: (err) => {
        console.error('[Error] watchContractEvent:', err);
        unwatch();
        console.warn('[Oracle] Restarting watcher in 10s…');
        setTimeout(startWatcher, 10_000);
      },
    });
  };

  startWatcher();

  process.on('SIGINT', () => {
    console.warn('\n[Oracle] Shutting down…');
    shuttingDown = true;
    unwatch();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
