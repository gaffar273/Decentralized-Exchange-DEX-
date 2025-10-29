const hre = require("hardhat");

async function main() {
  console.log("Deploying to Core Testnet2...");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "tCORE");

  // Deploy Token contracts first (for testing)
  console.log("\n1. Deploying test tokens...");
  const Token = await hre.ethers.getContractFactory("Token");
  
  const tokenA = await Token.deploy("Token A", "TKA", hre.ethers.parseEther("1000000"));
  await tokenA.waitForDeployment();
  console.log("Token A deployed to:", await tokenA.getAddress());

  const tokenB = await Token.deploy("Token B", "TKB", hre.ethers.parseEther("1000000"));
  await tokenB.waitForDeployment();
  console.log("Token B deployed to:", await tokenB.getAddress());

  // Deploy DEX contract
  console.log("\n2. Deploying DEX contract...");
  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy();
  await dex.waitForDeployment();
  
  const dexAddress = await dex.getAddress();
  console.log("DEX deployed to:", dexAddress);

  // Save deployment info
  const deploymentInfo = {
    network: "Core Testnet2",
    chainId: 1114,
    deployer: deployer.address,
    contracts: {
      DEX: dexAddress,
      TokenA: await tokenA.getAddress(),
      TokenB: await tokenB.getAddress()
    },
    explorer: `https://scan.test2.btcs.network/address/${dexAddress}`,
    timestamp: new Date().toISOString()
  };

  console.log("\n✅ Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Save to file
  const fs = require("fs");
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📄 Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
