'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useReadContract, usePublicClient } from 'wagmi';
import { Lock, Clock, Trophy, PlusCircle, CheckCircle2, Flame, Zap } from 'lucide-react';
import {
  FUNDME_PLATFORM_ADDRESS,
  PLATFORM_ABI,
  CHAIN_ID,
  IPFS_GATEWAY,
  IPFS_GATEWAY_FALLBACKS,
  type LeaderboardPayload,
} from '@/lib/contracts';
import { AddressLink } from '@/components/AddressLink';
import { VerifiedBadge } from '@/components/VerifiedBadge';

// --- Helpers -------------------------------------------------------------

const formatDeadline = (deadline: bigint): { label: string; ended: boolean } => {
  const deadlineMs = Number(deadline) * 1000;
  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return { label: 'Ended', ended: true };
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  if (days > 0) return { label: `${days}d ${hours}h left`, ended: false };
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  return { label: `${hours}h ${minutes}m left`, ended: false };
};

// --- Project Data Type ---------------------------------------------------

type ProjectData = {
  id: number;
  sponsoree: `0x${string}`;
  deadline: bigint;
  topK: number;
  isFinalized: boolean;
  title: string;
  description: string;
  totalFunded: number;
  isAuction: boolean;
  reclaimProofId: string;
};

// --- Card ---------------------------------------------------------------

function ProjectCard({ project }: { project: ProjectData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { label: deadlineLabel, ended } = formatDeadline(project.deadline);

  return (
    <Link
      href={`/project/${project.id}`}
      className="group relative bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6 hover:border-indigo-500/40 transition-colors overflow-hidden flex flex-col"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

      <h3 className="text-2xl font-bold mb-2 relative z-10">
        {project.title || `Campaign #${project.id}`}
      </h3>

      <div className="flex flex-wrap items-center gap-2 mb-4 relative z-10">
        {project.isAuction && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-600/10 border border-amber-600/20 text-amber-400 text-xs font-medium">
            <Zap className="w-3 h-3" /> Auction
          </span>
        )}
        <VerifiedBadge reclaimProofId={project.reclaimProofId} useSpan={true} />
        {project.isFinalized ? (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" /> Finalized
          </span>
        ) : ended ? (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Clock className="w-3 h-3" /> Awaiting reveal
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Flame className="w-3 h-3" /> Live
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-xs text-neutral-400 mb-3 relative z-10 line-clamp-2">
          {project.description}
        </p>
      )}
      
      <p className="text-xs text-neutral-500 font-mono mb-6 relative z-10">
        by <AddressLink address={project.sponsoree} shorten={true} useSpan={true} />
      </p>

      <div className="mt-auto grid grid-cols-2 gap-3 text-xs relative z-10">
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3">
          <p className="text-neutral-500 mb-1 uppercase tracking-wider">Deadline</p>
          <p className="font-semibold text-neutral-200">{mounted ? deadlineLabel : '---'}</p>
        </div>
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3">
          <p className="text-neutral-500 mb-1 uppercase tracking-wider flex items-center gap-1">
            <Trophy className="w-3 h-3" /> Top K
          </p>
          <p className="font-semibold text-neutral-200">{project.topK}</p>
        </div>
      </div>
    </Link>
  );
}

// --- Page ---------------------------------------------------------------

export default function ProjectsPage() {
  const publicClient = usePublicClient();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: nextProjectId } = useReadContract({
    address: FUNDME_PLATFORM_ADDRESS,
    abi: PLATFORM_ABI,
    functionName: 'nextProjectId',
    chainId: CHAIN_ID,
  });

  useEffect(() => {
    if (nextProjectId === undefined || !publicClient) return;

    const loadAllProjects = async () => {
      setIsLoading(true);
      const count = Number(nextProjectId);
      const ids = Array.from({ length: count }, (_, i) => i);

      const data = await Promise.all(
        ids.map(async (id) => {
          const projectDetails = await publicClient.readContract({
            address: FUNDME_PLATFORM_ADDRESS,
            abi: PLATFORM_ABI,
            functionName: 'projects',
            args: [BigInt(id)],
          }) as readonly [`0x${string}`, bigint, number, string, boolean, bigint, string, string, boolean, bigint, bigint];

          const history = await publicClient.readContract({
            address: FUNDME_PLATFORM_ADDRESS,
            abi: PLATFORM_ABI,
            functionName: 'getLeaderboardHistory',
            args: [BigInt(id)],
          }) as readonly string[];

          let totalFunded = 0;
          if (history.length > 0) {
            const latestHash = history[history.length - 1];
            if (!latestHash.startsWith('QmMock')) {
              for (const gateway of [IPFS_GATEWAY, ...IPFS_GATEWAY_FALLBACKS]) {
                try {
                  const res = await fetch(`${gateway}${latestHash}`);
                  if (res.ok) {
                    const payload = await res.json() as LeaderboardPayload;
                    totalFunded = payload.totalFunded ?? 0;
                    break;
                  }
                } catch {}
              }
            }
          }

          return {
            id,
            sponsoree: projectDetails[0] as `0x${string}`,
            deadline: projectDetails[1],
            topK: projectDetails[2],
            reclaimProofId: projectDetails[3] as string,
            isFinalized: projectDetails[4],
            title: projectDetails[6],
            description: projectDetails[7],
            totalFunded,
            isAuction: projectDetails[8],
          };
        })
      );

      const now = BigInt(Math.floor(Date.now() / 1000));
      setProjects(data.sort((a, b) => {
        const aEnded = a.isFinalized || a.deadline <= now;
        const bEnded = b.isFinalized || b.deadline <= now;

        if (aEnded !== bEnded) {
          return aEnded ? 1 : -1;
        }

        return b.totalFunded - a.totalFunded;
      }));
      setIsLoading(false);
    };

    loadAllProjects();
  }, [nextProjectId, publicClient]);

  return (
    <div className="min-h-screen pt-12 pb-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
            <Lock className="w-3 h-3" />
            Sorted by Total Funded (Confidential Reveal)
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Explore Campaigns
          </h1>
          <p className="text-neutral-400 max-w-xl">
            Browse active and past FundMe campaigns on Arbitrum Sepolia.
          </p>
        </div>
        <Link
          href="/create"
          className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black hover:bg-neutral-200 transition-colors text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" /> Start a Campaign
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => <div key={i} className="animate-pulse bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6 h-56" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20">
          <Flame className="w-16 h-16 mx-auto mb-5 text-indigo-400" />
          <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
