'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from 'wagmi';
import { createViemHandleClient } from '@iexec-nox/handle';
import { parseUnits } from 'viem';
import {
  ArrowLeft,
  Clock,
  Crown,
  Flame,
  Lock,
  Download,
  RefreshCw,
  Send,
  ShieldCheck,
  Trophy,
  Upload,
  Zap,
} from 'lucide-react';
import {
  CHAIN_ID,
  FUNDME_PLATFORM_ADDRESS,
  FUNDME_TOKEN_ADDRESS,
  IPFS_GATEWAY,
  IPFS_GATEWAY_FALLBACKS,
  PLATFORM_ABI,
  SPONSOR_GAS_LIMIT,
  USDC_DECIMALS,
  WRAPPER_ABI,
  getGasOverride,
  type LeaderboardPayload,
} from '@/lib/contracts';
import { isUnderpricedGasError, isUserRejection } from '@/lib/errors';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { AddressLink } from '@/components/AddressLink';

// --- Helpers -------------------------------------------------------------

function useCountdown(deadline?: bigint) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return { ended: false, label: '—', totalSeconds: 0 };
  const diff = Number(deadline) - now;
  if (diff <= 0) return { ended: true, label: 'Ended', totalSeconds: 0 };
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  return { ended: false, label, totalSeconds: diff };
}

// --- Page ---------------------------------------------------------------

