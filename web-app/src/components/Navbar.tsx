'use client'; // This is a client component

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LogOut, Wallet } from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from 'wagmi/chains'
import { AddressLink } from "./AddressLink";

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Wagmi hooks to get account status and connection functions
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== arbitrumSepolia.id;

  return (
    <nav className="border-b border-neutral-800/50 bg-neutral-950/50 backdrop-blur-md sticky top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo and App Name */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="FundMe logo" width={32} height={32} />
          <span className="text-xl font-bold tracking-widest uppercase">FundMe</span>
        </Link>
        
        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
            <Link href="/projects" className="text-neutral-400 hover:text-white transition-colors">Explore Projects</Link>
            <Link href="/create" className="text-neutral-400 hover:text-white transition-colors">Create Campaign</Link>
            <Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors">Dashboard</Link>
        </div>

        {/* Wallet Connection Button */}
        <div className="flex items-center gap-4">
          {!mounted ? (
            <div className="h-10 w-32 bg-neutral-800/50 rounded-full animate-pulse" />
          ) : isConnected ? (
            <div className="flex items-center gap-3">
              {isWrongChain && (
                <button
                  onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
                  disabled={isSwitching}
                  className="px-4 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isSwitching ? 'Switching…' : 'Switch to Arbitrum Sepolia'}
                </button>
              )}
              <div className="px-4 py-2 rounded-full bg-neutral-800 border border-neutral-700">
                <AddressLink 
                  address={address as string} 
                  shorten={true}
                  className="text-sm font-mono text-neutral-300" 
                />
              </div>
              <button
                onClick={() => disconnect()}
                className="p-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              disabled={isConnecting}
              className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-semibold tracking-wide flex items-center gap-2 disabled:bg-indigo-800 disabled:cursor-not-allowed"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}