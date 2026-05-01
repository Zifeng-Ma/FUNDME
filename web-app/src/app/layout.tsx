import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "../components/Navbar"; 

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "FundMe | Confidential Web3 Crowdfunding",
  description: "Fund the future, confidentially. Built on Arbitrum Sepolia using ERC-7984 and iExec Nox protocol for absolute secrecy and gamified leaderboards.",
  openGraph: {
    title: "FundMe | Confidential Web3 Crowdfunding",
    description: "Fund the future, confidentially. Built on Arbitrum Sepolia using ERC-7984 and iExec Nox protocol for absolute secrecy and gamified leaderboards.",
    images: [
      {
        url: "/0.png",
        width: 1200,
        height: 630,
        alt: "FundMe Platform Preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FundMe | Confidential Web3 Crowdfunding",
    description: "Fund the future, confidentially. Built on Arbitrum Sepolia using ERC-7984 and iExec Nox protocol for absolute secrecy and gamified leaderboards.",
    images: ["/0.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className={`${inter.variable} ${jetbrains.variable} font-mono bg-surface-base text-neutral-50 antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}