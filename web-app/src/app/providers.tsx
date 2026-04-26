'use client' // This whole file is a client-side component

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { Toaster } from 'react-hot-toast'

// Explicitly register the injected (MetaMask) connector so wagmi can
// call switchChain automatically when a write targets a different chainId.
const config = createConfig({
  chains: [arbitrumSepolia, sepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(), 
  },
  ssr: true,
})

// React Query client
const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#171717',
              color: '#fafafa',
              border: '1px solid #404040',
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  )
}