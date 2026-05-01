'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useReadContract, usePublicClient } from 'wagmi';
import { Lock, Clock, Trophy, PlusCircle, CheckCircle2, Flame, Zap, ChevronRight, Activity, Search } from 'lucide-react';
import { motion } from "framer-motion";
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

// Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
} as const;

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
} as const;

// --- Helpers -------------------------------------------------------------

const formatDeadline = (deadline: bigint): { label: string; ended: boolean } => {
  const deadlineMs = Number(deadline) * 1000;
  const nowMs = Date.now();
  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return { label: 'ENDED', ended: true };
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  if (days > 0) return { label: `${days}D ${hours}H REMAINING`, ended: false };
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  return { label: `${hours}H ${minutes}M REMAINING`, ended: false };
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
    <motion.div variants={fadeInUp}>
      <Link
        href={`/project/${project.id}`}
        className="group block relative bg-[#050505] border border-blue-500/10 p-0 hover:border-blue-500/40 transition-all overflow-hidden"
      >
        <div className="bg-black border-b border-blue-500/10 p-3 flex justify-between items-center">
          <span className="font-mono text-[10px] text-blue-500/40 uppercase tracking-widest">Project_ID: {project.id.toString().padStart(4, '0')}</span>
          <div className="flex gap-2">
            {project.isAuction && (
              <span className="font-mono text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 uppercase">Auction</span>
            )}
            {project.isFinalized ? (
              <span className="font-mono text-[9px] text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20 uppercase">Finalized</span>
            ) : ended ? (
              <span className="font-mono text-[9px] text-amber-400 bg-amber-400/10 px-2 py-0.5 border border-amber-400/20 uppercase">Decrypting</span>
            ) : (
              <span className="font-mono text-[9px] text-blue-400 bg-blue-400/10 px-2 py-0.5 border border-blue-400/20 uppercase animate-pulse">Live</span>
            )}
          </div>
        </div>

        <div className="p-8">
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-4 group-hover:text-blue-500 transition-colors">
            {project.title || `Campaign_${project.id}`}
          </h3>

          <div className="mb-6 h-12">
            {project.description && (
              <p className="text-xs text-neutral-500 font-mono uppercase line-clamp-2 leading-tight">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 mb-8">
            <VerifiedBadge reclaimProofId={project.reclaimProofId} useSpan={true} />
            <span className="text-[10px] text-neutral-600 font-mono uppercase">
              By <AddressLink address={project.sponsoree} shorten={true} useSpan={true} />
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-blue-500/10">
            <div className="p-4 border-r border-blue-500/10">
              <p className="text-[9px] font-mono text-neutral-600 uppercase mb-1">Status</p>
              <p className="font-mono text-[10px] text-white font-bold">{mounted ? deadlineLabel : 'LOADING...'}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] font-mono text-neutral-600 uppercase mb-1 flex items-center gap-1">
                <Trophy className="w-2.5 h-2.5" /> Top_K
              </p>
              <p className="font-mono text-[10px] text-blue-500 font-bold">{project.topK}_SPONSORS</p>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <ChevronRight className="w-4 h-4 text-blue-500" />
        </div>
      </Link>
    </motion.div>
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
    <div className="min-h-screen bg-black text-neutral-200">
      <InfiniteDataStream text="[EXPLORE_NETWORK] —— ACTIVE_CAMPAIGNS_STREAM —— CONFIDENTIAL_LEADERBOARDS_ACTIVE —— " color="blue" />
      
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-12 mb-20">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 text-blue-400 font-mono text-xs mb-4 tracking-[0.3em] uppercase">
              <Search className="w-4 h-4" />
              <span>Network Explorer</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-white uppercase mb-6 leading-none">
              Active <span className="text-blue-500">Projects.</span>
            </h1>
            <p className="text-neutral-500 font-mono text-sm uppercase max-w-lg">
              SCANNING ARBITRUM SEPOLIA FOR CONFIDENTIAL CAPITAL FORMATION EVENTS. ALL CONTRIBUTIONS REMAIN ENCRYPTED UNTIL TEE FINALIZATION.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Link
              href="/create"
              className="px-8 py-4 bg-blue-500 text-black font-black uppercase tracking-tighter hover:bg-blue-400 transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              Create Project
            </Link>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-[#050505] border border-blue-500/10 h-[400px] animate-pulse flex flex-col">
                <div className="h-10 bg-black border-b border-blue-500/10" />
                <div className="p-8 space-y-4">
                   <div className="h-8 bg-blue-500/5 w-3/4" />
                   <div className="h-4 bg-blue-500/5 w-full" />
                   <div className="h-4 bg-blue-500/5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div 
            {...fadeInUp}
            className="text-center py-32 border border-dashed border-blue-500/10 bg-[#050505]"
          >
            <Activity className="w-16 h-16 mx-auto mb-6 text-blue-500/20" />
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">No active projects detected</h3>
            <p className="text-neutral-600 font-mono text-xs uppercase">The network is currently silent. Be the first to initialize.</p>
          </motion.div>
        ) : (
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </motion.div>
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
