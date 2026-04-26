Key idea: decrypt lets you securely read encrypted handle data—but only if your wallet is authorized via the on-chain ACL.

What it’s used for:

Accessing private encrypted data
Ensuring only approved users (owner or whitelisted addresses) can decrypt
Keeping the plaintext fully end-to-end secure (never exposed over the network)

How it works (simplified):

SDK creates a temporary RSA keypair + message
Your wallet signs it (EIP-712, no gas)
Gateway verifies your permission via ACL
Data is encrypted specifically for you
SDK decrypts it locally → plaintext never leaves your device

Inputs:

handle: 32-byte hex string (must be on the same chain)

Outputs:

value: decrypted data (boolean, string, or bigint)
solidityType: original Solidity type

Why it’s important:

Fully gasless (no transaction needed)
Strong access control via on-chain ACL
Maximum privacy: decryption happens locally

When to use it:

When the data is private or restricted
When you need secure, permissioned access
