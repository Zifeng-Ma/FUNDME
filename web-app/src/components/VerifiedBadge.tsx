'use client';

import { ShieldCheck } from 'lucide-react';

type Props = {
  reclaimProofId: string;
  useSpan?: boolean;
};

function parseTwitterHandle(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith('@')) return null;
  const pipeIdx = value.indexOf('|');
  if (pipeIdx === -1) return null;
  const handle = value.slice(1, pipeIdx).trim();
  return handle || null;
}

export function VerifiedBadge({ reclaimProofId, useSpan = false }: Props) {
  if (!reclaimProofId) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-800 text-neutral-600 font-mono text-[9px] uppercase font-black tracking-widest">
        <ShieldCheck className="w-2.5 h-2.5" /> Unverified
      </span>
    );
  }

  const handle = parseTwitterHandle(reclaimProofId);

  if (handle) {
    const url = `https://x.com/${handle}`;
    const className = "flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 text-green-500 font-mono text-[9px] uppercase font-black tracking-widest hover:bg-green-500/20 transition-colors";

    if (useSpan) {
      return (
        <span
          role="link"
          className={`cursor-pointer ${className}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          <ShieldCheck className="w-2.5 h-2.5" />
          @{handle}
        </span>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <ShieldCheck className="w-2.5 h-2.5" />
        @{handle}
      </a>
    );
  }

  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 text-green-500 font-mono text-[9px] uppercase font-black tracking-widest">
      <ShieldCheck className="w-2.5 h-2.5" /> Verified
    </span>
  );
}
