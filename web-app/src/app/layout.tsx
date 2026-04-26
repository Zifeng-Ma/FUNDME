import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "../components/Navbar"; 

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "FundMe | Confidential Web3 Crowdfunding",
  description: "Fund the future, confidentially. Built on Arbitrum Sepolia using ERC-7984 and iExec Nox protocol for absolute secrecy and gamified leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className={`${inter.variable} font-sans bg-neutral-950 text-neutral-50 antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          {/* Navbar is placed here, above the page content */}
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}