import hre from "hardhat";
import { createViemHandleClient } from '@iexec-nox/handle';

async function main() {
  const { viem } = await hre.network.connect();
  const [walletClient] = await viem.getWalletClients();
  
  const fundMeTokenAddress = "0x347128DE4BEb35701927579869C32E0f1996dcc6";
  const fundMeToken = await viem.getContractAt("FundMeToken", fundMeTokenAddress);

  // 1. Fetch the encrypted 'handle' from the blockchain
  const encryptedBalance = await fundMeToken.read.confidentialBalanceOf([walletClient.account.address]);
  console.log(`On-chain Encrypted Handle: ${encryptedBalance}`);

  // 2. Use the NOX SDK + your Private Key to decrypt it locally
  const handleClient = await createViemHandleClient(walletClient);
  const { value } = await handleClient.decrypt(encryptedBalance);

  console.log(`-----------------------------------------`);
  console.log(`✅ YOUR DECRYPTED BALANCE: ${Number(value) / 1e6} USDC`);
  console.log(`-----------------------------------------`);
}

main().catch(console.error);