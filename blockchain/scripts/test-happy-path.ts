import hre from "hardhat";
import { createViemHandleClient } from '@iexec-nox/handle';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  getContract,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import 'dotenv/config';

const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address;
const FUND_ME_TOKEN_ADDRESS = '0x6D15F83cbCcCF396CB84E21805d54473864a67B9' as Address;
const FUND_ME_PLATFORM_ADDRESS = '0xD74cC75D381d607f49Bb0D647f8f719E185EeF3A' as Address;

// 1 USDC per sponsor
const SPONSOR_AMOUNT = parseUnits('1', 6);

const ERC20_ABI = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function' as const,
    name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
];

const TOKEN_ABI = [
  ...ERC20_ABI,
  {
    type: 'function' as const,
    name: 'wrap',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function' as const,
    name: 'unwrap',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' }
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function' as const,
    name: 'confidentialBalanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    type: 'function' as const,
    name: 'isOperator',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function' as const,
    name: 'setOperator',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'until', type: 'uint48' }],
    outputs: [],
    stateMutability: 'nonpayable',
  }
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDeadline(publicClient: ReturnType<typeof createPublicClient>, deadline: bigint) {
  console.log(`\nWaiting for deadline: ${new Date(Number(deadline) * 1000).toLocaleTimeString()}`);
  while (true) {
    const block = await publicClient.getBlock();
    if (block.timestamp >= deadline) break;
    const remaining = Number(deadline - block.timestamp);
    process.stdout.write(`\r  ${remaining}s remaining...   `);
    await sleep(10_000);
  }
  console.log('\n✅ Campaign ended.');
}

