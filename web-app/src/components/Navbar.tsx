'use client';

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LogOut, Wallet, Activity } from "lucide-react";
import logo from "../../assets/logo.png";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from 'wagmi/chains'
import { AddressLink } from "./AddressLink";
import { motion } from "framer-motion";

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <nav className="border-b border-border-strong bg-surface-raised/80 backdrop-blur-md sticky top-0 w-full z-50 font-mono">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo and App Name */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110">
            <Image src={logo} alt="FundMe Logo" width={40} height={40} className="object-contain" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors">FundMe.</span>
        </Link>
        
        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-10">
            <Link href="/projects" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-blue-500 transition-colors">Projects</Link>
            <Link href="/create" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-blue-500 transition-colors">Create</Link>
            <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-blue-500 transition-colors">Dashboard</Link>
        </div>

        {/* Wallet Connection Button */}
        <div className="flex items-center gap-4">
          {!mounted ? (
            <div className="h-10 w-32 bg-blue-500/5 animate-pulse border border-blue-500/10" />
          ) : isConnected ? (
            <div className="flex items-center gap-4">
              {isWrongChain && (
                <button
                  onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
                  disabled={isSwitching}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {isSwitching ? 'SWITCHING...' : 'WRONG_NETWORK'}
                </button>
              )}
              <div className="px-4 py-2 bg-blue-500/5 border border-blue-500/20">
                <AddressLink 
                  address={address as string} 
                  shorten={true}
                  className="text-[10px] font-black uppercase text-blue-400" 
                />
              </div>
              <button
                onClick={() => disconnect()}
                className="w-10 h-10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-black transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              disabled={isConnecting}
              className="px-6 py-2.5 bg-blue-500 hover:bg-white text-black transition-colors text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 disabled:bg-blue-500/20 disabled:cursor-not-allowed"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? "CONNECTING..." : "Connect_Wallet"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
