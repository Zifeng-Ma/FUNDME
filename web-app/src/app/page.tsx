'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Trophy, Cpu, Lock, ChevronRight, Zap, Fingerprint, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="min-h-screen bg-neutral-950" />;

  return (
    <div className="min-h-screen selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
            className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" 
          />
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, delay: 0.5 }}
            className="absolute bottom-[10%] right-[-10%] w-[35%] h-[35%] bg-purple-600/15 blur-[100px] rounded-full" 
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8 backdrop-blur-sm"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Next-Gen Confidential Funding</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[1.1] max-w-5xl"
            >
              Fund the Future, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-[length:200%_auto] animate-gradient">
                Confidentially.
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl md:text-2xl text-neutral-400 max-w-3xl mb-12 leading-relaxed font-medium"
            >
              The first crowdfunding platform where your contributions remain 100% private. 
              Support creators, climb the leaderboard, and protect your financial data.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-6"
            >
              <Link 
                href="/projects" 
                className="group relative px-10 py-5 rounded-2xl bg-white text-black transition-all hover:scale-105 active:scale-95 text-lg font-bold flex items-center gap-2"
              >
                Explore Projects
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="/create" 
                className="px-10 py-5 rounded-2xl border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/50 transition-all hover:scale-105 active:scale-95 text-lg font-bold bg-neutral-950/50 backdrop-blur-md"
              >
                Start Campaign
              </Link>
            </motion.div>
          </div>

        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold tracking-[0.2em] text-indigo-500 uppercase mb-4">Core Technology</h2>
              <h3 className="text-4xl md:text-5xl font-bold leading-tight">Privacy is not an option. <br className="hidden md:block" /> It&apos;s a standard.</h3>
            </div>
            <p className="text-neutral-400 text-lg max-w-md">
              We combine the best of Web3 transparency with enterprise-grade confidentiality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Fingerprint className="w-8 h-8" />}
              title="Identity Preservation"
              description="Your wallet address is public, but your financial power is your business. We keep contributions hidden from prying eyes."
              color="indigo"
              delay={0}
            />
            <FeatureCard 
              icon={<Trophy className="w-8 h-8" />}
              title="Competitive Game Theory"
              description="Ascend the project leaderboards. Outbid others for the top spot without ever revealing your actual bid amount."
              color="purple"
              delay={0.1}
            />
            <FeatureCard 
              icon={<Cpu className="w-8 h-8" />}
              title="TEE-Powered Logic"
              description="Calculations occur inside Trusted Execution Environments. Zero human access, zero data leaks, 100% integrity."
              color="blue"
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Leaderboard Preview / Gamification */}
      <section className="py-32 bg-neutral-900/20 border-y border-neutral-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                The Battle for <br />
                <span className="text-indigo-400">First Place.</span>
              </h2>
              <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
                Our leaderboard system ranks sponsors based on their encrypted contribution amounts. You only know if you&apos;re ahead, not by how much.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400 border border-indigo-500/20">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Encrypted Rank Calculation</h4>
                    <p className="text-neutral-500">iExec Nox protocol handles comparisons in a secure enclave.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400 border border-purple-500/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Arbitrum Sepolia Finality</h4>
                    <p className="text-neutral-500">Immutable results verified on the fastest L2 network.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-3xl">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="font-bold text-xl uppercase tracking-wider">Top Sponsors</h4>
                  <div className="px-3 py-1 rounded-full bg-neutral-800 text-xs font-mono text-neutral-400">PROJECT_ID: 0042</div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { rank: 1, name: "Vitalik.eth", status: "🥇 Leader" },
                    { rank: 2, name: "0x74...f92", status: "🥈 Contender" },
                    { rank: 3, name: "Satoshi_fan", status: "🥉 Rising" },
                  ].map((sponsor, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ x: 10 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-neutral-800/50"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-8 font-mono text-neutral-500">#{sponsor.rank}</span>
                        <span className="font-bold">{sponsor.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-sm font-mono text-neutral-500">████.██ USDC</span>
                         <span className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">{sponsor.status}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-neutral-800">
                    <div className="flex items-center justify-between text-sm mb-4">
                        <span className="text-neutral-500">Your Rank</span>
                        <span className="text-white font-bold">#12 (Private)</span>
                    </div>
                    <button className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold">
                        Outbid to Rank Up
                    </button>
                </div>
              </div>
              
              {/* Floating element */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-10 -right-10 px-6 py-4 rounded-2xl bg-neutral-800 border border-neutral-700 shadow-2xl backdrop-blur-md hidden md:block"
              >
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold text-sm">Verified by TEE Oracle</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Logos */}
      <section className="py-24 grayscale opacity-40 hover:opacity-100 hover:grayscale-0 transition-all duration-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-x-20 gap-y-12">
            <div className="text-3xl font-black italic tracking-tighter text-white">ARBITRUM</div>
            <div className="text-2xl font-bold font-mono text-blue-400 flex items-center gap-2">
                <Cpu className="w-6 h-6" /> iExec Nox
            </div>
            <div className="text-xl font-bold border-2 border-white px-4 py-1">ERC-7984</div>
            <div className="text-3xl font-bold text-white tracking-tighter">VIEM</div>
            <div className="text-2xl font-black text-indigo-500">NEXT.JS</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-16 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Lock className="w-6 h-6 text-indigo-500" />
                    <span className="text-xl font-bold tracking-[0.2em] uppercase">FundMe</span>
                </div>
                <p className="text-neutral-500 text-sm max-w-xs">
                    Next-generation confidential crowdfunding powered by iExec Nox and Arbitrum Sepolia.
                </p>
            </div>
            
            <div className="flex gap-12">
                <div className="flex flex-col gap-4 text-sm">
                    <span className="font-bold text-neutral-400 uppercase tracking-widest text-[10px]">Platform</span>
                    <Link href="/projects" className="text-neutral-500 hover:text-white transition-colors">Explore</Link>
                    <Link href="/create" className="text-neutral-500 hover:text-white transition-colors">Create</Link>
                    <Link href="/dashboard" className="text-neutral-500 hover:text-white transition-colors">Dashboard</Link>
                </div>
                <div className="flex flex-col gap-4 text-sm">
                    <span className="font-bold text-neutral-400 uppercase tracking-widest text-[10px]">Social</span>
                    <Link href="#" className="text-neutral-500 hover:text-white transition-colors">Twitter / X</Link>
                    <Link href="#" className="text-neutral-500 hover:text-white transition-colors">Discord</Link>
                    <Link href="#" className="text-neutral-500 hover:text-white transition-colors">GitHub</Link>
                </div>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-neutral-900 flex flex-col md:flex-row justify-between items-center gap-4 text-neutral-600 text-xs font-medium">
            <p>Built for the Web3 Confidential Token Hackathon &copy; {new Date().getFullYear()}</p>
            <div className="flex gap-6">
                <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
                <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, color, delay }: { 
    icon: React.ReactNode, 
    title: string, 
    description: string, 
    color: 'indigo' | 'purple' | 'blue',
    delay: number
}) {
    const colors = {
        indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-400/20",
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5 }}
            className="group relative bg-neutral-900/40 border border-neutral-800 p-10 rounded-[2.5rem] hover:bg-neutral-800/40 transition-all overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity translate-x-4 translate-y-[-4px]">
                {icon}
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border ${colors[color]}`}>
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-4">{title}</h3>
            <p className="text-neutral-400 leading-relaxed text-lg">
                {description}
            </p>
        </motion.div>
    );
}
