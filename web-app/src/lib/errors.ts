// Best-effort detection of the Arbitrum Sepolia "underpriced" / "base fee"
// family of errors. When we match, the UI surfaces an actionable prompt
// telling the user to bump their gas with MetaMask's Aggressive setting
// instead of silently swallowing the failure.
export const isUnderpricedGasError = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('max fee per gas less than block base fee') ||
    msg.includes('replacement transaction underpriced') ||
    msg.includes('transaction underpriced') ||
    msg.includes('fee too low')
  );
};

// Standard "user rejected the request" error thrown by injected wallets.
export const isUserRejection = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected the request')
  );
};