export default function ProjectDetailPage({
  params,
}: {
  // Next.js 15+ / 16 passes params as a Promise in client components.
  params: Promise<{ id: string }>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { id } = use(params);
  const projectId = Number(id);
  const isValidId = Number.isFinite(projectId) && projectId >= 0;

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  // --- Reads ------------------------------------------------------------

  const {
    data: projectData,
    isLoading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'projects',
    args: isValidId ? [BigInt(projectId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId },
  });

  const {
    data: leaderboardHistory,
    refetch: refetchLeaderboard,
  } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'getLeaderboardHistory',
    args: isValidId ? [BigInt(projectId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId },
  });

const { data: isOperator, refetch: refetchIsOperator } = useReadContract({
    address: FUNDME_TOKEN_ADDRESS,
    abi: WRAPPER_ABI,
    functionName: 'isOperator',
    args: address ? [address, FUNDME_PLATFORM_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  // --- Derived state ----------------------------------------------------

  const project = useMemo(() => {
    if (!projectData) return null;
    const [
      sponsoree,
      deadline,
      topKLimit,
      reclaimProofId,
      isFinalized,
      lastRevealTimestamp,
      title,
      description,
      isAuction,
      minBidAmount,
      leaderboardCooldown,
    ] = projectData as readonly [
      `0x${string}`,
      bigint,
      number,
      string,
      boolean,
      bigint,
      string,
      string,
      boolean,
      bigint,
      bigint,
    ];
    return {
      sponsoree,
      deadline,
      topKLimit,
      reclaimProofId,
      isFinalized,
      lastRevealTimestamp,
      title,
      description,
      isAuction,
      minBidAmount,
      leaderboardCooldown,
    };
  }, [projectData]);

  const { data: auctionWinnerAddress, refetch: refetchAuctionWinner } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'getAuctionWinner',
    args: isValidId ? [BigInt(projectId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId && !!project?.isAuction },
  });

  const { data: isTopKSponsor, refetch: refetchIsTopKSponsor } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'isTopKSponsor',
    args: isValidId && address ? [BigInt(projectId), address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId && !!address },
  });

  const { data: topKSponsorsSet, refetch: refetchTopKSponsorsSet } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'topKSponsorsSet',
    args: isValidId ? [BigInt(projectId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId },
  });

  const { data: hasClaimedRefund, refetch: refetchHasClaimed } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'hasClaimedRefund',
    args: isValidId && address ? [BigInt(projectId), address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId && !!address },
  });

  const countdown = useCountdown(project?.deadline);
  const isSponsoree =
    !!address && !!project && address.toLowerCase() === project.sponsoree.toLowerCase();
  const isProjectMissing =
    !!projectData &&
    project?.sponsoree === '0x0000000000000000000000000000000000000000';

  const latestLeaderboardHash = useMemo(() => {
    if (!leaderboardHistory) return null;
    const arr = leaderboardHistory as readonly string[];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }, [leaderboardHistory]);

  // --- Leaderboard JSON fetch ------------------------------------------

  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);
  const [leaderboardFetchError, setLeaderboardFetchError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (!latestLeaderboardHash) {
      setLeaderboard(null);
      return;
    }

    // Mock hashes are written on-chain when the oracle runs without PINATA_JWT.
    // They are not real IPFS CIDs — fetching them will always fail.
    if (latestLeaderboardHash.startsWith('QmMock')) {
      setLeaderboardFetchError(
        'Oracle is running in mock mode (no Pinata JWT configured). Set PINATA_JWT in oracle/.env and restart the oracle.',
      );
      return;
    }

    let cancelled = false;
    (async () => {
      setLeaderboardLoading(true);
      setLeaderboardFetchError(null);

      const gateways = [IPFS_GATEWAY, ...IPFS_GATEWAY_FALLBACKS];
      let lastError = 'Failed to fetch leaderboard';

      for (const gateway of gateways) {
        if (cancelled) break;
        const url = `${gateway}${latestLeaderboardHash}`;
        try {
          const res = await fetch(url);
          if (!res.ok) {
            lastError = `IPFS gateway returned ${res.status}`;
            continue;
          }
          const text = await res.text();
          const json = JSON.parse(text) as LeaderboardPayload;
          if (!cancelled) {
            setLeaderboard(json);
            setLeaderboardLoading(false);
          }
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
        }
      }

      if (!cancelled) {
        setLeaderboardFetchError(lastError);
        setLeaderboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latestLeaderboardHash]);

  // --- Sponsor flow ----------------------------------------------------

  const [amount, setAmount] = useState('');
  const [sponsorStep, setSponsorStep] = useState<'idle' | 'authorizing' | 'sponsoring'>('idle');
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [sponsorSuccess, setSponsorSuccess] = useState<string | null>(null);

  const handleSponsorFlow = async () => {
    if (!address || !project || !walletClient || sponsorStep !== 'idle') return;
    if (!amount || Number(amount) <= 0) {
      setSponsorError('Enter an amount greater than zero.');
      return;
    }
    if (project.isAuction && project.minBidAmount > 0n) {
      const amountInUnits = parseUnits(amount, USDC_DECIMALS);
      if (amountInUnits < project.minBidAmount) {
        const minHuman = (Number(project.minBidAmount) / 1e6).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        });
        setSponsorError(`Bid must be at least ${minHuman} FUNDME.`);
        return;
      }
    }
    setSponsorError(null);
    setSponsorSuccess(null);
    try {
      // Step 1: authorize the platform as operator if not already done.
      if (!isOperator) {
        setSponsorStep('authorizing');
        // setOperator takes uint48 (seconds) — safe since 2^48 s ≈ 8.9M years.
        const untilSeconds = Number(project.deadline) + 60; // 1 min buffer
        const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
        await writeContractAsync({
          address: FUNDME_TOKEN_ADDRESS,
          abi: WRAPPER_ABI,
          functionName: 'setOperator',
          args: [FUNDME_PLATFORM_ADDRESS, untilSeconds],
          chainId: CHAIN_ID,
          ...gasOverride,
        });
        await refetchIsOperator();
        // Give the wallet a moment before the next interaction.
        await new Promise((res) => setTimeout(res, 5_000));
      }

      // Step 2: encrypt the amount and call sponsorProject.
      setSponsorStep('sponsoring');
      const valueInUnits = parseUnits(amount, USDC_DECIMALS);

      // Encrypt the amount off-chain against the PLATFORM address, since that's
      // the contract that will call Nox.fromExternal(...).
      const handleClient = await createViemHandleClient(walletClient as any);
      const { handle: encryptedAmount, handleProof: inputProof } =
        await handleClient.encryptInput(
          valueInUnits,
          'uint256',
          FUNDME_PLATFORM_ADDRESS,
        );

      const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
      const sponsorTxHash = await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'sponsorProject',
        args: [
          BigInt(projectId),
          encryptedAmount as `0x${string}`,
          inputProof as `0x${string}`,
        ],
        chainId: CHAIN_ID,
        gas: SPONSOR_GAS_LIMIT,
        ...gasOverride,
      });

      // Wait for the receipt and verify the transaction didn't revert on-chain.
      // writeContractAsync only throws if the tx is rejected by the node; an
      // out-of-gas revert is still "accepted" and returns a hash, so we must
      // check receipt.status ourselves.
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: sponsorTxHash });
        if (receipt.status === 'reverted') {
          // Attempt to diagnose the revert reason by re-simulating the call.
          // This catches require() messages emitted by the contract.
          let revertMsg: string | null = null;
          try {
            await publicClient.simulateContract({
              address: FUNDME_PLATFORM_ADDRESS,
              abi: PLATFORM_ABI,
              functionName: 'sponsorProject',
              args: [
                BigInt(projectId),
                encryptedAmount as `0x${string}`,
                inputProof as `0x${string}`,
              ],
              account: address,
              gas: SPONSOR_GAS_LIMIT,
            });
          } catch (simErr) {
            const raw = simErr instanceof Error ? simErr.message : String(simErr);
            if (raw.includes('Funding campaign has ended')) {
              revertMsg = 'This campaign has already ended — sponsorships are no longer accepted.';
            } else if (raw.includes('Platform is not an operator')) {
              revertMsg = 'Wallet authorization expired. Retry — you will be prompted to re-authorize.';
            } else if (raw.includes('out of gas') || raw.includes('OutOfGas')) {
              revertMsg = 'Transaction ran out of gas. Try again with a higher gas limit.';
            }
            // Other reverts (e.g. confidential transfer failure) fall through to the generic message below.
          }
          throw new Error(
            revertMsg ??
              'Transaction reverted. This usually means insufficient FUNDME balance, an expired authorization, or a closed campaign.',
          );
        }
      }

      if (typeof window !== 'undefined') {
        const key = `fundme_sponsorship_${address}_${projectId}`;
        const prev = parseFloat(localStorage.getItem(key) ?? '0');
        const next = prev + parseFloat(amount);
        localStorage.setItem(key, String(next));
      }
      setAmount('');
      setSponsorSuccess(
        project.isAuction
          ? 'Bid submitted confidentially. Rank updates on next leaderboard refresh.'
          : 'Sponsorship submitted confidentially. Rank updates on next leaderboard refresh.',
      );
    } catch (err) {
      if (isUserRejection(err)) return;
      setSponsorError(
        isUnderpricedGasError(err)
          ? "Base fee too high — retry with MetaMask's Aggressive gas setting."
          : err instanceof Error
            ? err.message.slice(0, 200)
            : project.isAuction
              ? 'Bid failed.'
              : 'Sponsorship failed.',
      );
    } finally {
      setSponsorStep('idle');
    }
  };

  // --- Sponsoree: leaderboard refresh ----------------------------------

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [awaitingOracle, setAwaitingOracle] = useState(false);

  const handleRefreshLeaderboard = async (isFinalReveal: boolean) => {
    if (!project || !isSponsoree || isRefreshing) return;
    setRefreshError(null);
    try {
      setIsRefreshing(true);
      const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
      const txHash = await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'requestLeaderboardRefresh',
        args: [BigInt(projectId), isFinalReveal],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      await refetchProject();

      // Poll for the oracle's fulfillLeaderboard response. The oracle picks up the
      // RevealRequested event and calls fulfillLeaderboard asynchronously, so we
      // can't just refetch once — we poll until the hash count grows or we timeout.
      const previousHashCount = (leaderboardHistory as readonly string[] | undefined)?.length ?? 0;
      setIsRefreshing(false);
      setAwaitingOracle(true);

      const POLL_INTERVAL_MS = 5_000;
      const POLL_TIMEOUT_MS = 120_000;
      const startedAt = Date.now();

      const poll = async (): Promise<void> => {
        // Bypass wagmi cache: read directly from chain, same pattern as dashboard's handleRevealBalance
        const freshHistory = publicClient
          ? await publicClient.readContract({
              address: FUNDME_PLATFORM_ADDRESS,
              abi: PLATFORM_ABI,
              functionName: 'getLeaderboardHistory',
              args: [BigInt(projectId)],
            }) as readonly string[]
          : [];
        const newCount = freshHistory.length;
        if (newCount > previousHashCount) {
          // Sync all dependent reads so panels update without a manual page refresh.
          await Promise.all([
            refetchLeaderboard(),
            refetchProject(),
            refetchTopKSponsorsSet(),
            refetchAuctionWinner(),
            refetchIsTopKSponsor(),
            refetchHasClaimed(),
            refetchHasWithdrawn(),
          ]);
          setAwaitingOracle(false);
          return;
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setAwaitingOracle(false);
          setRefreshError('Oracle has not responded yet. The leaderboard will appear once it does — try refreshing the page in a moment.');
          // Still sync wagmi so any previously-published hashes become visible
          await Promise.all([
            refetchLeaderboard(),
            refetchProject(),
            refetchTopKSponsorsSet(),
            refetchAuctionWinner(),
            refetchIsTopKSponsor(),
            refetchHasClaimed(),
            refetchHasWithdrawn(),
          ]);
          return;
        }
        await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
        return poll();
      };

      await poll();
    } catch (err) {
      setAwaitingOracle(false);
      if (isUserRejection(err)) return;
      setRefreshError(
        isUnderpricedGasError(err)
          ? 'Base fee too high — retry with Aggressive gas.'
          : err instanceof Error
            ? err.message.slice(0, 200)
            : 'Leaderboard refresh failed.',
      );
    } finally {
      setIsRefreshing(false);
      setAwaitingOracle(false);
    }
  };

  const cooldownRemaining = useMemo(() => {
    if (!project || !project.leaderboardCooldown) return 0;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const next = project.lastRevealTimestamp + project.leaderboardCooldown;
    return next > now ? Number(next - now) : 0;
  }, [project]);

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const winnerIsSet =
    (!!auctionWinnerAddress && (auctionWinnerAddress as string) !== ZERO_ADDRESS) ||
    !!topKSponsorsSet;
  const isAuctionWinner =
    !!address &&
    !!auctionWinnerAddress &&
    (auctionWinnerAddress as string) !== ZERO_ADDRESS &&
    (auctionWinnerAddress as string).toLowerCase() === address.toLowerCase();
  
  const canClaimRefund =
    !!address &&
    !isSponsoree &&
    !!project?.isFinalized &&
    !!topKSponsorsSet &&
    !isTopKSponsor &&
    !hasClaimedRefund;

  // --- Auction: withdraw winner funds (sponsoree) -----------------------

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const { data: hasWithdrawnOnChain, refetch: refetchHasWithdrawn } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'projectWithdrawn',
    args: isValidId ? [BigInt(projectId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: isValidId },
  });
  const hasWithdrawn = !!hasWithdrawnOnChain;

  const handleWithdrawFunds = async () => {
    if (!project || !isSponsoree || isWithdrawing) return;
    setWithdrawError(null);
    setWithdrawSuccess(null);
    try {
      setIsWithdrawing(true);
      const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
      const txHash = await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'withdrawProjectFunds',
        args: [BigInt(projectId)],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain.');
      }
      setWithdrawSuccess('Funds withdrawn to your wallet.');
      await Promise.all([
        refetchProject(),
        refetchAuctionWinner(),
        refetchTopKSponsorsSet(),
        refetchHasWithdrawn(),
      ]);
    } catch (err) {
      if (isUserRejection(err)) return;
      setWithdrawError(
        err instanceof Error ? err.message.slice(0, 200) : 'Withdrawal failed.',
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // --- Auction: claim refund (non-winners) ------------------------------

  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [claimRefundError, setClaimRefundError] = useState<string | null>(null);
  const [claimRefundSuccess, setClaimRefundSuccess] = useState<string | null>(null);

  const handleClaimRefund = async () => {
    if (!canClaimRefund || isClaimingRefund) return;
    setClaimRefundError(null);
    setClaimRefundSuccess(null);
    try {
      setIsClaimingRefund(true);
      const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
      const txHash = await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'claimRefund',
        args: [BigInt(projectId)],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain.');
      }
      setClaimRefundSuccess('Refund claimed — your contribution has been returned.');
      await Promise.all([
        refetchHasClaimed(),
        refetchIsTopKSponsor(),
      ]);
    } catch (err) {
      if (isUserRejection(err)) return;
      setClaimRefundError(
        err instanceof Error ? err.message.slice(0, 200) : 'Refund claim failed.',
      );
    } finally {
      setIsClaimingRefund(false);
    }
  };

  // --- Render -----------------------------------------------------------

  if (!mounted) return null;

  if (!isValidId) {
    return (
      <div className="min-h-screen pt-12 pb-12 px-6 flex justify-center items-center">
        <div className="text-center bg-neutral-900/50 p-12 rounded-3xl border border-neutral-800 max-w-md">
          <h2 className="text-2xl font-bold mb-2">Invalid campaign id</h2>
          <p className="text-neutral-400 mb-6 text-sm">
            &quot;{id}&quot; doesn&apos;t look like a valid project number.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All campaigns
      </Link>

      {projectLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-neutral-900/60 rounded-3xl" />
          <div className="h-64 bg-neutral-900/40 rounded-3xl" />
        </div>
      ) : projectError || isProjectMissing ? (
        <div className="bg-neutral-900/40 border border-red-900/40 rounded-3xl p-10 text-center">
          <h2 className="text-xl font-semibold mb-2">Campaign #{projectId} not found</h2>
          <p className="text-neutral-500 text-sm">
            {projectError?.message.slice(0, 160) ??
              'This project id has never been created on-chain.'}
          </p>
        </div>
      ) : project ? (
        <>
          {/* Header */}
          <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 mb-8">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-8">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-4">
                  <Lock className="w-3 h-3" /> Confidential campaign
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  {project.title || `Campaign #${projectId}`}
                </h1>
                {project.description && (
                  <p className="text-neutral-400 text-base leading-relaxed break-words">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-neutral-800/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
                    <Crown className="w-3 h-3" /> Creator
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-mono text-neutral-300 truncate">
                      <AddressLink address={project.sponsoree} shorten={false} />
                    </p>
                    {isSponsoree && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] whitespace-nowrap">
                        that&apos;s you
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                  <Stat
                    icon={<Clock className="w-4 h-4" />}
                    label={countdown.ended ? 'Status' : 'Time left'}
                    value={
                      project.isFinalized
                        ? 'Finalized'
                        : countdown.ended
                          ? 'Awaiting reveal'
                          : countdown.label
                    }
                    tone={
                      project.isFinalized
                        ? 'emerald'
                        : countdown.ended
                          ? 'amber'
                          : 'indigo'
                    }
                  />
                  {project.isAuction ? (
                    <Stat
                      icon={<Zap className="w-4 h-4" />}
                      label="Mode"
                      value="Auction"
                      tone="amber"
                    />
                  ) : (
                    <Stat
                      icon={<Trophy className="w-4 h-4" />}
                      label="Top K"
                      value={String(project.topKLimit)}
                    />
                  )}
                  <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-3 min-w-[110px]">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                      <ShieldCheck className="w-4 h-4" /> Identity
                    </div>
                    <VerifiedBadge reclaimProofId={project.reclaimProofId} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: sponsor panel + (if sponsoree) admin */}
            <div className="lg:col-span-1 space-y-6">
              {!countdown.ended && !project.isFinalized && !isSponsoree && (
                <SponsorPanel
                  amount={amount}
                  setAmount={setAmount}
                  needsAuthorize={!isOperator}
                  sponsorStep={sponsorStep}
                  onSponsorFlow={handleSponsorFlow}
                  addressConnected={!!address}
                  sponsorError={sponsorError}
                  sponsorSuccess={sponsorSuccess}
                  isAuction={project.isAuction}
                  minBidAmount={project.minBidAmount}
                />
              )}

              {isSponsoree && (
                <SponsoreePanel
                  isFinalized={project.isFinalized}
                  countdownEnded={countdown.ended}
                  cooldownRemaining={cooldownRemaining}
                  isRefreshing={isRefreshing}
                  awaitingOracle={awaitingOracle}
                  onRefresh={handleRefreshLeaderboard}
                  error={refreshError}
                />
              )}

              {/* Sponsoree: withdraw panel (after finalization/deadline) */}
              {isSponsoree && (project.isFinalized || (countdown.ended && project.isAuction)) && (
                <StandardWithdrawPanel
                  isFinalized={!!topKSponsorsSet}
                  isWithdrawing={isWithdrawing}
                  onWithdraw={handleWithdrawFunds}
                  error={withdrawError}
                  success={withdrawSuccess}
                  hasWithdrawn={hasWithdrawn}
                  isAuction={project.isAuction}
                />
              )}

              {/* Non-top-K sponsor: refund panel */}
              {!isSponsoree && (project.isFinalized || project.isAuction) && (
                <RefundPanel
                  isTopKSponsor={!!isTopKSponsor}
                  canClaimRefund={canClaimRefund}
                  hasClaimedRefund={!!hasClaimedRefund}
                  isClaimingRefund={isClaimingRefund}
                  onClaim={handleClaimRefund}
                  error={claimRefundError}
                  success={claimRefundSuccess}
                  winnersSet={!!topKSponsorsSet}
                  isConnected={!!address}
                  isAuction={project.isAuction}
                />
              )}

              {!isSponsoree && countdown.ended && !project.isFinalized && (
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6">
                  <div className="flex items-center gap-2 text-neutral-400 text-sm">
                    <Clock className="w-4 h-4" />
                    Sponsorship window closed. Wait for the creator to trigger the final reveal.
                  </div>
                </div>
              )}
            </div>

            {/* Right: leaderboard */}
            <div className="lg:col-span-2">
              <LeaderboardPanel
                loading={leaderboardLoading}
                awaitingOracle={awaitingOracle}
                error={leaderboardFetchError}
                hash={latestLeaderboardHash}
                payload={leaderboard}
                historyCount={leaderboardHistory ? (leaderboardHistory as readonly string[]).length : 0}
                topKLimit={project.topKLimit}
                currentAddress={address}
                isFinalized={project.isFinalized}
                isAuction={project.isAuction}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// --- Small presentational components ------------------------------------

function Stat({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'indigo' | 'emerald' | 'amber';
}) {
  const toneClass = {
    neutral: 'text-neutral-200',
    indigo: 'text-indigo-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
  }[tone];
  return (
    <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-3 min-w-[110px]">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
        {icon}
        {label}
      </div>
      <p className={`font-semibold text-sm ${toneClass}`}>{value}</p>
    </div>
  );
}

function SponsorPanel(props: {
  amount: string;
  setAmount: (v: string) => void;
  needsAuthorize: boolean;
  sponsorStep: 'idle' | 'authorizing' | 'sponsoring';
  onSponsorFlow: () => void;
  addressConnected: boolean;
  sponsorError: string | null;
  sponsorSuccess: string | null;
  isAuction?: boolean;
  minBidAmount?: bigint;
}) {
  const minBidHuman =
    props.isAuction && props.minBidAmount && props.minBidAmount > 0n
      ? (Number(props.minBidAmount) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
      : null;
  const busy = props.sponsorStep !== 'idle';

  const buttonLabel = () => {
    if (props.sponsorStep === 'authorizing') {
      return (
        <>
          <div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
          Authorizing… (1 of 2)
        </>
      );
    }
    if (props.sponsorStep === 'sponsoring') {
      return (
        <>
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Encrypting & sending…
        </>
      );
    }
    if (props.needsAuthorize) {
      return (
        <>
          <ShieldCheck className="w-4 h-4" /> {props.isAuction ? 'Authorize & Bid' : 'Authorize & Sponsor'}
        </>
      );
    }
    return (
      <>
        <Upload className="w-4 h-4" /> {props.isAuction ? 'Place Confidential Bid' : 'Send Confidential Sponsorship'}
      </>
    );
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-6 flex items-center gap-2 relative z-10">
        <Send className="w-4 h-4" /> {props.isAuction ? 'Bid' : 'Sponsor'} confidentially
      </h3>

      {!props.addressConnected ? (
        <p className="text-neutral-500 text-sm">
          Connect your wallet to {props.isAuction ? 'bid on' : 'sponsor'} this campaign.
        </p>
      ) : (
        <div className="relative z-10">
          {minBidHuman && (
            <div className="mb-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <Zap className="w-3 h-3 shrink-0" />
              Minimum bid: <span className="font-mono font-semibold">{minBidHuman} FUNDME</span>
            </div>
          )}
          <label className="text-xs text-neutral-400 mb-2 block">
            {props.isAuction ? 'Bid amount' : 'Amount'} (FUNDME)
          </label>
          <div className="relative mb-4">
            <input
              type="number"
              min="0"
              step="0.01"
              value={props.amount}
              onChange={(e) => props.setAmount(e.target.value)}
              placeholder="0.00"
              disabled={busy}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-neutral-700 disabled:opacity-50"
            />
            <span className="absolute right-4 top-3.5 text-neutral-500 text-xs font-semibold">
              FUNDME
            </span>
          </div>

          <button
            onClick={props.onSponsorFlow}
            disabled={busy || !props.amount}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {buttonLabel()}
          </button>

          {props.needsAuthorize && !busy && (
            <p className="mt-2 text-[11px] text-neutral-500 text-center">
              Two wallet confirmations required (authorize, then {props.isAuction ? 'bid' : 'sponsor'}).
            </p>
          )}

          {props.sponsorError && (
            <p className="mt-3 text-xs text-red-400 break-words">{props.sponsorError}</p>
          )}
          {props.sponsorSuccess && (
            <p className="mt-3 text-xs text-emerald-400">{props.sponsorSuccess}</p>
          )}

          <p className="text-xs text-center text-neutral-500 mt-4">
            Your amount is encrypted off-chain by Nox before it ever leaves your
            browser. Only the creator can decrypt it.
          </p>
        </div>
      )}
    </div>
  );
}

function SponsoreePanel(props: {
  isFinalized: boolean;
  countdownEnded: boolean;
  cooldownRemaining: number;
  isRefreshing: boolean;
  awaitingOracle: boolean;
  onRefresh: (isFinalReveal: boolean) => void;
  error: string | null;
}) {
  const cooldownHours = Math.floor(props.cooldownRemaining / 3600);
  const cooldownMinutes = Math.floor((props.cooldownRemaining % 3600) / 60);
  const cooldownSeconds = props.cooldownRemaining % 60;
  const canIntermediate = !props.countdownEnded && props.cooldownRemaining === 0;
  const canFinalize = props.countdownEnded && !props.isFinalized;
  const busy = props.isRefreshing || props.awaitingOracle;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6">
      <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Crown className="w-4 h-4" /> Creator controls
      </h3>

      {props.isFinalized ? (
        <p className="text-sm text-neutral-300">
          This campaign is finalized. Final leaderboard is published below.
        </p>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => props.onRefresh(false)}
            disabled={!canIntermediate || busy}
            className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${props.awaitingOracle ? 'animate-spin' : ''}`} />
            {props.awaitingOracle
              ? 'Waiting for oracle…'
              : canIntermediate
                ? 'Refresh leaderboard'
                : props.countdownEnded
                  ? 'Use final reveal below'
                  : cooldownHours > 0
                      ? `Cooldown ${cooldownHours}h ${cooldownMinutes}m`
                      : cooldownMinutes > 0
                        ? `Cooldown ${cooldownMinutes}m ${cooldownSeconds}s`
                        : `Cooldown ${cooldownSeconds}s`}
          </button>

          <button
            onClick={() => props.onRefresh(true)}
            disabled={!canFinalize || busy}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4" />
            {props.awaitingOracle ? 'Waiting for oracle…' : 'Trigger final reveal'}
          </button>
        </div>
      )}

      {props.error && (
        <p className="mt-3 text-xs text-red-400 break-words">{props.error}</p>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Refresh calls signal the TEE oracle to recompute the ranking from encrypted
        balances. Intermediate refreshes are rate-limited.
      </p>
    </div>
  );
}

function LeaderboardPanel(props: {
  loading: boolean;
  awaitingOracle: boolean;
  error: string | null;
  hash: string | null;
  payload: LeaderboardPayload | null;
  historyCount: number;
  topKLimit: number;
  currentAddress?: `0x${string}`;
  isFinalized: boolean;
  isAuction: boolean;
}) {
  const isFinal = props.isFinalized || !!props.payload?.isFinal;
  const isAuction = props.isAuction || !!props.payload?.isAuction;
  return (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Leaderboard
            {isFinal && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
                Final
              </span>
            )}
            {isAuction && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-600/15 text-amber-400 border border-amber-600/20">
                Auction
              </span>
            )}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            {isAuction
              ? isFinal
                ? 'Auction complete. The top bidder wins; all others receive refunds.'
                : 'Auction in progress. The highest bidder at close wins.'
              : isFinal
                ? 'Campaign complete. The top-K sponsors contributions have been awarded; others can claim refunds.'
                : 'Rankings published by the TEE oracle. Amounts stay secret to protect donor privacy.'}
          </p>
        </div>
        <div className="text-xs text-neutral-500 text-right">
          <p>Revision #{props.historyCount}</p>
          {props.hash && (
            <p className="font-mono text-[10px] mt-1 truncate max-w-[160px]">
              {props.hash.slice(0, 14)}…
            </p>
          )}
        </div>
      </div>

      {props.awaitingOracle && (
        <div className="flex items-center gap-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-4">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          Waiting for the TEE oracle to compute the ranking…
        </div>
      )}
      {!props.hash ? (
        !props.awaitingOracle && (
          <EmptyState
            icon={<Clock className="w-6 h-6" />}
            title="No leaderboard yet"
            body="The creator hasn't triggered a reveal. Once they do, the TEE oracle will publish ranked positions to IPFS."
          />
        )
      ) : props.loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-neutral-950/60 border border-neutral-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : props.error ? (
        <EmptyState
          icon={<Flame className="w-6 h-6 text-red-400" />}
          title="Couldn't load leaderboard"
          body={props.error}
        />
      ) : !props.payload ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="Parsing leaderboard…"
          body="IPFS fetch returned an unexpected payload."
        />
      ) : (
        <div className="space-y-2">
          {props.payload.entries.slice(0, props.topKLimit).map((entry) => {
            const isMe =
              props.currentAddress &&
              entry.sponsor.toLowerCase() === props.currentAddress.toLowerCase();
            const isWinner = isFinal && (isAuction ? entry.rank === 1 : entry.rank <= props.topKLimit);
            return (              <div
                key={`${entry.rank}-${entry.sponsor}`}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                  isWinner
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : isMe
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono flex-shrink-0 ${
                      entry.rank === 1
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                        : entry.rank === 2
                          ? 'bg-neutral-300/10 text-neutral-200 border border-neutral-500/20'
                          : entry.rank === 3
                            ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20'
                            : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    {entry.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-neutral-200 break-all">
                      <AddressLink address={entry.sponsor} shorten={false} />
                    </p>
                    {isWinner && (
                      <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                        winner
                      </p>
                    )}
                    {/* {isMe && !isWinner && (
                      <p className="text-[10px] uppercase tracking-wider text-indigo-400">
                        that&apos;s you
                      </p>
                    )}
                    {isMe && isWinner && (
                      <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                        winner — that&apos;s you!
                      </p>
                    )} */}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> amount secret
                  </span>
                </div>
              </div>
            );
          })}

          {props.payload.entries.length === 0 && (
            <EmptyState
              icon={<Clock className="w-6 h-6" />}
              title="No sponsors yet"
              body="Be the first to sponsor this campaign."
            />
          )}
        </div>
      )}
    </div>
  );
}

function StandardWithdrawPanel(props: {
  isFinalized: boolean;
  isWithdrawing: boolean;
  onWithdraw: () => void;
  error: string | null;
  success: string | null;
  hasWithdrawn: boolean;
  isAuction?: boolean;
}) {
  return (
    <div className={`${props.isAuction ? 'bg-amber-500/5 border-amber-500/20' : 'bg-indigo-500/5 border-indigo-500/20'} border rounded-3xl p-6`}>
      <h3 className={`text-sm font-semibold ${props.isAuction ? 'text-amber-300' : 'text-indigo-300'} uppercase tracking-wider mb-4 flex items-center gap-2`}>
        {props.isAuction ? <Zap className="w-4 h-4" /> : <Download className="w-4 h-4" />} 
        Withdraw {props.isAuction ? 'auction' : 'campaign'} funds
      </h3>
      {props.hasWithdrawn || !!props.success ? (
        <p className="text-sm text-emerald-400">
          {props.success ?? 'Funds withdrawn to your wallet.'}
        </p>
      ) : !props.isFinalized ? (
        <p className="text-sm text-neutral-400">
          Waiting for the oracle to finalize the results. This happens automatically after the final reveal.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">
            The campaign is finalized. You can now withdraw the {props.isAuction ? 'winning bid' : 'top-K contributions'} to your wallet.
          </p>
          <button
            onClick={props.onWithdraw}
            disabled={props.isWithdrawing}
            className={`w-full py-3 rounded-xl ${props.isAuction ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors`}
          >
            {props.isWithdrawing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Withdrawing…
              </>
            ) : (
              'Withdraw Funds'
            )}
          </button>
        </div>
      )}
      {props.error && <p className="mt-3 text-xs text-red-400 break-words">{props.error}</p>}
    </div>
  );
}

function RefundPanel(props: {
  isTopKSponsor: boolean;
  canClaimRefund: boolean;
  hasClaimedRefund: boolean;
  isClaimingRefund: boolean;
  onClaim: () => void;
  error: string | null;
  success: string | null;
  winnersSet: boolean;
  isConnected: boolean;
  isAuction?: boolean;
}) {
  if (!props.isConnected) {
    return (
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6">
        <p className="text-sm text-neutral-400">Connect your wallet to check your refund status.</p>
      </div>
    );
  }

  if (props.isTopKSponsor && props.winnersSet) {
    return (
      <div className={`${props.isAuction ? 'bg-amber-500/5 border-amber-500/20' : 'bg-indigo-500/5 border-indigo-500/20'} border rounded-3xl p-6`}>
        <h3 className={`text-sm font-semibold ${props.isAuction ? 'text-amber-300' : 'text-indigo-300'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
          <Trophy className="w-4 h-4" /> {props.isAuction ? 'You won the auction!' : 'You are a top sponsor!'}
        </h3>
        <p className="text-sm text-neutral-300">
          {props.isAuction 
            ? 'Your bid was the highest. Your contribution has been awarded to the campaign creator.'
            : 'Your contribution is among the top-K and has been awarded to the campaign creator.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6">
      <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <RefreshCw className="w-4 h-4" /> {props.isAuction ? 'Auction' : 'Sponsorship'} refund
      </h3>
      {props.hasClaimedRefund || !!props.success ? (
        <p className="text-sm text-emerald-400">
          {props.success ?? 'Refund already claimed — your contribution has been returned.'}
        </p>
      ) : !props.winnersSet ? (
        <p className="text-sm text-neutral-400">
          Waiting for the oracle to finalize the results before refunds open.
        </p>
      ) : props.canClaimRefund ? (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">
            {props.isAuction 
              ? 'You did not win this auction. Claim your contribution back.'
              : 'You are not among the top-K sponsors. Claim your contribution back.'}
          </p>
          <button
            onClick={props.onClaim}
            disabled={props.isClaimingRefund}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {props.isClaimingRefund ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Claiming…
              </>
            ) : (
              'Claim Your Refund'
            )}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">
          You did not sponsor this project, or your refund is not available.
        </p>
      )}
      {props.error && <p className="mt-3 text-xs text-red-400 break-words">{props.error}</p>}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center py-10 border border-dashed border-neutral-800 rounded-2xl bg-neutral-950/30">
      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mx-auto mb-3">
        {icon}
      </div>
      <h4 className="font-semibold text-neutral-200 mb-1">{title}</h4>
      <p className="text-xs text-neutral-500 px-8">{body}</p>
    </div>
  );
}
