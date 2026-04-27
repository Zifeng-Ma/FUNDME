'use client';

import { useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import QRCode from 'react-qr-code';

type VerifyState = 'idle' | 'awaiting_proof' | 'verified' | 'failed';

type Props = {
  onVerified: (proofId: string) => void;
  onCleared: () => void;
};

export function ReclaimVerifier({ onVerified, onCleared }: Props) {
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [requestUrl, setRequestUrl] = useState<string | null>(null);
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStartVerification = async () => {
    try {
      const appId = process.env.NEXT_PUBLIC_RECLAIM_APP_ID;
      const appSecret = process.env.NEXT_PUBLIC_RECLAIM_APP_SECRET;
      const providerId = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_ID;

      if (!appId || !appSecret || !providerId) {
        setVerifyState('failed');
        setErrorMsg(
          'Reclaim credentials not configured. Set NEXT_PUBLIC_RECLAIM_APP_ID, NEXT_PUBLIC_RECLAIM_APP_SECRET, and NEXT_PUBLIC_RECLAIM_PROVIDER_ID.'
        );
        return;
      }

      setVerifyState('awaiting_proof');
      setErrorMsg(null);

      // Dynamic import to defer the heavy crypto bundle
      const { ReclaimProofRequest } = await import('@reclaimprotocol/js-sdk');

      const proofRequest = await ReclaimProofRequest.init(appId, appSecret, providerId);

      const onSuccess = async (proof: any) => {
        try {
          const { verifyProof } = await import('@reclaimprotocol/js-sdk');
          await verifyProof(proof, proofRequest.getProviderVersion());

          const proofId = proof.identifier as string;

          // Try to extract the Twitter/X handle from the proof context so
          // sponsors can see which account is associated with this campaign.
          let twitterHandle: string | null = null;
          try {
            const ctx = proof?.claimData?.context
              ? JSON.parse(proof.claimData.context as string)
              : null;
            const params = ctx?.extractedParameters ?? ctx?.parameters ?? null;
            twitterHandle =
              params?.screen_name ??
              params?.username ??
              params?.handle ??
              null;
          } catch {
            // context parse failed — handle stays null
          }

          // Encode handle into the stored string so VerifiedBadge can display
          // a link without needing an extra chain field.
          // Format: "@handle|proofId"  (fallback: just proofId for old format)
          const storedValue = twitterHandle
            ? `@${twitterHandle}|${proofId}`
            : proofId;

          setVerifiedId(twitterHandle ? `@${twitterHandle}` : proofId);
          setVerifyState('verified');
          onVerified(storedValue);
        } catch (err) {
          setVerifyState('failed');
          setErrorMsg(
            err instanceof Error ? err.message : 'Proof verification failed'
          );
        }
      };

      const onError = (err: any) => {
        setVerifyState('failed');
        setErrorMsg(err?.message ?? 'Verification failed');
      };

      const url = await proofRequest.getRequestUrl({ verificationMode: 'app' });
      setRequestUrl(url);

      await proofRequest.startSession({ onSuccess, onError });
    } catch (err) {
      setVerifyState('failed');
      setErrorMsg(err instanceof Error ? err.message : 'Initialization failed');
    }
  };

  const handleClear = () => {
    setVerifyState('idle');
    setRequestUrl(null);
    setVerifiedId(null);
    setErrorMsg(null);
    onCleared();
  };

  const handleRetry = () => {
    setVerifyState('idle');
    setErrorMsg(null);
  };

  return (
    <>
      {/* Base UI */}
      {verifyState === 'idle' && (
        <button
          type="button"
          onClick={handleStartVerification}
          className="w-full py-3 px-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-indigo-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" /> Verify Twitter/X identity (optional)
        </button>
      )}

      {verifyState === 'awaiting_proof' && (
        <button
          type="button"
          disabled
          className="w-full py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 font-semibold flex items-center justify-center gap-2 cursor-wait"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> Verifying identity...
        </button>
      )}

      {verifyState === 'verified' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-3 px-4 bg-emerald-950/40 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-400">
                Twitter/X identity verified
              </p>
              {verifiedId && (
                <p className="text-xs text-emerald-300/60 font-mono mt-1 truncate">
                  {verifiedId}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {verifyState === 'failed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 py-3 px-4 bg-red-950/40 rounded-xl border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{errorMsg || 'Verification failed'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-3 px-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-red-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Modal Overlay */}
      {verifyState === 'awaiting_proof' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-neutral-900 border border-indigo-500/30 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
            
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
            
            <h3 className="text-xl font-bold mb-2">Verify your identity</h3>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
              Scan the QR code with your phone camera to verify your Twitter/X handle via Reclaim Protocol.
            </p>

            <div className="relative group">
              <div className="absolute -inset-4 bg-indigo-500/5 blur-xl rounded-full group-hover:bg-indigo-500/10 transition-colors" />
              {requestUrl ? (
                <div className="relative bg-white p-4 rounded-3xl mb-8 shadow-inner">
                  <QRCode value={requestUrl} size={180} />
                </div>
              ) : (
                <div className="relative h-[212px] w-[212px] flex items-center justify-center mb-8 bg-neutral-800/50 rounded-3xl">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex flex-col w-full gap-4 relative z-10">
               <button
                type="button"
                onClick={handleClear}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              
              {requestUrl && (
                <p className="text-[11px] text-center text-neutral-500">
                  Already on mobile?{' '}
                  <a
                    href={requestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    Tap here to open Reclaim
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
