'use client';

import { ShieldCheck } from 'lucide-react';

type Props = {
  reclaimProofId: string;
  useSpan?: boolean;
};

// Parses the stored proof string.
// New format: "@handle|proofId"  →  returns the handle
// Old format: any non-empty string without "|"  →  returns null (just "Verified")
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
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800/60 border border-neutral-700/40 text-neutral-500 text-xs font-medium">
        <ShieldCheck className="w-3 h-3" /> Unverified
      </span>
    );
  }

  const handle = parseTwitterHandle(reclaimProofId);

  if (handle) {
    const url = `https://x.com/${handle}`;
    const className = "flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors";

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
          <ShieldCheck className="w-3 h-3" />
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
        <ShieldCheck className="w-3 h-3" />
        @{handle}
      </a>
    );
  }

  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
      <ShieldCheck className="w-3 h-3" /> Verified
    </span>
  );
}
