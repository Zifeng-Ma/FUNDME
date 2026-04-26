import { BLOCK_EXPLORER_URL } from '@/lib/contracts';

interface AddressLinkProps {
  address: string;
  className?: string;
  shorten?: boolean;
  useSpan?: boolean;
}

const shortenAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function AddressLink({ address, className = "", shorten = false, useSpan = false }: AddressLinkProps) {
  if (!address) return null;
  
  const displayAddress = shorten ? shortenAddress(address) : address;
  const url = `${BLOCK_EXPLORER_URL}/address/${address}`;

  if (useSpan) {
    return (
      <span
        role="link"
        className={`hover:underline cursor-pointer transition-all ${className}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
      >
        {displayAddress}
      </span>
    );
  }
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:underline transition-all ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {displayAddress}
    </a>
  );
}
