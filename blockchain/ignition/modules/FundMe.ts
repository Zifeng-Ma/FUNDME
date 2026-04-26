import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("FundMeModule", (m) => {
  // Use the Official Circle USDC on Arbitrum Sepolia
  const REAL_TESTNET_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  
  // Deploy the wrapper, passing in the REAL USDC address
  const fundMeToken = m.contract("FundMeToken", [REAL_TESTNET_USDC]);
  
  // Deploy platform
  const fundMePlatform = m.contract("FundMePlatform", [fundMeToken]);

  return { fundMeToken, fundMePlatform };
});