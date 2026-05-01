'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { decodeEventLog, parseUnits } from 'viem';
import {
  ArrowLeft,
  Clock,
  FileText,
  Rocket,
  ShieldCheck,
  Trophy,
  Wallet,
  Zap,
  Terminal,
  Cpu,
  ChevronRight,
  Activity
} from 'lucide-react';
import { motion } from "framer-motion";
import {
  CHAIN_ID,
  FUNDME_PLATFORM_ADDRESS,
  PLATFORM_ABI,
  getGasOverride,
} from '@/lib/contracts';
import { isUnderpricedGasError, isUserRejection } from '@/lib/errors';
import { ReclaimVerifier } from '@/components/ReclaimVerifier';

// Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

export default function CreateCampaignPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('10');
  const [cooldownMinutes, setCooldownMinutes] = useState('1');
  const [topK, setTopK] = useState('5');
  const [reclaimProofId, setReclaimProofId] = useState('');
  const [isAuction, setIsAuction] = useState(false);
  const [minBid, setMinBid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (isSubmitting) return;
    setError(null);

    const durationNum = Number(durationMinutes);
    const topKNum = Number(topK);
    const cooldownNum = Number(cooldownMinutes);
    if (!title.trim()) {
      setError('Campaign title is required.');
      return;
    }
    if (!Number.isInteger(durationNum) || durationNum <= 0) {
      setError('Duration must be a positive integer number of minutes.');
      return;
    }
    if (!Number.isInteger(cooldownNum) || cooldownNum < 1) {
      setError('Cooldown must be at least 1 minute.');
      return;
    }
    if (!Number.isInteger(topKNum) || topKNum <= 0 || topKNum > 255) {
      setError('Top K must be an integer between 1 and 255.');
      return;
    }

    try {
      setIsSubmitting(true);
      const gasOverride = publicClient ? await getGasOverride(publicClient) : {};
      const txHash = await writeContractAsync({
        address: FUNDME_PLATFORM_ADDRESS,
        abi: PLATFORM_ABI,
        functionName: 'createProject',
        args: [
          BigInt(durationNum),
          topKNum,
          reclaimProofId,
          title.trim(),
          description.trim(),
          isAuction,
          isAuction && minBid && Number(minBid) > 0
            ? parseUnits(minBid, 6)
            : 0n,
          BigInt(cooldownNum * 60),
        ],
        chainId: CHAIN_ID,
        ...gasOverride,
      });

      let newProjectId: number | null = null;
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== FUNDME_PLATFORM_ADDRESS.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: [
                {
                  type: 'event',
                  name: 'ProjectCreated',
                  inputs: [
                    { name: 'projectId', type: 'uint256', indexed: true },
                    { name: 'sponsoree', type: 'address', indexed: true },
                    { name: 'deadline', type: 'uint256', indexed: false },
                  ],
                },
              ] as const,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'ProjectCreated') {
              newProjectId = Number(decoded.args.projectId);
              break;
            }
          } catch {
            // not our event, keep looking
          }
        }
      }

      if (newProjectId !== null) {
        router.push(`/project/${newProjectId}`);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      if (isUserRejection(err)) {
        setError(null);
        return;
      }
      setError(
        isUnderpricedGasError(err)
          ? 'Base fee too high — retry with MetaMask\'s Aggressive gas setting.'
          : err instanceof Error
            ? err.message.slice(0, 200)
            : 'Failed to create campaign.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 px-6 flex justify-center items-center bg-black">
        <motion.div 
          {...fadeInUp}
          className="text-center bg-[#050505] p-12 border border-blue-500/20 max-w-md"
        >
          <Wallet className="w-16 h-16 text-blue-500/40 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">Connect to create</h2>
          <p className="text-neutral-500 font-mono text-xs uppercase mb-8">
            You need a connected wallet on Arbitrum Sepolia to launch a campaign.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-4 border border-blue-500/40 text-blue-400 font-black uppercase tracking-tighter hover:bg-blue-500/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <InfiniteDataStream text="[NODE_INITIALIZATION] —— PROTOCOL_CREATION_MODE —— TEE_CONFIG_PENDING —— " color="indigo" />
      
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-24">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-[10px] font-mono text-neutral-500 hover:text-blue-400 mb-12 uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All campaigns
        </Link>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 text-indigo-400 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
            <Rocket className="w-4 h-4" />
            <span>Deployment Interface</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white uppercase mb-6 leading-none">
            Launch <span className="text-indigo-500">Campaign.</span>
          </h1>
          <p className="text-neutral-500 font-mono text-sm uppercase max-w-lg">
            SET DURATION, LEADERBOARD CONSTRAINTS, AND IDENTITY VERIFICATION PROTOCOLS. ALL DATA IS WRAPPED IN NOX ENCLAVE ARCHITECTURE.
          </p>
        </motion.div>

        <motion.div 
          {...fadeInUp}
          className="bg-[#050505] border-2 border-indigo-500/20 p-1 font-mono group"
        >
          <div className="bg-indigo-500/10 p-4 border border-indigo-500/20 mb-1 flex justify-between items-center">
            <span className="text-indigo-500 uppercase text-[10px]">Campaign_Config // Enclave_Init</span>
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-indigo-500/50 rounded-full animate-pulse" />
            </div>
          </div>
          
          <div className="p-8 space-y-10">
            <Field
              label="Campaign_Title"
              icon={<FileText className="w-4 h-4" />}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="INIT_TITLE"
                className="w-full bg-black border border-indigo-500/10 py-4 px-4 text-white font-mono text-lg focus:outline-none focus:border-indigo-500/50 transition-colors placeholder-neutral-800 uppercase"
              />
            </Field>

            <Field
              label="Operational_Description"
              icon={<Terminal className="w-4 h-4" />}
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="DESCRIBE_OBJECTIVES..."
                rows={3}
                className="w-full bg-black border border-indigo-500/10 py-4 px-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors placeholder-neutral-800 resize-none uppercase"
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-10">
              <Field
                label="Execution_Mode"
                icon={<Zap className="w-4 h-4" />}
              >
                <div className="flex bg-black p-1 border border-indigo-500/10">
                  <button
                    type="button"
                    onClick={() => setIsAuction(false)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      !isAuction
                        ? 'bg-indigo-500 text-black'
                        : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAuction(true); setTopK('1'); }}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      isAuction
                        ? 'bg-amber-500 text-black'
                        : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    Auction
                  </button>
                </div>
                {isAuction && (
                  <p className="mt-2 text-[9px] text-amber-500 uppercase tracking-tight">
                    * HIGHEST SINGLE BIDDER WINS. AUTO-REFUND ENABLED.
                  </p>
                )}
              </Field>

              {isAuction && (
                <Field
                  label="Minimum_Bid"
                  icon={<Zap className="w-4 h-4" />}
                  suffix="FME"
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minBid}
                    onChange={(e) => setMinBid(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black border border-indigo-500/10 py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors placeholder-neutral-800"
                  />
                </Field>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              <Field
                label="Duration"
                icon={<Clock className="w-4 h-4" />}
                suffix="MIN"
              >
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-black border border-indigo-500/10 py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </Field>

              <Field
                label="Cooldown"
                icon={<Activity className="w-4 h-4" />}
                suffix="MIN"
              >
                <input
                  type="number"
                  min={1}
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(e.target.value)}
                  className="w-full bg-black border border-indigo-500/10 py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </Field>

              <Field
                label="Top_K_Rank"
                icon={<Trophy className="w-4 h-4" />}
                suffix="SLOTS"
              >
                <input
                  type="number"
                  min={1}
                  max={255}
                  value={isAuction ? '1' : topK}
                  disabled={isAuction}
                  onChange={(e) => setTopK(e.target.value)}
                  className="w-full bg-black border border-indigo-500/10 py-3 px-4 text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-30"
                />
              </Field>
            </div>

            <Field
              label="Identity_Verification"
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              <div className="bg-black border border-indigo-500/10 p-4">
                <ReclaimVerifier
                  onVerified={(proofId) => setReclaimProofId(proofId)}
                  onCleared={() => setReclaimProofId('')}
                />
                {reclaimProofId && (
                  <p className="mt-4 text-[9px] text-indigo-500/60 font-mono uppercase tracking-widest break-all">
                    PROV_ID: {reclaimProofId}
                  </p>
                )}
              </div>
            </Field>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono uppercase">
                ERROR: {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="w-full py-5 bg-indigo-500 text-black font-black uppercase tracking-tighter hover:bg-indigo-400 disabled:bg-indigo-500/20 disabled:text-indigo-500/40 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-colors text-lg"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  INITIALIZING...
                </>
              ) : (
                <>
                  <Rocket className="w-6 h-6" /> Initialize Campaign
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  suffix,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-mono text-neutral-500 flex items-center gap-2 uppercase tracking-[0.2em]">
        <span className="text-indigo-500/40">{icon}</span> {label}
      </label>
      <div className="relative">
        {children}
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-indigo-500/40 font-black uppercase pointer-events-none">
            {suffix}
          </span>
        )}
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
