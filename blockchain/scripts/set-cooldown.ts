import hre from "hardhat";

const FUNDME_PLATFORM_ADDRESS = "0xD74cC75D381d607f49Bb0D647f8f719E185EeF3A";
const COOLDOWN_SECONDS = 30n;

async function main() {
  const { viem } = await hre.network.connect();
  const platform = await viem.getContractAt("FundMePlatform", FUNDME_PLATFORM_ADDRESS);

  const current = await platform.read.leaderboardCooldown();
  console.log(`Current cooldown: ${current}s`);

  const hash = await platform.write.setLeaderboardCooldown([COOLDOWN_SECONDS]);
  console.log(`tx: ${hash}`);

  const updated = await platform.read.leaderboardCooldown();
  console.log(`Updated cooldown: ${updated}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
