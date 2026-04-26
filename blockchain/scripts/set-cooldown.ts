import hre from "hardhat";

const FUNDME_PLATFORM_ADDRESS = "0xDfD8E4d158c8dFA2043e23f6630907a30b79fD82";
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
