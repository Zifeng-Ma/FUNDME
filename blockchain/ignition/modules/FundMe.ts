import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Hardhat Ignition uses a declarative approach
export default buildModule("FundMeProtocolModule", (m) => {
  // 1. Get local accounts (deployer will be index 0, treasury index 1)
  const deployer = m.getAccount(0);
  const treasury = m.getAccount(1);

  // 2. Deploy the Mock USDC token
  const mockUSDC = m.contract("MockUSDC",[], { from: deployer });

  // 3. Deploy the FundMeToken 
  // We pass the deployed mockUSDC address and the treasury account
  const fundMeToken = m.contract("FundMeToken", [mockUSDC, treasury], { 
    from: deployer 
  });

  // 4. Deploy the FundMePlatform
  // We pass the deployed fundMeToken address
  const fundMePlatform = m.contract("FundMePlatform",[fundMeToken], { 
    from: deployer 
  });

  // Return the deployed instances so Ignition knows about them
  return { mockUSDC, fundMeToken, fundMePlatform };
});