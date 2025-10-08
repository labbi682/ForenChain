const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying EvidenceChain contract...");

  const EvidenceChain = await hre.ethers.getContractFactory("EvidenceChain");
  const evidenceChain = await EvidenceChain.deploy();

  await evidenceChain.waitForDeployment();

  const address = await evidenceChain.getAddress();
  console.log(`✅ EvidenceChain deployed to: ${address}`);
  console.log(`\n📝 Update your .env file with:`);
  console.log(`CONTRACT_ADDRESS=${address}`);

  // Wait for block confirmations
  console.log("\n⏳ Waiting for block confirmations...");
  await evidenceChain.deploymentTransaction().wait(5);

  // Verify contract on Polygonscan (if on testnet/mainnet)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n🔍 Verifying contract on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: []
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