async function main() {
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
  const creatorIndex = parseInt(process.env.CREATOR_INDEX || '1') - 1;

  // Load private keys and create clients
  const keys = [1, 2, 3, 4].map(i => {
    const v = process.env[`PRIVATE_KEY_${i}`];
    if (!v) throw new Error(`Missing PRIVATE_KEY_${i} in .env`);
    return v as `0x${string}`;
  });

  const accounts = keys.map(k => privateKeyToAccount(k));
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
  const walletClients = accounts.map(account =>
    createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpc) })
  );

  console.log('\n=== Addresses ===');
  accounts.forEach((a, i) => console.log(`  [${i + 1}] ${a.address}`));

  // Load ABIs from compiled artifacts
  const platformArtifact = await hre.artifacts.readArtifact('FundMePlatform');
  const tokenArtifact = await hre.artifacts.readArtifact('FundMeToken');

  const platformRO = getContract({
    address: FUND_ME_PLATFORM_ADDRESS,
    abi: platformArtifact.abi,
    client: publicClient,
  });
  const tokenRO = getContract({
    address: FUND_ME_TOKEN_ADDRESS,
    abi: tokenArtifact.abi,
    client: publicClient,
  });
  const usdcRO = getContract({ address: USDC_ADDRESS, abi: ERC20_ABI, client: publicClient });

  // Detect oracle
  const oracleAddress = (await platformRO.read.teeOracleAddress()) as Address;
  const oracleIndex = accounts.findIndex(
    a => a.address.toLowerCase() === oracleAddress.toLowerCase()
  );
  if (oracleIndex === -1) {
    throw new Error(
      `teeOracleAddress (${oracleAddress}) does not match any of the 4 provided keys. Oracle txs will fail.`
    );
  }

  const sponsorIndices = [0, 1, 2, 3].filter(i => i !== creatorIndex);

  console.log('\n=== Roles ===');
  console.log(`  Creator (sponsoree): [${creatorIndex + 1}] ${accounts[creatorIndex].address}`);
  console.log(`  Oracle:              [${oracleIndex + 1}] ${accounts[oracleIndex].address}`);
  console.log(`  Sponsors:            ${sponsorIndices.map(i => `[${i + 1}]`).join(', ')}`);

  // Check USDC balances
  console.log('\n=== USDC Balances ===');
  for (const [i, account] of accounts.entries()) {
    const balance = (await usdcRO.read.balanceOf([account.address])) as bigint;
    console.log(`  [${i + 1}] ${account.address}: ${Number(balance) / 1e6} USDC`);
  }

  // ── Step 0: Admin Configuration ─────────────────────────────────────────────
  console.log('\n=== Step 0: Admin Configuration ===');
  const ownerClient = walletClients[0];
  const platformAsOwner = getContract({
    address: FUND_ME_PLATFORM_ADDRESS,
    abi: platformArtifact.abi,
    client: ownerClient,
  });
  
  console.log('  Setting global leaderboard cooldown to 60s...');
  const cooldownTx = await platformAsOwner.write.setLeaderboardCooldown([60n]);
  await publicClient.waitForTransactionReceipt({ hash: cooldownTx });
  console.log('  ✅ Cooldown updated.');

  // ── Step 1: Create 8 demo projects ──────────────────────────────────────────
  console.log('\n=== Step 1: Create 8 Demo Projects ===');

  const demoProjects = [
    {
      walletIdx: 0,
      title: 'DeSci: Genomic Privacy Research',
      desc: 'Funding for open-source research into privacy-preserving genomic data sharing using FHE.',
      duration: 120n, topK: 5, isAuction: false, minBid: 0n
    },
    {
      walletIdx: 1,
      title: 'Privacy-First Hardware Wallet',
      desc: 'An open-source hardware wallet with native support for confidential assets and encrypted transactions.',
      duration: 60n, topK: 1, isAuction: true, minBid: parseUnits('10', 6)
    },
    {
      walletIdx: 2,
      title: 'ZK-EVM Circuit Optimization',
      desc: 'Specialized grants for developers working on reducing proving times for production ZK-EVMs.',
      duration: 180n, topK: 3, isAuction: false, minBid: 0n
    },
    {
      walletIdx: 3,
      title: 'Confidential DEX Aggregator',
      desc: 'Building a liquidity aggregator that masks trade sizes and slippage data using TEEs.',
      duration: 90n, topK: 1, isAuction: true, minBid: parseUnits('5', 6)
    },
    {
      walletIdx: 0,
      title: 'On-chain Credit Scoring',
      desc: 'Privacy-preserving credit scores using zero-knowledge proofs and historical DeFi activity.',
      duration: 240n, topK: 10, isAuction: false, minBid: 0n
    },
    {
      walletIdx: 1,
      title: 'Shielded NFT Marketplace',
      desc: 'A marketplace where ownership history is encrypted, allowing private transfers of high-value art.',
      duration: 45n, topK: 1, isAuction: true, minBid: parseUnits('2', 6)
    },
    {
      walletIdx: 2,
      title: 'FHE-powered Dark Pool',
      desc: 'An institutional-grade dark pool using Fully Homomorphic Encryption for complete order-book privacy.',
      duration: 300n, topK: 2, isAuction: false, minBid: 0n
    },
    {
      walletIdx: 3,
      title: 'The Alpha Pass Auction',
      desc: 'Exclusive access pass for the FundMe private alpha. Only the highest bidder wins the unique soulbound NFT pass!',
      duration: 5n, topK: 1, isAuction: true, minBid: parseUnits('0.5', 6)
    }
  ];

  for (const demo of demoProjects) {
    console.log(`  Wallet [${demo.walletIdx + 1}] creating: ${demo.title}...`);
    const client = walletClients[demo.walletIdx];
    const platform = getContract({
      address: FUND_ME_PLATFORM_ADDRESS,
      abi: platformArtifact.abi,
      client: client,
    });

    const tx = await platform.write.createProject([
      demo.duration,
      demo.topK,
      '', // Always empty proofId
      demo.title,
      demo.desc,
      demo.isAuction,
      demo.minBid,
      60n,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  const projectId = (await platformRO.read.nextProjectId()) as bigint - 1n;
  console.log(`\n  Using last project for Happy Path test: ID ${projectId}`);

  const projectData = (await platformRO.read.projects([projectId])) as any[];
  const project = {
    sponsoree: projectData[0] as Address,
    deadline: projectData[1] as bigint,
    topKLimit: projectData[2] as number,
  };
  const platformAsCreator = getContract({
    address: FUND_ME_PLATFORM_ADDRESS,
    abi: platformArtifact.abi,
    client: walletClients[demoProjects[demoProjects.length - 1].walletIdx],
  });
  const topKLimit = project.topKLimit;
  console.log(`  deadline: ${new Date(Number(project.deadline) * 1000).toLocaleString()}`);

  // ── Step 2: Sponsor the project (each sponsor) ──────────────────────────────
  const farFuture = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);

  for (const [loopIdx, idx] of sponsorIndices.entries()) {
    const sponsorClient = walletClients[idx];
    const sponsorAddr = accounts[idx].address;
    console.log(`\n=== Step 2: Sponsor [${idx + 1}] ${sponsorAddr} ===`);

    const usdcAsSponsors = getContract({ address: USDC_ADDRESS, abi: ERC20_ABI, client: sponsorClient });
    const tokenAsSponsor = getContract({
      address: FUND_ME_TOKEN_ADDRESS,
      abi: tokenArtifact.abi,
      client: sponsorClient,
    });
    const platformAsSponsor = getContract({
      address: FUND_ME_PLATFORM_ADDRESS,
      abi: platformArtifact.abi,
      client: sponsorClient,
    });

    // Approve USDC → FundMeToken
    const allowance = (await usdcRO.read.allowance([sponsorAddr, FUND_ME_TOKEN_ADDRESS])) as bigint;
    if (allowance < SPONSOR_AMOUNT) {
      console.log(`  Approving USDC...`);
      const tx = await usdcAsSponsors.write.approve([FUND_ME_TOKEN_ADDRESS, SPONSOR_AMOUNT]);
      console.log(`  approve tx: ${tx}`);
      await publicClient.waitForTransactionReceipt({ hash: tx });
    } else {
      console.log(`  USDC already approved.`);
    }

    // Wrap USDC → encrypted FundMeToken
    console.log(`  Wrapping ${Number(SPONSOR_AMOUNT) / 1e6} USDC → FundMeToken...`);
    const wrapTx = await tokenAsSponsor.write.wrap([sponsorAddr, SPONSOR_AMOUNT]);
    console.log(`  wrap tx: ${wrapTx}`);
    await publicClient.waitForTransactionReceipt({ hash: wrapTx });

    // Set FundMePlatform as operator on FundMeToken
    const isOp = (await tokenRO.read.isOperator([sponsorAddr, FUND_ME_PLATFORM_ADDRESS])) as boolean;
    if (!isOp) {
      console.log(`  Setting platform as operator...`);
      const tx = await tokenAsSponsor.write.setOperator([FUND_ME_PLATFORM_ADDRESS, farFuture]);
      console.log(`  setOperator tx: ${tx}`);
      await publicClient.waitForTransactionReceipt({ hash: tx });
    } else {
      console.log(`  Platform already set as operator.`);
    }

    // Encrypt contribution amount via NOX SDK and sponsor
    console.log(`  Encrypting contribution via NOX...`);
    const handleClient = await createViemHandleClient(sponsorClient);
    const { handle, handleProof } = await handleClient.encryptInput(
      SPONSOR_AMOUNT,
      'uint256',
      FUND_ME_PLATFORM_ADDRESS
    );

    console.log(`  Sponsoring project ${projectId}...`);
    const sponsorTx = await platformAsSponsor.write.sponsorProject([projectId, handle, handleProof]);
    console.log(`  sponsorProject tx: ${sponsorTx}`);
    await publicClient.waitForTransactionReceipt({ hash: sponsorTx });
    console.log(`  ✅ Done.`);

    // ── Mid-Campaign Reveal after first sponsor ──
    if (loopIdx === 0) {
      console.log('\n=== Step 2.5: Mid-Campaign Reveal (Non-Final) ===');
      console.log('  Requesting leaderboard refresh...');
      const midRevealTx = await platformAsCreator.write.requestLeaderboardRefresh([projectId, false]);
      console.log(`  request tx: ${midRevealTx}`);
      await publicClient.waitForTransactionReceipt({ hash: midRevealTx });

      const platformAsOracle = getContract({
        address: FUND_ME_PLATFORM_ADDRESS,
        abi: platformArtifact.abi,
        client: walletClients[oracleIndex],
      });
      
      console.log('  Oracle fulfilling mid-campaign reveal...');
      const midFulfillTx = await platformAsOracle.write.fulfillLeaderboard([
        projectId,
        'ipfs://QmMidCampaignLeaderboard',
      ]);
      await publicClient.waitForTransactionReceipt({ hash: midFulfillTx });
      console.log('  ✅ Mid-campaign leaderboard updated.');

      console.log('  Testing cooldown (should fail if we request again immediately)...');
      try {
        await platformAsCreator.write.requestLeaderboardRefresh([projectId, false]);
        console.log('  ❌ Error: Cooldown check failed (should have reverted)');
      } catch (e) {
        console.log('  ✅ Cooldown successfully blocked rapid refresh.');
      }
    }
  }

  // ── Step 3: Wait for deadline ───────────────────────────────────────────────
  await waitForDeadline(publicClient, project.deadline);

  // ── Step 4: Creator requests final leaderboard reveal ──────────────────────
  console.log('\n=== Step 3: Request Final Reveal ===');
  const revealTx = await platformAsCreator.write.requestLeaderboardRefresh([projectId, true]);
  console.log(`  tx: ${revealTx}`);
  await publicClient.waitForTransactionReceipt({ hash: revealTx });

  // ── Step 5: Oracle fulfills leaderboard ────────────────────────────────────
  console.log('\n=== Step 4: Oracle Fulfills Leaderboard ===');
  const platformAsOracle = getContract({
    address: FUND_ME_PLATFORM_ADDRESS,
    abi: platformArtifact.abi,
    client: walletClients[oracleIndex],
  });
  const fulfillTx = await platformAsOracle.write.fulfillLeaderboard([
    projectId,
    'ipfs://QmHappyPathFinal',
  ]);
  console.log(`  tx: ${fulfillTx}`);
  await publicClient.waitForTransactionReceipt({ hash: fulfillTx });

  // ── Step 6: Oracle sets top-K sponsors (only first sponsor wins) ──────────
  console.log('\n=== Step 5: Oracle Sets Top-K Sponsors ===');
  const winners = [accounts[sponsorIndices[0]].address];
  console.log(`  Winners: ${winners.join(', ')}`);
  const setTopKTx = await platformAsOracle.write.setTopKSponsors([projectId, winners]);
  console.log(`  tx: ${setTopKTx}`);
  await publicClient.waitForTransactionReceipt({ hash: setTopKTx });

  // ── Step 7: Sponsoree withdraws ────────────────────────────────────────────
  console.log('\n=== Step 6: Sponsoree Withdraws Funds ===');
  const withdrawTx = await platformAsCreator.write.withdrawProjectFunds([projectId]);
  console.log(`  tx: ${withdrawTx}`);
  await publicClient.waitForTransactionReceipt({ hash: withdrawTx });

  // ── Step 8: Non-winners claim refunds ──────────────────────────────────────
  console.log('\n=== Step 7: Non-winners Claim Refunds ===');
  const loserIndices = sponsorIndices.slice(1);
  for (const idx of loserIndices) {
    const loserAddr = accounts[idx].address;
    console.log(`  [${idx + 1}] ${loserAddr} claiming refund...`);
    const platformAsLoser = getContract({
      address: FUND_ME_PLATFORM_ADDRESS,
      abi: platformArtifact.abi,
      client: walletClients[idx],
    });
    const refundTx = await platformAsLoser.write.claimRefund([projectId]);
    console.log(`  refund tx: ${refundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: refundTx });
  }

  // ── Step 9: Verify ─────────────────────────────────────────────────────────
  console.log('\n=== Step 8: Verify ===');
  const withdrawn = (await platformRO.read.projectWithdrawn([projectId])) as boolean;
  const topKSet = (await platformRO.read.topKSponsorsSet([projectId])) as boolean;
  console.log(`  projectWithdrawn[${projectId}]: ${withdrawn}`);
  console.log(`  topKSponsorsSet[${projectId}]: ${topKSet}`);

  for (const idx of loserIndices) {
    const hasClaimed = await platformRO.read.hasClaimedRefund([projectId, accounts[idx].address]);
    console.log(`  hasClaimedRefund[${accounts[idx].address}]: ${hasClaimed}`);
    if (!hasClaimed) throw new Error(`Refund check failed for ${accounts[idx].address}`);
  }

  // ── Step 10: View Function & History Verification ──────────────────────────
  console.log('\n=== Step 9: View Function Verification ===');
  const history = await platformRO.read.getLeaderboardHistory([projectId]) as string[];
  console.log(`  Leaderboard History (${history.length} entries):`);
  history.forEach((h, i) => console.log(`    [${i}] ${h}`));
  if (history.length < 2) throw new Error("History missing mid-campaign entry!");

  const topKSponsors = await platformRO.read.getTopKSponsors([projectId]) as Address[];
  console.log(`  Final Top-K List: ${topKSponsors.join(', ')}`);

  const sponsor1 = accounts[sponsorIndices[0]].address;
  const handle = await platformRO.read.getContributionHandle([projectId, sponsor1]);
  console.log(`  Encrypted handle for Sponsor 1: ${handle}`);

  // ── Step 11: Token Unwrap (Exit Path) ──────────────────────────────────────
  console.log('\n=== Step 10: Unwrap Refunded Tokens ===');
  const loserIdx = loserIndices[0];
  const loserClient = walletClients[loserIdx];
  const loserAddr = accounts[loserIdx].address;
  const tokenAsLoser = getContract({ address: FUND_ME_TOKEN_ADDRESS, abi: TOKEN_ABI, client: loserClient });

  console.log(`  Encrypting unwrap amount for ${loserAddr}...`);
  const loserHandleClient = await createViemHandleClient(loserClient);
  const { handle: unwrapHandle, handleProof: unwrapProof } = await loserHandleClient.encryptInput(
    SPONSOR_AMOUNT,
    'uint256',
    FUND_ME_TOKEN_ADDRESS
  );

  console.log(`  Requesting unwrap of ${Number(SPONSOR_AMOUNT) / 1e6} FUNDME → USDC...`);
  const unwrapTx = await tokenAsLoser.write.unwrap([loserAddr, loserAddr, unwrapHandle, unwrapProof]);
  await publicClient.waitForTransactionReceipt({ hash: unwrapTx });
  console.log(`  unwrap request tx: ${unwrapTx}`);
  console.log(`  ✅ Unwrap request submitted (Note: finalizeUnwrap requires Oracle fulfillment).`);
  
  const finalUsdcBal = await usdcRO.read.balanceOf([loserAddr]) as bigint;
  console.log(`  Current USDC Balance (pre-finalization): ${Number(finalUsdcBal) / 1e6} USDC`);

  if (!withdrawn || !topKSet) throw new Error('Post-condition check failed!');

  console.log('\n🎉 Comprehensive integration test completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
