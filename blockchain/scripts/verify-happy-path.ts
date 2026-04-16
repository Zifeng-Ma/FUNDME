import "@nomicfoundation/hardhat-toolbox-viem";
import hre from "hardhat";
import { parseUnits, keccak256, toHex } from "viem";
const { viem } = await hre.network.connect();

async function main() {
  // Now, TypeScript will correctly recognize `hre.viem`
  const publicClient = await viem.getPublicClient();
  const [deployer, treasury, sponsor] = await viem.getWalletClients();

  console.log(`Sponsoree (Deployer): ${deployer.account.address}`);
  console.log(`Sponsor (Account 2):  ${sponsor.account.address}`);

  // The addresses from your Ignition Deployment
  const mockUsdcAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const fundMeTokenAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const fundMePlatformAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  // Attach our deployed contracts using Viem
  const mockUSDC = await viem.getContractAt("MockUSDC", mockUsdcAddress);
  const fundMeToken = await viem.getContractAt("FundMeToken", fundMeTokenAddress);
  const fundMePlatform = await viem.getContractAt("FundMePlatform", fundMePlatformAddress);

  console.log("\n------------------------------------------------");
  console.log("🚀 STARTING THE HAPPY PATH VERIFICATION (VIEM)");
  console.log("------------------------------------------------");

  // --- Step 1: Give the Sponsor some USDC ---
  console.log("\n👉 Step 1: Distributing Mock USDC...");
  const transferAmount = parseUnits("1000", 6); // USDC typically has 6 decimals
  
  const hashTransfer = await mockUSDC.write.transfer([sponsor.account.address, transferAmount], {
    account: deployer.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: hashTransfer });
  console.log(`✅ Sent 1000 Mock USDC to the Sponsor's wallet.`);

  // --- Step 2: Sponsor Shields USDC into $FUNDME ---
  console.log("\n👉 Step 2: Shielding USDC into Confidential $FUNDME...");
  
  const hashApprove = await mockUSDC.write.approve([fundMeTokenAddress, transferAmount], {
    account: sponsor.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: hashApprove });
  console.log(`✅ Sponsor approved the wrapper contract.`);

  const hashShield = await fundMeToken.write.shield([transferAmount], {
    account: sponsor.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: hashShield });
  console.log(`✅ Sponsor shielded 1000 USDC.`);

  // --- Step 3: Sponsoree Creates a Funding Project ---
  console.log("\n👉 Step 3: Creating a Funding Project...");
  const hashProject = await fundMePlatform.write.createProject([7n, 3, "reclaim-github-proof-xyz"], {
    account: deployer.account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: hashProject });
  console.log(`✅ Project Created successfully! (Project ID: 0)`);

  // --- Step 4: Sponsor Funds the Project Blindly ---
  console.log("\n👉 Step 4: Sponsoring the Project with Encrypted Amount...");
  
  const mockEncryptedAmount = keccak256(toHex("ENCRYPTED_500_USDC_MOCK"));
  
  const hashSponsor = await fundMePlatform.write.sponsorProject([0n, mockEncryptedAmount], {
    account: sponsor.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: hashSponsor });
  console.log(`✅ Sponsor funded Project #0 with encrypted bytes32 handle!`);

  console.log("\n🎉 SUCCESS! The Viem-based Smart Contract Architecture is verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});