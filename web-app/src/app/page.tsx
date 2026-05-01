'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Cpu, Lock, ChevronRight, Zap, Terminal, Activity, EyeOff, Boxes, Layers, Gavel, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import iexecLogo from "../../assets/iexec_logo.png";
import reclaimLogo from "../../assets/reclaim_protocol_logo.png";

// Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.15
    }
  },
  viewport: { once: true, margin: "-100px" }
};

const itemReveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" }
};

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#000000] selection:bg-blue-500/30 overflow-x-hidden text-neutral-200">
      {/* NOX DATA STREAM MARQUEE (The Technical Backbone) */}
      <InfiniteDataStream text="[NOX_ENCLAVE_ACTIVE] —— ENCRYPTED_CONTRIBUTION_STREAM —— TEE_ATTESTATION_STATUS:OK —— 0x7984_COMPLIANT —— " color="blue" />

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 border-b border-blue-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e3a8a_0%,#000000_60%)] opacity-40" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 text-blue-400 font-mono text-sm mb-6 tracking-[0.3em] uppercase"
              >
                <div className="w-2 h-2 bg-blue-500 animate-pulse" />
                <span>Confidential Crowdfunding Layer</span>
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-7xl md:text-9xl font-black tracking-tighter mb-8 leading-[0.85] text-white"
              >
                FUND<span className="text-blue-500">ME.</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-xl md:text-2xl text-neutral-400 max-w-2xl mb-12 font-mono leading-tight uppercase tracking-tight"
              >
                THE FIRST CROWDFUNDING PLATFORM WHERE <br />
                YOUR CONTRIBUTIONS REMAIN 100% PRIVATE. <br />
                <span className="text-blue-500/60 text-lg">POWERED BY IEXEC NOX TEE INFRASTRUCTURE.</span>
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex flex-wrap gap-4"
              >
                <Link 
                  href="/projects" 
                  className="px-8 py-4 bg-blue-500 text-black font-black uppercase tracking-tighter hover:bg-blue-400 transition-colors flex items-center gap-2"
                >
                  Explore Projects
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link 
                  href="/create" 
                  className="px-8 py-4 border border-blue-500/40 text-blue-400 font-black uppercase tracking-tighter hover:bg-blue-500/10 transition-colors"
                >
                  Launch Campaign
                </Link>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="lg:col-span-4 hidden lg:block"
            >
              <LeaderboardAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Campaign Modes - Content from README */}
      <section className="py-24 border-b border-blue-500/20 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8"
          >
            <div className="max-w-xl">
               <h2 className="text-xs font-mono text-blue-500 mb-4 uppercase tracking-[0.4em]">Operational Modes</h2>
               <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none uppercase">Dual Execution <br /> Strategies.</h3>
            </div>
            <p className="text-neutral-500 font-mono text-sm max-w-sm uppercase">Choose how you want to fund. Both modes are fully encrypted via Nox Protocol.</p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-2 gap-8"
          >
            <motion.div 
              variants={itemReveal}
              className="border border-blue-500/20 p-10 group hover:border-blue-500 transition-colors bg-black"
            >
               <div className="flex justify-between items-start mb-12">
                  <div className="w-12 h-12 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-black transition-colors">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono text-blue-500 bg-blue-500/10 px-3 py-1">POPULAR</span>
               </div>
               <h4 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">Standard Mode</h4>
               <p className="text-neutral-400 font-mono text-sm leading-tight uppercase mb-8">
                 TOP-K SPONSORS WIN. CREATORS COLLECT POOLED CONTRIBUTIONS. IDEAL FOR PROJECTS WITH TIERS OR REWARDS.
               </p>
               <div className="pt-6 border-t border-blue-500/10 flex items-center gap-2 text-blue-500 text-xs font-mono uppercase">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>Leaderboard refreshed via TEE</span>
               </div>
            </motion.div>

            <motion.div 
              variants={itemReveal}
              className="border border-blue-600/20 p-10 group hover:border-blue-600 transition-colors bg-black"
            >
               <div className="flex justify-between items-start mb-12">
                  <div className="w-12 h-12 border border-blue-600/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-black transition-colors">
                    <Gavel className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-600/10 px-3 py-1">COMPETITIVE</span>
               </div>
               <h4 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">Auction Mode</h4>
               <p className="text-neutral-400 font-mono text-sm leading-tight uppercase mb-8">
                 HIGHEST SINGLE BIDDER WINS. ALL OTHERS RECEIVE AUTOMATIC REFUNDS. PERFECT FOR EXCLUSIVE OPPORTUNITIES.
               </p>
               <div className="pt-6 border-t border-blue-600/10 flex items-center gap-2 text-blue-600 text-xs font-mono uppercase">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>Winner calculated in Enclave</span>
               </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* NOX ENCLAVE VISUALIZER (Positioned as the Engine) */}
      <section className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <motion.div 
              {...fadeInUp}
              className="lg:w-1/2"
            >
              <h2 className="text-xs font-mono text-blue-500 mb-6 uppercase tracking-[0.5em]">The Nox Backbone</h2>
              <h3 className="text-5xl font-black text-white tracking-tighter mb-8 leading-none uppercase">
                Privacy By <br />
                <span className="text-neutral-600">Infrastructure.</span>
              </h3>
              <p className="text-lg text-neutral-400 font-mono mb-10 leading-tight">
                FUNDME LIVES ON ARBITRUM, BUT ITS BRAIN LIVES IN THE ENCLAVE. CONTRIBUTION AMOUNTS ARE ENCRYPTED ON-CHAIN (FHE). ONLY THE NOX ORACLE CAN DECRYPT AND RANK SPONSORS WITHOUT EXPOSING RAW DATA.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 border border-blue-500/20 bg-blue-500/5"
                >
                  <div className="text-blue-500 mb-2"><Activity className="w-5 h-5" /></div>
                  <span className="font-mono text-[10px] tracking-tighter text-white uppercase">Real-time TEE Attestation</span>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 border border-blue-600/20 bg-blue-600/5"
                >
                  <div className="text-blue-600 mb-2"><Shield className="w-5 h-5" /></div>
                  <span className="font-mono text-[10px] tracking-tighter text-white uppercase">ZK-Identity via Reclaim</span>
                </motion.div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 w-full"
            >
              <div className="bg-[#050505] border-2 border-blue-500/30 p-1 font-mono group">
                <div className="bg-blue-500/10 p-4 border border-blue-500/20 mb-1 flex justify-between">
                  <span className="text-blue-500 uppercase text-[10px]">Backbone_Terminal // Nox_Core</span>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-ping" />
                  </div>
                </div>
                <div className="p-8 space-y-6 text-sm">
                  <div className="flex items-start gap-4">
                    <span className="text-neutral-600">$</span>
                    <span className="text-white animate-pulse">fundme --init-reveal-0x9A4F</span>
                  </div>
                  <div className="space-y-2 border-l-2 border-blue-500/30 pl-4">
                    <p className="text-blue-500/70 text-xs">{">"} fetching_encrypted_handles...</p>
                    <p className="text-blue-500/70 text-xs">{">"} decrypting_inside_tee_enclave...</p>
                    <p className="text-blue-500/70 text-xs">{">"} sorting_by_homomorphic_weight...</p>
                  </div>
                  <div className="p-4 bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 text-center uppercase tracking-tighter group-hover:bg-blue-500/20 transition-colors">
                     Reveal_State: Synchronized_To_IPFS
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-neutral-600 uppercase">
                    <span>Sig: 0x9f...4a2</span>
                    <span>Lat: 124ms</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* NOX DATA STREAM MARQUEE (Mid-page break) */}
      <InfiniteDataStream text="TEE_VERIFIED —— NOX_PROTOCOL —— ZERO_KNOWLEDGE_PROOFS —— END_TO_END_ENCRYPTION —— " color="indigo" />

      {/* TECH PARTNERS */}
      <section className="py-24 border-y border-blue-500/10 bg-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700"
          >
             <motion.div variants={itemReveal} className="flex items-center gap-3">
                <Image src={iexecLogo} alt="iExec" width={32} height={32} />
                <span className="font-mono text-xl font-black text-white">iExec NOX</span>
             </motion.div>
             <motion.div variants={itemReveal} className="flex items-center gap-3">
                <Image src={reclaimLogo} alt="Reclaim" width={32} height={32} />
                <span className="font-mono text-xl font-black text-white">RECLAIM</span>
             </motion.div>
             <motion.div variants={itemReveal} className="flex items-center">
                <span className="font-mono text-xl font-black text-white tracking-tighter">ARBITRUM_SEPOLIA</span>
             </motion.div>
             <motion.div variants={itemReveal} className="flex items-center">
                <span className="font-mono text-lg font-black border-2 border-white px-3 py-1">ERC-7984</span>
             </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER MECHANICAL */}
      <footer className="pt-32 pb-10 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            {...fadeInUp}
            className="grid md:grid-cols-12 gap-12 mb-20 border-t border-blue-500/20 pt-20"
          >
            <div className="md:col-span-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-blue-500 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-black" />
                </div>
                <span className="text-3xl font-black uppercase tracking-tighter text-white">FUNDME.</span>
              </div>
              <p className="text-neutral-500 font-mono text-xs max-w-sm leading-tight uppercase">
                THE DECENTRALIZED PROTOCOL FOR CONFIDENTIAL CAPITAL FORMATION. BUILT ON ARBITRUM SEPOLIA WITH NOX TEE ARCHITECTURE.
              </p>
            </div>
            
            <div className="md:col-span-6 grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono text-blue-500 uppercase tracking-[0.3em]">Protocol_Access</h4>
                <div className="flex flex-col gap-2 font-mono text-sm">
                  <Link href="/projects" className="hover:text-blue-400 transition-colors tracking-tighter underline underline-offset-4 uppercase">View_Active_Nodes</Link>
                  <Link href="/create" className="hover:text-blue-400 transition-colors tracking-tighter underline underline-offset-4 uppercase">Initialize_Campaign</Link>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono text-blue-500 uppercase tracking-[0.3em]">Network_Stats</h4>
                <div className="flex flex-col gap-2 font-mono text-sm text-neutral-500 uppercase">
                  <span>Latency: 14ms</span>
                  <span>Uptime: 99.98%</span>
                </div>
              </div>
            </div>
          </motion.div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-10 border-t border-blue-500/10 font-mono text-[9px] text-neutral-600 uppercase">
            <span>©{new Date().getFullYear()} FUNDME_FOUNDATION // ENCRYPTED_BY_NOX</span>
            <div className="flex gap-6">
              <span>Arbitrum_Sepolia_Mainnet_Ready</span>
              <span>v1.0.42_Stable</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LeaderboardAnimation() {
  const [sponsors, setSponsors] = useState([
    { id: 1, handle: "0x3A...B2", amount: "7A9F1B2C", weight: 95 },
    { id: 2, handle: "0x7F...C1", amount: "D4E2F6A8", weight: 82 },
    { id: 3, handle: "0x9D...E4", amount: "1B5C9D3E", weight: 74 },
    { id: 4, handle: "0x1B...A8", amount: "F0A2B4C6", weight: 61 },
    { id: 5, handle: "0x5E...D3", amount: "3D7E1F9A", weight: 55 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSponsors(prev => {
        const next = [...prev].map(s => ({
          ...s,
          // Randomly fluctuate weight to trigger reordering
          weight: Math.max(0, s.weight + (Math.random() * 24 - 12)),
          // Generate new "encrypted" hash string
          amount: Array(8).fill(0).map(() => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("")
        })).sort((a, b) => b.weight - a.weight);
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="border border-blue-500/30 p-6 bg-blue-500/5 backdrop-blur-sm relative overflow-hidden h-full min-h-[380px] flex flex-col"
    >
      <div className="absolute top-0 right-0 p-2 opacity-10">
         <Cpu className="w-24 h-24 text-blue-500" />
      </div>
      
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-blue-500/20 relative z-10">
        <span className="text-xs font-mono text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Live_Sponsor_Ranking
        </span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-white">ENCRYPTED_STATE</span>
        </div>
      </div>
      
      <div className="space-y-3 flex-grow relative z-10">
        {sponsors.map((sponsor, index) => (
          <motion.div
            key={sponsor.id}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center justify-between p-4 bg-black/60 border border-blue-500/10 hover:border-blue-500/30 transition-colors font-mono"
          >
            <div className="flex items-center gap-4">
              <span className="text-blue-500/40 text-[10px] w-6">0{index + 1}</span>
              <span className="text-white text-xs tracking-wider">{sponsor.handle}</span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="w-3 h-3 text-blue-500/30" />
              <motion.span 
                key={sponsor.amount}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="text-blue-400 font-bold text-xs tabular-nums"
              >
                0x{sponsor.amount}
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-blue-500/10 relative z-10">
         <div className="flex justify-between items-center text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> 
              FHE_ENABLED
            </span>
            <span>TEE_ATTESTED</span>
         </div>
      </div>
    </motion.div>
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
