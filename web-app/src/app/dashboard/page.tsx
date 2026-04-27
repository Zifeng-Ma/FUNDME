'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits, parseEventLogs } from 'viem';
import { createViemHandleClient } from '@iexec-nox/handle';
import {
  Eye, EyeOff, ArrowRightLeft, Download, Upload,
  Wallet, Activity, PlusCircle, CheckCircle2, Lock, ShieldAlert, Zap
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
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
  const[isRevealed, setIsRevealed] = useState(false);
  const [revealedBalance, setRevealedBalance] = useState<string | null>(null);
  const [isLoadingNox, setIsLoadingNox] = useState(false);
  const[isDepositing, setIsDepositing] = useState(false);
  const[isWithdrawing, setIsWithdrawing] = useState(false);
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

        // Count sponsors per project
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

      // Wait for the approval to be mined before estimating gas for wrap.
      // Without this, wrap's gas simulation runs against stale state (allowance = 0),
      // causing the wallet to show an absurdly high gas estimate.
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

      // Poll publicDecrypt until the oracle has processed the unwrap.
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


  // ==========================================
  // 7. CONDITIONAL EARLY RETURNS (Must be at bottom)
  // ==========================================
  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-12 px-6 flex justify-center items-center">
        <div className="text-center bg-neutral-900/50 p-12 rounded-3xl border border-neutral-800 shadow-2xl">
          <Wallet className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet Disconnected</h2>
          <p className="text-neutral-400">Please connect your wallet using the navigation bar.</p>
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="min-h-screen pt-12 px-6 flex justify-center items-center">
        <div className="text-center bg-neutral-900/50 p-12 rounded-3xl border border-neutral-800 shadow-2xl max-w-md w-full">
          <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Wrong Network</h2>
          <p className="text-neutral-400 mb-8">This application runs on Arbitrum Sepolia. Please switch networks to continue.</p>
          <button 
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Switch to Arbitrum Sepolia
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 8. MAIN UI RENDER
  // ==========================================
  return (
    <div className="min-h-screen pt-12 pb-24 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">My Dashboard</h1>
        <p className="text-neutral-400">Manage your confidential funds and track your active campaigns.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Tokens */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
             <h3 className="text-sm font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Your Balances</h3>
             
             {/* Public USDC */}
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-400">Public USDC</p>
                    <p className="font-bold text-lg">{usdcBalance !== undefined ? formatUnits(usdcBalance as bigint, USDC_DECIMALS) : '0.00'}</p>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-neutral-800 my-6" />

              {/* Confidential FUNDME */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-400">Confidential FUNDME</p>
                    <p className="font-bold text-2xl tracking-widest text-indigo-400">
                      {isRevealed ? revealedBalance : '***'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => isRevealed ? setIsRevealed(false) : handleRevealBalance()}
                  disabled={isLoadingNox}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors border border-neutral-700 text-neutral-300"
                >
                  {isLoadingNox ? <div className="w-5 h-5 border-2 border-neutral-500 border-t-indigo-500 rounded-full animate-spin" /> : (isRevealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />)}
                </button>
              </div>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6">
            <div className="flex bg-neutral-950 p-1 rounded-xl mb-6 border border-neutral-800">
              <button 
                onClick={() => setActiveTab('deposit')} 
                className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'deposit' ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'}`}
              >
                <Download className="w-4 h-4" /> Deposit
              </button>
              <button 
                onClick={() => setActiveTab('withdraw')} 
                className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'withdraw' ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'}`}
              >
                <Upload className="w-4 h-4" /> Withdraw
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Amount</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-neutral-700"
                  />
                  <span className="absolute right-4 top-3.5 text-neutral-500 text-sm font-semibold">
                    {activeTab === 'deposit' ? 'USDC' : 'FUNDME'}
                  </span>
                </div>
              </div>

              {activeTab === 'deposit' ? (
                <button 
                  onClick={handleDeposit} 
                  disabled={isDepositing || !amount} 
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-all"
                >
                  {isDepositing ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Confirming...</> : 'Wrap to Confidential'}
                </button>
              ) : (
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !amount}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800/40 disabled:cursor-not-allowed border border-neutral-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-all"
                >
                  {withdrawStep === 'unwrapping' ? (
                    <><div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" /> Confirm in wallet... (1/2)</>
                  ) : withdrawStep === 'waiting' ? (
                    <><div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" /> Waiting for oracle...</>
                  ) : withdrawStep === 'finalizing' ? (
                    <><div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" /> Confirm in wallet... (2/2)</>
                  ) : 'Unwrap to USDC'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Projects */}
        <div className="lg:col-span-2 space-y-8">
           {/* Created Projects */}
           <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" /> My Campaigns
                </h3>
                <Link href="/create" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                  <PlusCircle className="w-4 h-4" /> New
                </Link>
              </div>
              <p className="text-xs text-neutral-500 mb-6 italic flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Funds in active campaigns are locked until the deadline and final reveal.
              </p>

              {isLoadingProjects ? (
                <div className="text-center py-8 text-neutral-500"><div className="w-6 h-6 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" /> Loading...</div>
              ) : myCreatedProjects.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">No campaigns created yet.</div>
              ) : (
                <div className="space-y-4">
                  {myCreatedProjects.map(p => (
                    <div key={p.id} className="p-4 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors rounded-2xl flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-semibold mb-1">
                          {p.title || `Campaign #${p.id}`} {p.finalized && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-800">Finalized</span>}
                        </p>
                        {p.description && <p className="text-xs text-neutral-400 mb-2 line-clamp-1">{p.description}</p>}
                        <p className="text-xs text-neutral-500">Deadline: {formatDeadline(p.deadline)} • Top K: {p.topK} • Sponsors: {p.sponsorCount}</p>
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                          {p.isAuction ? 'Highest bid:' : 'Total funded:'}
                          {p.isAuction
                            ? p.highestBid
                              ? <span className="text-indigo-400 font-mono">{p.highestBid} FUNDME</span>
                              : <><Lock className="w-3 h-3 text-indigo-500" /> <span className="text-neutral-400">confidential until reveal</span></>
                            : p.totalFunded
                              ? <span className="text-indigo-400 font-mono">{p.totalFunded} FUNDME</span>
                              : <><Lock className="w-3 h-3 text-indigo-500" /> <span className="text-neutral-400">confidential until reveal</span></>
                          }
                        </p>
                      </div>
                      <Link href={`/project/${p.id}`} className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                        Manage
                      </Link>
                    </div>
                  ))}
                </div>
              )}
           </div>

           {/* Sponsored Projects */}
           <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" /> Sponsored Campaigns
              </h3>

              {isLoadingProjects ? (
                <div className="text-center py-8 text-neutral-500"><div className="w-6 h-6 border-2 border-neutral-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-2" /> Loading...</div>
              ) : mySponsoredProjects.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">No sponsored campaigns yet.</div>
              ) : (
                <div className="space-y-4">
                  {mySponsoredProjects.map(p => (
                    <div key={p.id} className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex justify-between items-center">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-neutral-400 flex-shrink-0">
                          #{p.id}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold mb-1 flex items-center gap-2 flex-wrap">
                            {p.title || `Campaign #${p.id}`}
                            {p.isAuction && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-600/10 text-amber-400 border border-amber-600/20 flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5" /> Auction
                              </span>
                            )}
                            {p.finalized && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-800">Finalized</span>}
                          </p>
                          {p.deadline && (
                            <p className="text-xs text-neutral-500 mb-0.5">Deadline: {formatDeadline(p.deadline)}</p>
                          )}
                          <p className="text-xs text-neutral-500 flex items-center gap-1">
                            Total contributed:
                            {revealedContributions[p.id] != null ? (
                              <span className="text-indigo-400 font-mono">{revealedContributions[p.id]} FUNDME</span>
                            ) : p.contributionHandle ? (
                              <button
                                onClick={() => handleRevealContribution(p.id, p.contributionHandle!)}
                                disabled={revealingContribution[p.id]}
                                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                              >
                                {revealingContribution[p.id]
                                  ? <><div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" /> revealing...</>
                                  : <><Eye className="w-3 h-3" /> reveal</>
                                }
                              </button>
                            ) : (
                              <><Lock className="w-3 h-3 text-indigo-500" /> <span className="text-neutral-400">confidential</span></>
                            )}
                          </p>
                          {p.isAuction && p.finalized && (
                            <p className="text-xs text-amber-400 mt-0.5">
                              Auction ended — check project page to claim refund if applicable.
                            </p>
                          )}
                        </div>
                      </div>
                      <Link href={`/project/${p.id}`} className="px-4 py-2 border border-neutral-700 hover:border-neutral-600 text-neutral-300 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0">
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}