'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits, parseEventLogs } from 'viem';
import { createViemHandleClient } from '@iexec-nox/handle';
import {
  Eye, EyeOff, ArrowRightLeft, Download, Upload,
  Wallet, Activity, PlusCircle, CheckCircle2, Lock, ShieldAlert, Zap, ChevronRight, LayoutDashboard, Database
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from "framer-motion";
import {
  FUNDME_TOKEN_ADDRESS,
  FUNDME_PLATFORM_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  CHAIN_ID,
  WRAPPER_ABI,
  ERC20_ABI,
  PLATFORM_ABI,
  IPFS_GATEWAY,
  IPFS_GATEWAY_FALLBACKS,
  getGasOverride,
  type LeaderboardPayload,
} from '@/lib/contracts';
import { isUnderpricedGasError, isUserRejection } from '@/lib/errors';

// Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
} as const;

type CreatedProject = { id: number; deadline: bigint; topK: number; finalized: boolean; title: string; description: string; sponsorCount: number; totalFunded?: string; highestBid?: string; isAuction: boolean };
type SponsoredProject = { id: number; title?: string; deadline?: bigint; finalized?: boolean; contributionHandle?: `0x${string}`; isAuction?: boolean };

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ==========================================
  // 1. WAGMI & VIEM HOOKS
  // ==========================================
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { data: walletClient } = useWalletClient();

  // ==========================================
  // 2. REACT STATE HOOKS
  // ==========================================
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedBalance, setRevealedBalance] = useState<string | null>(null);
  const [isLoadingNox, setIsLoadingNox] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<'idle' | 'unwrapping' | 'waiting' | 'finalizing'>('idle');
  
  const [myCreatedProjects, setMyCreatedProjects] = useState<CreatedProject[]>([]);
  const [mySponsoredProjects, setMySponsoredProjects] = useState<SponsoredProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [revealedContributions, setRevealedContributions] = useState<Record<number, string>>({});
  const [revealingContribution, setRevealingContribution] = useState<Record<number, boolean>>({});

  // ==========================================
  // 3. MEMOS & DERIVED STATE
  // ==========================================
  const isWrongNetwork = useMemo(() => isConnected && chainId !== CHAIN_ID, [isConnected, chainId]);

  // ==========================================
  // 4. CONTRACT READ HOOKS
  // ==========================================
  const { refetch: refetchEncryptedHandle } = useReadContract({
    address: FUNDME_TOKEN_ADDRESS,
    abi: WRAPPER_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  // ==========================================
  // 5. EFFECT HOOKS (Fetch Projects)
  // ==========================================
  useEffect(() => {
    if (!address || !publicClient || isWrongNetwork) return;
    setIsLoadingProjects(true);

    const fetchLogs = async () => {
      try {
        const [createdLogs, sponsoredLogs, allSponsorshipLogs] = await Promise.all([
          publicClient.getLogs({
            address: FUNDME_PLATFORM_ADDRESS,
            event: PLATFORM_ABI.find(x => x.type === 'event' && x.name === 'ProjectCreated')!,
            args: { sponsoree: address },
            fromBlock: 0n,
          }),
          publicClient.getLogs({
            address: FUNDME_PLATFORM_ADDRESS,
            event: PLATFORM_ABI.find(x => x.type === 'event' && x.name === 'SponsorshipAdded')!,
            args: { sponsor: address },
            fromBlock: 0n,
          }),
          publicClient.getLogs({
            address: FUNDME_PLATFORM_ADDRESS,
            event: PLATFORM_ABI.find(x => x.type === 'event' && x.name === 'SponsorshipAdded')!,
            fromBlock: 0n,
          }),
        ]);

        const sponsorCountMap = new Map<number, number>();
        allSponsorshipLogs.forEach((log) => {
          const projectId = Number(log.args.projectId);
          sponsorCountMap.set(projectId, (sponsorCountMap.get(projectId) ?? 0) + 1);
        });

        const created = await Promise.all(
          createdLogs.map(async (log) => {
            const id = Number(log.args.projectId);
            const [data, history] = await Promise.all([
              publicClient.readContract({
                address: FUNDME_PLATFORM_ADDRESS,
                abi: PLATFORM_ABI,
                functionName: 'projects',
                args: [BigInt(id)],
              }) as Promise<readonly [`0x${string}`, bigint, number, string, boolean, bigint, string, string, boolean, bigint, bigint]>,
              publicClient.readContract({
                address: FUNDME_PLATFORM_ADDRESS,
                abi: PLATFORM_ABI,
                functionName: 'getLeaderboardHistory',
                args: [BigInt(id)],
              }) as Promise<readonly string[]>,
            ]);

            let totalFunded: string | undefined;
            let highestBid: string | undefined;
            if (history.length > 0) {
              const latestHash = history[history.length - 1];
              if (!latestHash.startsWith('QmMock')) {
                for (const gateway of [IPFS_GATEWAY, ...IPFS_GATEWAY_FALLBACKS]) {
                  try {
                    const res = await fetch(`${gateway}${latestHash}`);
                    if (!res.ok) continue;
                    const payload = await res.json() as LeaderboardPayload;
                    if (payload.totalFunded !== undefined) {
                      totalFunded = payload.totalFunded.toFixed(2);
                    }
                    if (payload.highestBid !== undefined) {
                      highestBid = payload.highestBid.toFixed(2);
                    }
                    break;
                  } catch { /* try next gateway */ }
                }
              }
            }

            return { id, deadline: data[1], topK: data[2], finalized: data[4], title: data[6], description: data[7], sponsorCount: sponsorCountMap.get(id) ?? 0, totalFunded, highestBid, isAuction: data[8] };
          })
        );

        const seenIds = new Set<number>();
        const uniqueSponsoredIds: number[] = [];
        sponsoredLogs.forEach((log) => {
          const id = Number(log.args.projectId);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueSponsoredIds.push(id);
          }
        });

        const sponsored = await Promise.all(
          uniqueSponsoredIds.map(async (id) => {
            let deadline: bigint | undefined;
            let finalized: boolean | undefined;
            let title: string | undefined;
            let isAuction: boolean | undefined;
            try {
              const pdata = await publicClient.readContract({
                address: FUNDME_PLATFORM_ADDRESS,
                abi: PLATFORM_ABI,
                functionName: 'projects',
                args: [BigInt(id)],
              }) as readonly [`0x${string}`, bigint, number, string, boolean, bigint, string, string, boolean, bigint, bigint];
              deadline = pdata[1];
              finalized = pdata[4];
              title = pdata[6];
              isAuction = pdata[8];
            } catch { /* ignore */ }
            let contributionHandle: `0x${string}` | undefined;
            try {
              const raw = await publicClient.readContract({
                address: FUNDME_PLATFORM_ADDRESS,
                abi: PLATFORM_ABI,
                functionName: 'getContributionHandle',
                args: [BigInt(id), address],
              }) as `0x${string}`;
              if (raw !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                contributionHandle = raw;
              }
            } catch { /* ignore */ }
            return { id, title, deadline, finalized, contributionHandle, isAuction };
          })
        );

        setMyCreatedProjects(created);
        setMySponsoredProjects(sponsored);
      } catch {
        // silently ignore — UI shows empty state
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchLogs();
  }, [address, publicClient, isWrongNetwork]);

  // ==========================================
  // 6. ACTION HANDLERS
  // ==========================================
  const handleRevealBalance = async () => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Wallet connection issue.');
      return;
    }

    try {
      setIsLoadingNox(true);
      const freshHandle = await publicClient.readContract({
        address: FUNDME_TOKEN_ADDRESS,
        abi: WRAPPER_ABI,
        functionName: 'confidentialBalanceOf',
        args: [address],
      }) as `0x${string}`;

      if (freshHandle === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        setRevealedBalance('0.00');
        setIsRevealed(true);
        return;
      }

      const handleClient = await createViemHandleClient(walletClient as any);
      const { value } = await handleClient.decrypt(freshHandle as any);
      setRevealedBalance(formatUnits(value as bigint, USDC_DECIMALS));
      setIsRevealed(true);
    } catch (error) {
      if (isUserRejection(error)) {
        toast.error('Signature rejected.');
      } else {
        toast.error('Oracle delay. Wait a few seconds and try again.');
      }
    } finally {
      setIsLoadingNox(false);
    }
  };

  const handleRevealContribution = async (projectId: number, handle: `0x${string}`) => {
    if (!walletClient) { toast.error('Wallet connection issue.'); return; }
    setRevealingContribution(prev => ({ ...prev, [projectId]: true }));
    try {
      const handleClient = await createViemHandleClient(walletClient as any);
      const { value } = await handleClient.decrypt(handle as any);
      setRevealedContributions(prev => ({ ...prev, [projectId]: formatUnits(value as bigint, USDC_DECIMALS) }));
    } catch (error) {
      toast.error(isUserRejection(error) ? 'Signature rejected.' : 'Oracle delay. Wait a few seconds and try again.');
    } finally {
      setRevealingContribution(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleDeposit = async () => {
    if (!amount || !address || isDepositing) return;
    setIsDepositing(true);
    try {
      const valueInUnits = parseUnits(amount, USDC_DECIMALS);

      const approveTxHash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [FUNDME_TOKEN_ADDRESS, valueInUnits],
        chainId: CHAIN_ID,
        ...(publicClient ? await getGasOverride(publicClient) : {}),
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

      const wrapTxHash = await writeContractAsync({
        address: FUNDME_TOKEN_ADDRESS,
        abi: WRAPPER_ABI,
        functionName: 'wrap',
        args: [address, valueInUnits],
        chainId: CHAIN_ID,
        ...(publicClient ? await getGasOverride(publicClient) : {}),
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });

      setAmount('');
      await Promise.all([refetchUsdc(), refetchEncryptedHandle()]);
      setIsRevealed(false);
      toast.success('Successfully wrapped USDC into Confidential FUNDME!');
    } catch (err) {
      toast.error(isUnderpricedGasError(err) ? 'Gas too low. Use Aggressive setting.' : 'Deposit failed.');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || !address || !walletClient || isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      const valueInUnits = parseUnits(amount, USDC_DECIMALS);
      const handleClient = await createViemHandleClient(walletClient as any);
      const { handle: encryptedAmount, handleProof: inputProof } = await handleClient.encryptInput(valueInUnits, 'uint256', FUNDME_TOKEN_ADDRESS);

      setWithdrawStep('unwrapping');
      const txHash = await writeContractAsync({
        address: FUNDME_TOKEN_ADDRESS,
        abi: WRAPPER_ABI,
        functionName: 'unwrap',
        args: [address, address, encryptedAmount as `0x${string}`, inputProof as `0x${string}`],
        chainId: CHAIN_ID,
        ...(publicClient ? await getGasOverride(publicClient) : {}),
      });

      let unwrapHandle: `0x${string}` | undefined;
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        const [unwrapLog] = parseEventLogs({ abi: WRAPPER_ABI, eventName: 'UnwrapRequested', logs: receipt.logs });
        unwrapHandle = unwrapLog?.args.amount as `0x${string}` | undefined;
      }

      if (!unwrapHandle) {
        toast.error('Could not find unwrap handle in receipt.');
        return;
      }

      setWithdrawStep('waiting');
      const POLL_INTERVAL_MS = 500;
      const POLL_TIMEOUT_MS = 120_000;
      const startedAt = Date.now();
      let decryptionProof: `0x${string}`;
      while (true) {
        try {
          ({ decryptionProof } = await handleClient.publicDecrypt(unwrapHandle as any));
          break;
        } catch {
          if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
            toast.error('Oracle timed out. Try again in a moment.');
            return;
          }
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
        }
      }

      setWithdrawStep('finalizing');
      const finalizeTxHash = await writeContractAsync({
        address: FUNDME_TOKEN_ADDRESS,
        abi: WRAPPER_ABI,
        functionName: 'finalizeUnwrap',
        args: [unwrapHandle, decryptionProof as `0x${string}`],
        chainId: CHAIN_ID,
        ...(publicClient ? await getGasOverride(publicClient) : {}),
      });

      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: finalizeTxHash });

      setAmount('');
      await Promise.all([refetchUsdc(), refetchEncryptedHandle()]);
      setIsRevealed(false);
      toast.success('Successfully unwrapped to USDC!');
    } catch (err) {
      toast.error(isUnderpricedGasError(err) ? 'Gas too low. Use Aggressive setting.' : 'Withdrawal failed.');
    } finally {
      setIsWithdrawing(false);
      setWithdrawStep('idle');
    }
  };

  const formatDeadline = (deadline: bigint) =>
    new Date(Number(deadline) * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  if (!mounted) return <div className="min-h-screen bg-black" />;

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 px-6 flex justify-center items-center bg-black">
        <motion.div 
          {...fadeInUp}
          className="text-center bg-[#050505] p-12 border border-blue-500/20 max-w-md"
        >
          <Wallet className="w-16 h-16 text-blue-500/40 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Wallet Disconnected</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase mb-8">Please connect your wallet using the navigation bar to access the dashboard.</p>
        </motion.div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="min-h-screen pt-24 px-6 flex justify-center items-center bg-black">
        <motion.div 
          {...fadeInUp}
          className="text-center bg-[#050505] p-12 border border-red-500/20 max-w-md w-full"
        >
          <ShieldAlert className="w-16 h-16 text-red-500/60 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Wrong Network</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase mb-8">This application runs on Arbitrum Sepolia. Please switch networks to continue.</p>
          <button 
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            className="w-full py-4 bg-red-500 text-black font-black uppercase tracking-tighter hover:bg-red-400 transition-colors"
          >
            Switch to Arbitrum Sepolia
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base selection:bg-blue-500/30 text-neutral-200">
      <InfiniteDataStream text="[NOX_DASHBOARD_ACTIVE] —— REAL_TIME_TEE_MONITOR —— ENCRYPTED_VAULT_SYNCHRONIZED —— " color="blue" />
      
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        {/* Dashboard Header */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 text-blue-400 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
            <LayoutDashboard className="w-4 h-4" />
            <span>Confidential Dashboard</span>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column: Tokens & Vault */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div 
              {...fadeInUp}
              className="bg-surface-raised border border-border-strong p-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Database className="w-16 h-16 text-blue-500" />
              </div>
              
              <h3 className="text-[10px] font-mono text-blue-500 mb-8 uppercase tracking-[0.3em]">Encrypted_Vault</h3>
              
              {/* Public USDC */}
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase mb-1">Public USDC</p>
                  <p className="text-2xl font-black text-white tracking-tighter">
                    {usdcBalance !== undefined ? formatUnits(usdcBalance as bigint, USDC_DECIMALS) : '0.00'}
                  </p>
                </div>
                <div className="text-blue-500/40"><Activity className="w-5 h-5" /></div>
              </div>

              <div className="h-px w-full bg-border-subtle mb-8" />

              {/* Confidential FUNDME */}
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-mono text-blue-500 uppercase mb-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Confidential FUNDME
                  </p>
                  <p className="text-4xl font-black text-blue-500 tracking-tighter tabular-nums">
                    {isRevealed ? revealedBalance : '••••••'}
                  </p>
                </div>
                <button
                  onClick={() => isRevealed ? setIsRevealed(false) : handleRevealBalance()}
                  disabled={isLoadingNox}
                  className="w-12 h-12 border border-border-strong flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-black transition-colors bg-surface-overlay"
                >
                  {isLoadingNox ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : (isRevealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />)}
                </button>
              </div>
            </motion.div>

            <motion.div 
              {...fadeInUp}
              transition={{ delay: 0.1 }}
              className="bg-surface-raised border border-border-strong p-1"
            >
              <div className="flex bg-surface-overlay p-1 mb-1">
                <button 
                  onClick={() => setActiveTab('deposit')} 
                  className={`flex-1 py-3 text-[10px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'deposit' ? 'bg-blue-500 text-black' : 'text-neutral-500 hover:text-white'}`}
                >
                  <Download className="w-3 h-3" /> Deposit
                </button>
                <button 
                  onClick={() => setActiveTab('withdraw')} 
                  className={`flex-1 py-3 text-[10px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'withdraw' ? 'bg-blue-500 text-black' : 'text-neutral-500 hover:text-white'}`}
                >
                  <Upload className="w-3 h-3" /> Withdraw
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {activeTab === 'deposit' && (
                  <div className="p-3 bg-green-500/5 border border-green-500/20 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-mono text-green-400 uppercase tracking-widest leading-relaxed">
                      Need test USDC? Get some at <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-300 transition-colors">faucet.circle.com</a>
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[9px] font-mono text-neutral-500 mb-2 block uppercase tracking-widest">Amount_Input</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)} 
                      placeholder="0.00" 
                      className="w-full bg-surface-overlay border border-border-subtle py-4 px-4 text-white font-mono text-xl focus:outline-none focus:border-blue-500/50 transition-colors placeholder-neutral-800"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-blue-500/40 font-black uppercase">
                      {activeTab === 'deposit' ? 'USDC' : 'FME'}
                    </span>
                  </div>
                </div>

                {activeTab === 'deposit' ? (
                  <button 
                    onClick={handleDeposit} 
                    disabled={isDepositing || !amount} 
                    className="w-full py-4 bg-blue-500 text-black font-black uppercase tracking-tighter hover:bg-blue-400 disabled:bg-blue-500/20 disabled:text-blue-500/40 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                  >
                    {isDepositing ? <><div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" /> Finalizing...</> : 'Wrap to Confidential'}
                  </button>
                ) : (
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !amount}
                    className="w-full py-4 border border-blue-500 text-blue-500 font-black uppercase tracking-tighter hover:bg-blue-500/10 disabled:border-blue-500/20 disabled:text-blue-500/40 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                  >
                    {withdrawStep === 'unwrapping' ? (
                      <><div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" /> TX_CONFIRM_1/2</>
                    ) : withdrawStep === 'waiting' ? (
                      <><div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" /> NOX_WAITING</>
                    ) : withdrawStep === 'finalizing' ? (
                      <><div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" /> TX_CONFIRM_2/2</>
                    ) : 'Unwrap to USDC'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column: Projects */}
          <div className="lg:col-span-8 space-y-12">
             {/* Created Projects */}
             <motion.div 
               {...fadeInUp}
               className="bg-surface-raised border border-border-strong p-8 relative"
             >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xs font-mono text-blue-500 mb-2 uppercase tracking-[0.4em]">My Campaigns</h3>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Project_Initiations.</h2>
                  </div>
                  <Link href="/create" className="w-10 h-10 border border-border-strong flex items-center justify-center text-blue-500 hover:bg-blue-500 hover:text-black transition-colors bg-surface-overlay">
                    <PlusCircle className="w-5 h-5" />
                  </Link>
                </div>

                {isLoadingProjects ? (
                  <div className="text-center py-20 font-mono text-blue-500/40 uppercase animate-pulse">Scanning_Network...</div>
                ) : myCreatedProjects.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-border-subtle text-neutral-600 font-mono text-xs uppercase">No active campaigns detected in enclave.</div>
                ) : (
                  <div className="space-y-4">
                    {myCreatedProjects.map(p => (
                      <div key={p.id} className="p-6 border border-border-subtle hover:border-border-strong transition-colors bg-surface-overlay flex justify-between items-center gap-6 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                             <span className="text-[10px] font-mono text-blue-500/40">ID:{p.id.toString().padStart(4, '0')}</span>
                             {p.finalized && <span className="text-[9px] font-mono text-green-500 border border-green-500/30 px-2 py-0.5 uppercase">Finalized</span>}
                             {p.isAuction && <span className="text-[9px] font-mono text-amber-500 border border-amber-500/30 px-2 py-0.5 uppercase">Auction</span>}
                          </div>
                          <h4 className="text-xl font-black text-white tracking-tighter uppercase mb-1 truncate">{p.title || `Unnamed_Campaign`}</h4>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] text-neutral-500 uppercase">
                             <span>Deadline: {formatDeadline(p.deadline)}</span>
                             <span>Sponsors: {p.sponsorCount}</span>
                             <span className="text-blue-500/60 flex items-center gap-1">
                               {p.isAuction ? 'High_Bid:' : 'Total_Funded:'}
                               {p.isAuction
                                 ? p.highestBid
                                   ? <span className="text-blue-500 font-bold">{p.highestBid} FME</span>
                                   : <Lock className="w-2.5 h-2.5" />
                                 : p.totalFunded
                                   ? <span className="text-blue-500 font-bold">{p.totalFunded} FME</span>
                                   : <Lock className="w-2.5 h-2.5" />
                               }
                             </span>
                          </div>
                        </div>
                        <Link href={`/project/${p.id}`} className="px-6 py-3 border border-border-strong text-blue-500 font-mono text-[10px] font-black uppercase tracking-tighter hover:bg-blue-500 hover:text-black transition-colors whitespace-nowrap bg-surface-base">
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
             </motion.div>

             {/* Sponsored Projects */}
             <motion.div 
               {...fadeInUp}
               transition={{ delay: 0.2 }}
               className="bg-surface-raised border border-border-strong p-8"
             >
                <div className="mb-8">
                  <h3 className="text-xs font-mono text-blue-500 mb-2 uppercase tracking-[0.4em]">Active Sponsorships</h3>
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Contribution_Logs.</h2>
                </div>

                {isLoadingProjects ? (
                  <div className="text-center py-20 font-mono text-blue-500/40 uppercase animate-pulse">Decrypting_Logs...</div>
                ) : mySponsoredProjects.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-border-subtle text-neutral-600 font-mono text-xs uppercase">No sponsorship data available.</div>
                ) : (
                  <div className="space-y-4">
                    {mySponsoredProjects.map(p => (
                      <div key={p.id} className="p-6 border border-border-subtle bg-surface-overlay flex justify-between items-center group">
                        <div className="flex items-center gap-6 flex-1 min-w-0">
                          <div className="w-12 h-12 border border-border-subtle flex items-center justify-center font-black text-blue-500/30 font-mono text-sm shrink-0">
                            #{p.id}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="text-lg font-black text-white tracking-tighter uppercase truncate">{p.title || `Campaign_${p.id}`}</h4>
                              {p.isAuction && <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest"><Zap className="w-2 h-2 inline mr-1" />Auction</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] text-neutral-500 uppercase">
                              {p.deadline && <span>Deadline: {formatDeadline(p.deadline)}</span>}
                              <div className="flex items-center gap-2">
                                <span>Contributed:</span>
                                {revealedContributions[p.id] != null ? (
                                  <span className="text-blue-500 font-bold">{revealedContributions[p.id]} FME</span>
                                ) : p.contributionHandle ? (
                                  <button
                                    onClick={() => handleRevealContribution(p.id, p.contributionHandle!)}
                                    disabled={revealingContribution[p.id]}
                                    className="text-blue-500/60 hover:text-blue-500 flex items-center gap-1 transition-colors"
                                  >
                                    {revealingContribution[p.id]
                                      ? <div className="w-2.5 h-2.5 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                                      : <><Eye className="w-2.5 h-2.5" /> [REVEAL]</>
                                    }
                                  </button>
                                ) : (
                                  <Lock className="w-2.5 h-2.5 text-blue-500/20" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Link href={`/project/${p.id}`} className="w-10 h-10 border border-border-subtle flex items-center justify-center text-blue-500/40 hover:text-blue-500 hover:border-border-strong transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
             </motion.div>
          </div>
        </div>
      </div>
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
