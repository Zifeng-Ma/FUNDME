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
  Lock,
  Download,
  RefreshCw,
  Send,
  ShieldCheck,
  Trophy,
  Upload,
  Zap,
  Activity,
  Terminal,
  Cpu,
  ChevronRight,
  Eye
} from 'lucide-react';
import { motion } from "framer-motion";
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

// Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
} as const;

// --- Helpers -------------------------------------------------------------

function useCountdown(deadline?: bigint) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return { ended: false, label: '—', totalSeconds: 0 };
  const diff = Number(deadline) - now;
  if (diff <= 0) return { ended: true, label: 'ENDED', totalSeconds: 0 };
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const label = d > 0 ? `${d}D ${h}H ${m}M` : h > 0 ? `${h}H ${m}M ${s}S` : `${m}M ${s}S`;
  return { ended: false, label, totalSeconds: diff };
}

// --- Page ---------------------------------------------------------------

export default function ProjectDetailPage({
  params,
}: {
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

    if (latestLeaderboardHash.startsWith('QmMock')) {
      setLeaderboardFetchError(
        'Oracle is running in mock mode. Check oracle configuration.',
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
      if (!isOperator) {
        setSponsorStep('authorizing');
        const untilSeconds = Number(project.deadline) + 60;
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
        await new Promise((res) => setTimeout(res, 5_000));
      }

      setSponsorStep('sponsoring');
      const valueInUnits = parseUnits(amount, USDC_DECIMALS);
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

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: sponsorTxHash });
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted on-chain.');
        }
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
          ? "Base fee too high — retry with Aggressive gas setting."
          : err instanceof Error
            ? err.message.slice(0, 200)
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
      await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'requestLeaderboardRefresh',
        args: [BigInt(projectId), isFinalReveal],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      await refetchProject();

      const previousHashCount = (leaderboardHistory as readonly string[] | undefined)?.length ?? 0;
      setIsRefreshing(false);
      setAwaitingOracle(true);

      const POLL_INTERVAL_MS = 5_000;
      const POLL_TIMEOUT_MS = 120_000;
      const startedAt = Date.now();

      const poll = async (): Promise<void> => {
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
          setRefreshError('Oracle delay. Wait a few seconds.');
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
        isUnderpricedGasError(err) ? 'Base fee too high.' : 'Leaderboard refresh failed.',
      );
    } finally {
      setIsRefreshing(false);
      setAwaitingOracle(false);
    }
  };

  const cooldownDeadline = useMemo(() => {
    if (!project || !project.leaderboardCooldown) return undefined;
    return project.lastRevealTimestamp + project.leaderboardCooldown;
  }, [project?.lastRevealTimestamp, project?.leaderboardCooldown]);

  const cooldownCountdown = useCountdown(cooldownDeadline);
  const cooldownRemaining = cooldownCountdown.totalSeconds;

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
      await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'withdrawProjectFunds',
        args: [BigInt(projectId)],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      setWithdrawSuccess('Funds withdrawn to your wallet.');
      await Promise.all([
        refetchProject(),
        refetchAuctionWinner(),
        refetchTopKSponsorsSet(),
        refetchHasWithdrawn(),
      ]);
    } catch (err) {
      if (isUserRejection(err)) return;
      setWithdrawError('Withdrawal failed.');
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
      await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'claimRefund',
        args: [BigInt(projectId)],
        chainId: CHAIN_ID,
        ...gasOverride,
      });
      setClaimRefundSuccess('Refund claimed.');
      await Promise.all([
        refetchHasClaimed(),
        refetchIsTopKSponsor(),
      ]);
    } catch (err) {
      if (isUserRejection(err)) return;
      setClaimRefundError('Refund claim failed.');
    } finally {
      setIsClaimingRefund(false);
    }
  };

  // --- Render -----------------------------------------------------------

  if (!mounted) return <div className="min-h-screen bg-black" />;

  if (!isValidId) {
    return (
      <div className="min-h-screen pt-24 px-6 flex justify-center items-center bg-black">
        <motion.div 
          {...fadeInUp}
          className="text-center bg-[#050505] p-12 border border-blue-500/20 max-w-md"
        >
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Invalid Node ID</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase mb-8">
            Node_{id} is not registered on-chain.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-4 border border-blue-500/40 text-blue-400 font-black uppercase tracking-tighter hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to network
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <InfiniteDataStream text={`[CAMPAIGN_NODE_${projectId.toString().padStart(4, '0')}] —— ENCRYPTED_STATE_MONITOR —— TEE_ATTESTATION_ACTIVE —— `} color="blue" />
      
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[10px] font-mono text-neutral-500 hover:text-blue-400 mb-12 uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All campaigns
        </Link>

        {projectLoading ? (
          <div className="animate-pulse space-y-8">
            <div className="h-40 bg-[#050505] border border-blue-500/10" />
            <div className="grid lg:grid-cols-3 gap-8">
               <div className="h-64 bg-[#050505] border border-blue-500/10" />
               <div className="lg:col-span-2 h-96 bg-[#050505] border border-blue-500/10" />
            </div>
          </div>
        ) : projectError || isProjectMissing ? (
          <motion.div 
            {...fadeInUp}
            className="bg-[#050505] border border-red-500/20 p-20 text-center"
          >
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Node Not Found</h2>
            <p className="text-neutral-500 font-mono text-xs uppercase">
              {projectError?.message.slice(0, 160) ?? 'This project id has never been created on-chain.'}
            </p>
          </motion.div>
        ) : project ? (
          <>
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#050505] border border-blue-500/20 p-8 mb-12 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Cpu className="w-32 h-32 text-blue-500" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 text-blue-400 font-mono text-xs mb-6 tracking-[0.3em] uppercase">
                  <Lock className="w-4 h-4" />
                  <span>Confidential Node</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase mb-6 leading-none">
                  {project.title || `Campaign_${projectId}`}
                </h1>
                {project.description && (
                  <p className="text-neutral-500 font-mono text-sm uppercase max-w-3xl mb-10 leading-tight">
                    {project.description}
                  </p>
                )}
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-8 border-t border-blue-500/10">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-blue-500/40 uppercase mb-2 tracking-widest">Initialization_Creator</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-white truncate">
                        <AddressLink address={project.sponsoree} shorten={false} />
                      </span>
                      {isSponsoree && (
                        <span className="text-[9px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 uppercase">OWNER</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 shrink-0">
                    <Stat
                      icon={<Clock className="w-4 h-4" />}
                      label={countdown.ended ? 'State' : 'Time_Remaining'}
                      value={
                        project.isFinalized
                          ? 'FINALIZED'
                          : countdown.ended
                            ? 'DECRYPTING'
                            : countdown.label
                      }
                      active={!countdown.ended && !project.isFinalized}
                    />
                    {project.isAuction ? (
                      <Stat
                        icon={<Zap className="w-4 h-4" />}
                        label="Mode"
                        value="AUCTION"
                        highlight="amber"
                      />
                    ) : (
                      <Stat
                        icon={<Trophy className="w-4 h-4" />}
                        label="Top_K"
                        value={`${project.topKLimit}_SPOTS`}
                      />
                    )}
                    <div className="bg-black border border-blue-500/10 p-4 min-w-[140px]">
                      <p className="text-[9px] font-mono text-neutral-600 uppercase mb-2 tracking-widest">Identity</p>
                      <VerifiedBadge reclaimProofId={project.reclaimProofId} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid lg:grid-cols-12 gap-12">
              {/* Left Column: Actions */}
              <div className="lg:col-span-4 space-y-8">
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
                    cooldownLabel={cooldownCountdown.label}
                    isRefreshing={isRefreshing}
                    awaitingOracle={awaitingOracle}
                    onRefresh={handleRefreshLeaderboard}
                    error={refreshError}
                  />
                )}

                {(isSponsoree && (project.isFinalized || (countdown.ended && project.isAuction))) && (
                  <WithdrawPanel
                    isFinalized={!!topKSponsorsSet}
                    isWithdrawing={isWithdrawing}
                    onWithdraw={handleWithdrawFunds}
                    error={withdrawError}
                    success={withdrawSuccess}
                    hasWithdrawn={hasWithdrawn}
                    isAuction={project.isAuction}
                  />
                )}

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
                  <motion.div {...fadeInUp} className="bg-[#050505] border border-blue-500/10 p-8 font-mono text-[10px] text-neutral-500 uppercase flex items-center gap-3">
                    <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                    <span>Sponsorship window closed. Waiting for owner to reveal state.</span>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Leaderboard */}
              <div className="lg:col-span-8">
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
    </div>
  );
}

// --- Components -----------------------------------------------------------

function Stat({
  icon,
  label,
  value,
  active = false,
  highlight = 'none'
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active?: boolean;
  highlight?: 'none' | 'amber' | 'blue';
}) {
  return (
    <div className="bg-black border border-blue-500/10 p-4 min-w-[140px]">
      <p className="text-[9px] font-mono text-neutral-600 uppercase mb-2 tracking-widest flex items-center gap-2">
        <span className={active ? 'text-blue-500 animate-pulse' : ''}>{icon}</span>
        {label}
      </p>
      <p className={`font-mono text-[10px] font-black uppercase ${
        highlight === 'amber' ? 'text-amber-500' : 
        highlight === 'blue' || active ? 'text-blue-400' : 'text-white'
      }`}>
        {value}
      </p>
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
      ? (Number(props.minBidAmount) / 1e6).toFixed(2)
      : null;
  const busy = props.sponsorStep !== 'idle';

  return (
    <motion.div {...fadeInUp} className="bg-[#050505] border-2 border-blue-500/20 p-1 font-mono">
      <div className="bg-blue-500/10 p-4 border border-blue-500/20 mb-1 flex justify-between items-center">
        <span className="text-blue-500 uppercase text-[10px] font-black tracking-widest">
           {props.isAuction ? 'Place_Bid' : 'Sponsor_Init'}
        </span>
        <Send className="w-3 h-3 text-blue-500" />
      </div>
      
      <div className="p-6 space-y-6">
        {!props.addressConnected ? (
          <p className="text-[10px] text-neutral-500 uppercase text-center py-4">
            Connect wallet to participate in node.
          </p>
        ) : (
          <>
            {minBidHuman && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-500 uppercase tracking-tight">
                * Minimum bid required: {minBidHuman} FUNDME
              </div>
            )}
            <div>
              <label className="text-[9px] font-mono text-neutral-600 mb-2 block uppercase tracking-widest">Input_Amount (FME)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={props.amount}
                  onChange={(e) => props.setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={busy}
                  className="w-full bg-black border border-blue-500/10 py-4 px-4 text-white font-mono text-xl focus:outline-none focus:border-blue-500/50 transition-colors placeholder-neutral-800"
                />
              </div>
            </div>

            <button
              onClick={props.onSponsorFlow}
              disabled={busy || !props.amount}
              className="w-full py-4 bg-blue-500 text-black font-black uppercase tracking-tighter hover:bg-blue-400 disabled:bg-blue-500/10 disabled:text-blue-500/30 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-colors"
            >
              {props.sponsorStep === 'authorizing' ? 'TX_AUTH_1/2' : 
               props.sponsorStep === 'sponsoring' ? 'TX_INIT_2/2' : 
               props.needsAuthorize ? 'AUTH & SEND' : 'SEND_ENCRYPTED'}
            </button>

            {props.sponsorError && (
              <p className="text-[9px] text-red-500 uppercase font-bold">{props.sponsorError}</p>
            )}
            {props.sponsorSuccess && (
              <p className="text-[9px] text-green-500 uppercase font-bold">{props.sponsorSuccess}</p>
            )}

            <div className="pt-4 border-t border-blue-500/5 flex items-start gap-3">
               <Lock className="w-3 h-3 text-blue-500/40 shrink-0 mt-0.5" />
               <p className="text-[8px] text-neutral-600 uppercase leading-tight">
                 Contributions are homomorphically encrypted. Only the iExec Nox TEE can access raw values for ranking.
               </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function SponsoreePanel(props: {
  isFinalized: boolean;
  countdownEnded: boolean;
  cooldownRemaining: number;
  cooldownLabel: string;
  isRefreshing: boolean;
  awaitingOracle: boolean;
  onRefresh: (isFinalReveal: boolean) => void;
  error: string | null;
}) {
  const canIntermediate = !props.countdownEnded && props.cooldownRemaining === 0;
  const canFinalize = props.countdownEnded && !props.isFinalized;
  const busy = props.isRefreshing || props.awaitingOracle;

  return (
    <motion.div {...fadeInUp} className="bg-[#050505] border-2 border-amber-500/20 p-1 font-mono">
      <div className="bg-amber-500/10 p-4 border border-amber-500/20 mb-1 flex justify-between items-center">
        <span className="text-amber-500 uppercase text-[10px] font-black tracking-widest">Creator_Controls</span>
        <Crown className="w-3 h-3 text-amber-500" />
      </div>

      <div className="p-6 space-y-4">
        {props.isFinalized ? (
          <p className="text-[10px] text-amber-500/60 uppercase text-center">Protocol_State: Finalized</p>
        ) : (
          <>
            <button
              onClick={() => props.onRefresh(false)}
              disabled={!canIntermediate || busy}
              className="w-full py-3 border border-amber-500/30 text-amber-500 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500/10 disabled:opacity-20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${props.awaitingOracle ? 'animate-spin' : ''}`} />
              {props.awaitingOracle
                ? 'RECOGNIZING...'
                : props.cooldownRemaining > 0
                ? `COOLDOWN: ${props.cooldownLabel}`
                : 'REFRESH_RANKING'}
            </button>

            <button
              onClick={() => props.onRefresh(true)}
              disabled={!canFinalize || busy}
              className="w-full py-3 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 disabled:opacity-20 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-3 h-3" />
              {props.awaitingOracle ? 'PROCESSING...' : 'FINAL_STATE_REVEAL'}
            </button>
          </>
        )}

        {props.error && (
          <p className="text-[9px] text-red-500 uppercase font-bold">{props.error}</p>
        )}
      </div>
    </motion.div>
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
    <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="bg-[#050505] border border-blue-500/20 p-8 relative">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Leaderboard.</h3>
             {isFinal && <span className="text-[9px] font-mono text-green-500 border border-green-500/30 px-2 py-0.5 uppercase">Final</span>}
             {isAuction && <span className="text-[9px] font-mono text-amber-500 border border-amber-500/30 px-2 py-0.5 uppercase">Auction</span>}
           </div>
           <p className="text-neutral-600 font-mono text-[10px] uppercase max-w-md leading-tight">
             TEE-VERIFIED RANKINGS. ALL CONTRIBUTION AMOUNTS ARE OBFUSCATED VIA ENCLAVE COMPUTATION.
           </p>
        </div>
        <div className="text-right font-mono">
           <p className="text-[9px] text-neutral-600 uppercase mb-1">Revision: #{props.historyCount.toString().padStart(3, '0')}</p>
           {props.hash && (
             <p className="text-[8px] text-blue-500/40 uppercase break-all max-w-[120px] ml-auto">
               HASH: {props.hash.slice(0, 20)}...
             </p>
           )}
        </div>
      </div>

      {props.awaitingOracle && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 flex items-center gap-4 mb-6">
          <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
          <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Enclave_Computation_In_Progress...</span>
        </div>
      )}

      {!props.hash ? (
        !props.awaitingOracle && (
          <EmptyState
            icon={<Clock className="w-8 h-8" />}
            title="NO_DATA_REVEALED"
            body="THE CREATOR HAS NOT TRIGGERED AN ENCLAVE STATE REVEAL YET."
          />
        )
      ) : props.loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-black border border-blue-500/5 animate-pulse" />
          ))}
        </div>
      ) : props.error ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-red-500/40" />}
          title="FETCH_FAILURE"
          body={props.error.toUpperCase()}
        />
      ) : !props.payload ? (
        <EmptyState
          icon={<Clock className="w-8 h-8" />}
          title="PARSING_ERROR"
          body="THE RETURNED STATE PAYLOAD IS MALFORMED."
        />
      ) : (
        <div className="space-y-3">
          {props.payload.entries.slice(0, props.topKLimit).map((entry) => {
            const isMe = props.currentAddress && entry.sponsor.toLowerCase() === props.currentAddress.toLowerCase();
            const isWinner = isFinal && (isAuction ? entry.rank === 1 : entry.rank <= props.topKLimit);
            
            return (
              <div
                key={`${entry.rank}-${entry.sponsor}`}
                className={`p-4 border transition-all flex items-center justify-between group ${
                  isWinner ? 'bg-amber-500/5 border-amber-500/20' : 
                  isMe ? 'bg-blue-500/5 border-blue-500/30' : 
                  'bg-black border-blue-500/10 hover:border-blue-500/30'
                }`}
              >
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  <div className={`w-12 h-12 flex items-center justify-center font-black font-mono text-sm border ${
                    entry.rank === 1 ? 'border-amber-500 text-amber-500' :
                    entry.rank === 2 ? 'border-neutral-400 text-neutral-400' :
                    entry.rank === 3 ? 'border-orange-600 text-orange-600' :
                    'border-blue-500/20 text-blue-500/40'
                  }`}>
                    {entry.rank.toString().padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-mono text-xs break-all ${isWinner ? 'text-white' : 'text-neutral-400'}`}>
                      <AddressLink address={entry.sponsor} shorten={false} />
                    </p>
                    {isWinner && (
                      <div className="flex items-center gap-2 mt-1">
                        <Trophy className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[9px] font-mono text-amber-500 uppercase font-black tracking-widest">Confirmed_Winner</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Lock className="w-3 h-3 text-blue-500/20" />
                  <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-tighter">Amount_Confidential</span>
                </div>
              </div>
            );
          })}

          {props.payload.entries.length === 0 && (
            <EmptyState
              icon={<Activity className="w-8 h-8 text-neutral-800" />}
              title="NULL_SPONSOR_LOG"
              body="NO CONTRIBUTIONS HAVE BEEN DETECTED FOR THIS NODE."
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

function WithdrawPanel(props: {
  isFinalized: boolean;
  isWithdrawing: boolean;
  onWithdraw: () => void;
  error: string | null;
  success: string | null;
  hasWithdrawn: boolean;
  isAuction?: boolean;
}) {
  return (
    <motion.div {...fadeInUp} className={`bg-[#050505] border-2 ${props.isAuction ? 'border-amber-500/20' : 'border-blue-500/20'} p-1 font-mono`}>
      <div className={`${props.isAuction ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20'} p-4 border mb-1 flex justify-between items-center`}>
        <span className={`${props.isAuction ? 'text-amber-500' : 'text-blue-500'} uppercase text-[10px] font-black tracking-widest`}>Asset_Withdrawal</span>
        {props.isAuction ? <Zap className="w-3 h-3 text-amber-500" /> : <Download className="w-3 h-3 text-blue-500" />}
      </div>
      
      <div className="p-6">
        {props.hasWithdrawn || !!props.success ? (
          <p className="text-[10px] text-green-500 uppercase font-bold text-center">Funds_Successfully_Relocated</p>
        ) : !props.isFinalized ? (
          <p className="text-[10px] text-neutral-600 uppercase leading-tight">Waiting for TEE finalization event to open withdrawal bridge.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-[10px] text-neutral-400 uppercase leading-tight">Protocol finalized. bridge open for {props.isAuction ? 'Winning_Bid' : 'Top_K_Pool'}.</p>
            <button
              onClick={props.onWithdraw}
              disabled={props.isWithdrawing}
              className={`w-full py-3 ${props.isAuction ? 'bg-amber-500 text-black' : 'bg-blue-500 text-black'} font-black text-[10px] uppercase tracking-widest hover:opacity-80 disabled:opacity-20 transition-colors flex items-center justify-center gap-2`}
            >
              {props.isWithdrawing ? 'TRANSFERRING...' : 'WITHDRAW_FUNDS'}
            </button>
          </div>
        )}
        {props.error && <p className="mt-3 text-[9px] text-red-500 uppercase font-bold">{props.error}</p>}
      </div>
    </motion.div>
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
  if (!props.isConnected) return null;

  if (props.isTopKSponsor && props.winnersSet) {
    return (
      <motion.div {...fadeInUp} className="bg-amber-500/5 border border-amber-500/20 p-8 font-mono">
        <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> NODE_WINNER_STATUS
        </h3>
        <p className="text-[10px] text-neutral-400 uppercase leading-tight">
          {props.isAuction 
            ? 'Your bid was the highest. contribution processed.'
            : 'You are in the top-K. contribution processed.'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeInUp} className="bg-[#050505] border border-blue-500/20 p-8 font-mono">
      <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <RefreshCw className="w-4 h-4" /> REFUND_INTERFACE
      </h3>
      {props.hasClaimedRefund || !!props.success ? (
        <p className="text-[10px] text-green-500 uppercase font-bold">Bridge_Closed: Refund_Received</p>
      ) : !props.winnersSet ? (
        <p className="text-[10px] text-neutral-600 uppercase leading-tight">Awaiting final reveal to compute refund eligibility.</p>
      ) : props.canClaimRefund ? (
        <div className="space-y-4">
          <p className="text-[10px] text-neutral-400 uppercase leading-tight">Node win status: Negative. bridge open for refund.</p>
          <button
            onClick={props.onClaim}
            disabled={props.isClaimingRefund}
            className="w-full py-3 bg-blue-500 text-black font-black text-[10px] uppercase tracking-widest hover:bg-blue-400 disabled:opacity-20 transition-colors"
          >
            {props.isClaimingRefund ? 'CLAIMING...' : 'CLAIM_REFUND'}
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-neutral-600 uppercase leading-tight">No refundable contribution detected for this node.</p>
      )}
      {props.error && <p className="mt-3 text-[9px] text-red-500 uppercase font-bold">{props.error}</p>}
    </motion.div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="text-center py-20 border border-dashed border-blue-500/10 bg-black flex flex-col items-center">
      <div className="mb-6 opacity-20">{icon}</div>
      <h4 className="font-mono text-sm font-black text-white mb-2 uppercase tracking-widest">{title}</h4>
      <p className="text-[10px] font-mono text-neutral-600 px-12 uppercase">{body}</p>
    </div>
  );
}

function InfiniteDataStream({ text, color }: { text: string, color: 'blue' | 'indigo' }) {
  const textColor = color === 'blue' ? 'text-blue-500/40' : 'text-indigo-500/40';
  const borderColor = color === 'blue' ? 'border-blue-500/10' : 'border-indigo-500/10';
  
  return (
    <div className={`w-full overflow-hidden bg-black border-y ${borderColor} py-1.5 flex whitespace-nowrap`}>
      <motion.div
        className={`font-mono ${textColor} text-[9px] tracking-[0.5em] uppercase flex`}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ ease: "linear", duration: 30, repeat: Infinity }}
      >
        <span>{text.repeat(10)}</span>
        <span>{text.repeat(10)}</span>
      </motion.div>
    </div>
  );
}
