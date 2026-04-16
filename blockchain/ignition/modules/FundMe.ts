import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FundMeModule", (m) => {
  // 1. Deploy the underlying ERC20
  const mockUSDC = m.contract("MockUSDC");
  
  // 2. Deploy the wrapper, passing in the ERC20 address
  const fundMeToken = m.contract("FundMeToken", [mockUSDC]);
  
  // 3. Deploy platform (Assuming it requires the token address)
  const fundMePlatform = m.contract("FundMePlatform", [fundMeToken]);

  return { mockUSDC, fundMeToken, fundMePlatform };
});