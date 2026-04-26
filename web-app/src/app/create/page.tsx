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
} from 'lucide-react';
import {
  CHAIN_ID,
  FUNDME_PLATFORM_ADDRESS,
  PLATFORM_ABI,
  getGasOverride,
} from '@/lib/contracts';
import { isUnderpricedGasError, isUserRejection } from '@/lib/errors';
import { ReclaimVerifier } from '@/components/ReclaimVerifier';

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

      // Parse the receipt to extract the new projectId from ProjectCreated.
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
      console.error(err);
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
      <div className="min-h-screen pt-12 pb-12 px-6 flex justify-center items-center">
        <div className="text-center bg-neutral-900/50 p-12 rounded-3xl border border-neutral-800 max-w-md">
          <Wallet className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect to create</h2>
          <p className="text-neutral-400 text-sm mb-6">
            You need a connected wallet on Arbitrum Sepolia to launch a campaign.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-700 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 max-w-3xl mx-auto">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All campaigns
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
          <Rocket className="w-3 h-3" /> New campaign
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          Launch a confidential campaign
        </h1>
        <p className="text-neutral-400 max-w-xl">
          Set a duration, choose how many top sponsors show on the leaderboard,
          and optionally attach a Reclaim proof id for eligibility.
        </p>
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 space-y-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

        <Field
          label="Campaign title"
          icon={<FileText className="w-4 h-4" />}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Open-source AI research fund"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-700"
          />
        </Field>

        <Field
          label="Description (optional)"
          icon={<FileText className="w-4 h-4" />}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe your campaign goals…"
            rows={3}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-700 resize-none"
          />
        </Field>

        <Field
          label="Campaign mode"
          icon={<Zap className="w-4 h-4" />}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsAuction(false)}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                !isAuction
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => { setIsAuction(true); setTopK('1'); }}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                isAuction
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              Auction
            </button>
          </div>
          {isAuction && (
            <p className="mt-2 text-xs text-amber-400">
              Only the highest bidder wins. All others receive automatic refunds after the campaign ends.
            </p>
          )}
        </Field>

        {isAuction && (
          <Field
            label="Minimum bid (optional)"
            icon={<Zap className="w-4 h-4" />}
            suffix="FUNDME"
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={minBid}
              onChange={(e) => setMinBid(e.target.value)}
              placeholder="0.00 (no minimum)"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 placeholder-neutral-700"
            />
          </Field>
        )}

        <Field
          label="Duration"
          icon={<Clock className="w-4 h-4" />}
          suffix="minutes"
        >
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-700"
          />
        </Field>

        <Field
          label="Leaderboard refresh cooldown"
          icon={<Clock className="w-4 h-4" />}
          suffix="minutes (min 1)"
        >
          <input
            type="number"
            min={1}
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-700"
          />
        </Field>

        <Field
          label="Top K sponsors"
          icon={<Trophy className="w-4 h-4" />}
          suffix="sponsors"
        >
          <input
            type="number"
            min={1}
            max={255}
            value={isAuction ? '1' : topK}
            disabled={isAuction}
            onChange={(e) => setTopK(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 placeholder-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </Field>

        <Field
          label="Identity verification (optional)"
          icon={<ShieldCheck className="w-4 h-4" />}
        >
          <ReclaimVerifier
            onVerified={(proofId) => setReclaimProofId(proofId)}
            onCleared={() => setReclaimProofId('')}
          />
          {reclaimProofId && (
            <p className="mt-2 text-[11px] text-neutral-500 font-mono">
              Proof ID: {reclaimProofId.slice(0, 16)}…
            </p>
          )}
        </Field>

        {error && (
          <p className="text-sm text-red-400 break-words">{error}</p>
        )}

        <button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" /> Launch campaign
            </>
          )}
        </button>
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
    <div>
      <label className="text-xs text-neutral-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
        {icon} {label}
      </label>
      <div className="relative">
        {children}
        {suffix && (
          <span className="absolute right-4 top-3.5 text-neutral-500 text-xs font-semibold pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
