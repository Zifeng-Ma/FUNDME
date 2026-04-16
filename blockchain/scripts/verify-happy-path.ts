import "@nomicfoundation/hardhat-toolbox-viem";
import hre from "hardhat";
import { parseUnits, parseEventLogs } from "viem";
// NEW: Import the correct NOX handle client
import { createViemHandleClient } from '@iexec-nox/handle';

async function main() {
  // @ts-ignore
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  
  // We use this walletClient directly for the NOX SDK
  const [walletClient] = await viem.getWalletClients();
  const userAddress = walletClient.account.address;

  console.log(`------------------------------------------------`);
  console.log(`🚀 VERIFYING ON ARBITRUM SEPOLIA`);
  console.log(`Wallet: ${userAddress}`);
  console.log(`------------------------------------------------`);

  const mockUsdcAddress = "0xaf108417318b7BfdF9B74527326Cc5287080187e";
  const fundMeTokenAddress = "0x347128DE4BEb35701927579869C32E0f1996dcc6";
  const fundMePlatformAddress = "0x5dCa68Ceb507237196e0b903e67b5791d94A4DC2";

  const mockUSDC = await viem.getContractAt("MockUSDC", mockUsdcAddress);
  const fundMeToken = await viem.getContractAt("FundMeToken", fundMeTokenAddress);
  const fundMePlatform = await viem.getContractAt("FundMePlatform", fundMePlatformAddress);

  // --- Step 1: Wrap USDC ---
  console.log("\n👉 Step 1: Shielding USDC...");
  const amount = parseUnits("10", 6); 
  
  console.log("Approving USDC...");
  const hashApprove = await mockUSDC.write.approve([fundMeTokenAddress, amount]);
  await publicClient.waitForTransactionReceipt({ hash: hashApprove });

  console.log("Wrapping into Confidential FUNDME...");
  const hashWrap = await fundMeToken.write.wrap([userAddress, amount]);
  await publicClient.waitForTransactionReceipt({ hash: hashWrap });
  console.log(`✅ Wrapped successfully!`);

  // --- Step 2: Grant Permission ---
  console.log("\n👉 Step 2: Granting Operator Permission...");
  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; 
  
  const hashSetOperator = await fundMeToken.write.setOperator([fundMePlatformAddress, futureTimestamp]);
  await publicClient.waitForTransactionReceipt({ hash: hashSetOperator });
  console.log(`✅ Platform is now an operator.`);

  // --- Step 3: Create Project ---
  console.log("\n👉 Step 3: Creating a Funding Project...");
  const hashProject = await fundMePlatform.write.createProject([7n, 3, "test-nox-verification"]);
  const receiptProject = await publicClient.waitForTransactionReceipt({ hash: hashProject });
  
  const projectLogs = parseEventLogs({
    abi: fundMePlatform.abi,
    eventName: 'ProjectCreated',
    logs: receiptProject.logs,
  });
  const projectId = projectLogs[0].args.projectId as bigint;
  console.log(`✅ Project #${projectId} Created!`);

  // --- Step 4: Sponsor using the JS SDK ---
  console.log(`\n👉 Step 4: Sponsoring Project #${projectId} with the JS SDK...`);
  
  const sponsorAmount = parseUnits("5", 6);
  
  console.log("Initializing NOX Handle Client...");
  // Initialize the NOX client using Hardhat's walletClient
  const handleClient = await createViemHandleClient(walletClient);

  console.log("Encrypting the sponsorship amount locally...");
  // Use the encryptInput method to generate the external handle and the EIP-712 proof
  const { handle, handleProof } = await handleClient.encryptInput(
    sponsorAmount,
    "uint256",
    fundMePlatformAddress // The target contract that will execute Nox.fromExternal
  );

  console.log(`Sending the on-chain transaction with encrypted data...`);
  const hashSponsor = await fundMePlatform.write.sponsorProject([
    projectId, 
    handle as `0x${string}`, 
    handleProof as `0x${string}`
  ]);
  
  await publicClient.waitForTransactionReceipt({ hash: hashSponsor });
  
  console.log(`✅ SUCCESS! Project #${projectId} blindly funded using the iExec NOX Protocol!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});