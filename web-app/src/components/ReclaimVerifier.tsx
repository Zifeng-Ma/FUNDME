'use client';

import { useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, XCircle, Activity, ChevronRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import { motion } from "framer-motion";

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
      setVerifyState('awaiting_proof');
      setErrorMsg(null);

      const res = await fetch('/api/reclaim/request', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setVerifyState('failed');
        setErrorMsg(body.error ?? 'Failed to initialize verification session.');
        return;
      }
      const { requestUrl: sessionUrl, serialized } = await res.json();

      const { ReclaimProofRequest } = await import('@reclaimprotocol/js-sdk');
      const proofRequest = await ReclaimProofRequest.fromJsonString(serialized);

      const onSuccess = async (proof: any) => {
        try {
          const { verifyProof } = await import('@reclaimprotocol/js-sdk');
          await verifyProof(proof, proofRequest.getProviderVersion());

          const proofId = proof.identifier as string;

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
            // context parse failed
          }

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

      setRequestUrl(sessionUrl);
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
    <div className="font-mono">
      {/* Base UI */}
      {verifyState === 'idle' && (
        <button
          type="button"
          onClick={handleStartVerification}
          className="w-full py-3 px-4 bg-black border border-indigo-500/10 hover:border-indigo-500/40 text-[10px] text-neutral-500 hover:text-indigo-400 font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
        >
          <ShieldCheck className="w-4 h-4" /> Verify_Identity (Optional)
        </button>
      )}

      {verifyState === 'awaiting_proof' && (
        <button
          type="button"
          disabled
          className="w-full py-3 px-4 bg-black border border-indigo-500/20 text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center justify-center gap-3 cursor-wait"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> SESSION_ACTIVE...
        </button>
      )}

      {verifyState === 'verified' && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 py-4 px-6 bg-green-500/5 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                Identity_Confirmed
              </p>
              {verifiedId && (
                <p className="text-[9px] text-green-500/60 font-mono mt-1 truncate uppercase">
                  ID: {verifiedId}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-[9px] text-neutral-600 hover:text-indigo-400 uppercase tracking-tighter flex items-center gap-1 transition-colors"
          >
            [TERMINATE_SESSION]
          </button>
        </div>
      )}

      {verifyState === 'failed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 py-4 px-6 bg-red-500/5 border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-red-500 uppercase font-black">{errorMsg || 'VERIFICATION_FAILED'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-3 px-4 bg-black border border-red-500/20 hover:border-red-500 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            RETRY_INITIALIZATION
          </button>
        </div>
      )}

      {/* Modal Overlay */}
      {verifyState === 'awaiting_proof' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#050505] border-2 border-indigo-500/30 p-1 max-w-sm w-full font-mono shadow-2xl relative"
          >
            <div className="bg-indigo-500/10 p-4 border border-indigo-500/20 mb-1 flex justify-between items-center">
              <span className="text-indigo-500 uppercase text-[10px] font-black tracking-widest">Identity_Protocol // Reclaim</span>
              <Activity className="w-3 h-3 text-indigo-500 animate-pulse" />
            </div>

            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 border border-indigo-500/10 flex items-center justify-center mb-8 bg-indigo-500/5">
                <ShieldCheck className="w-8 h-8 text-indigo-500" />
              </div>
              
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Confirm <span className="text-indigo-500">Node_ID.</span></h3>
              <p className="text-[10px] text-neutral-500 uppercase leading-tight mb-10">
                SCAN THE QR CODE TO ATTEST YOUR SOCIAL IDENTITY VIA ZERO-KNOWLEDGE PROOF. DATA REMAINS OBFUSCATED.
              </p>

              <div className="relative group mb-10">
                {requestUrl ? (
                  <div className="bg-white p-4">
                    <QRCode value={requestUrl} size={180} />
                  </div>
                ) : (
                  <div className="h-[212px] w-[212px] flex items-center justify-center bg-black border border-indigo-500/5">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col w-full gap-4 relative z-10">
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full py-4 border border-indigo-500/20 text-indigo-500/40 text-[10px] font-black uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-500 transition-all"
                >
                  [CANCEL_ATTESTATION]
                </button>
                
                {requestUrl && (
                  <p className="text-[9px] text-center text-neutral-600 uppercase tracking-tight">
                    MOBILE_DETECTED?{' '}
                    <a
                      href={requestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-500 hover:text-white underline"
                    >
                      OPEN_DIRECT_LINK
                    </a>
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-2 border-t border-indigo-500/10 flex justify-between text-[8px] text-neutral-700 uppercase">
               <span>ZK_IDENTITY_LAYER</span>
               <span>VER_0.4.2</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
