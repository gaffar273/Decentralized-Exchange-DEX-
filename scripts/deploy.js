const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Starting deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy Mock Tokens (for testing)
  console.log("📦 Deploying Mock Tokens...");
  
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  
  const tokenA = await MockToken.deploy(
    "Test Token A",
    "TKA",
    hre.ethers.parseEther("1000000") // 1 million tokens
  );
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("✅ TokenA (TKA) deployed to:", tokenAAddress);

  const tokenB = await MockToken.deploy(
    "Test Token B",
    "TKB",
    hre.ethers.parseEther("1000000") // 1 million tokens
  );
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("✅ TokenB (TKB) deployed to:", tokenBAddress);

  console.log();

  // Deploy SimpleDEX
  console.log("📦 Deploying SimpleDEX...");
  
  const SimpleDEX = await hre.ethers.getContractFactory("SimpleDEX");
  const dex = await SimpleDEX.deploy(tokenAAddress, tokenBAddress);
  await dex.waitForDeployment();
  const dexAddress = await dex.getAddress();
  console.log("✅ SimpleDEX deployed to:", dexAddress);

  console.log();

  // Deploy Project Factory
  console.log("📦 Deploying Project Factory...");
  
  const Project = await hre.ethers.getContractFactory("Project");
  const project = await Project.deploy(dexAddress);
  await project.waitForDeployment();
  const projectAddress = await project.getAddress();
  console.log("✅ Project Factory deployed to:", projectAddress);

  console.log();

  // Save deployment addresses
  const deploymentData = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      tokenA: {
        address: tokenAAddress,
        name: "Test Token A",
        symbol: "TKA"
      },
      tokenB: {
        address: tokenBAddress,
        name: "Test Token B",
        symbol: "TKB"
      },
      dex: {
        address: dexAddress,
        name: "SimpleDEX"
      },
      projectFactory: {
        address: projectAddress,
        name: "Project Factory"
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

  // Also save to root for easy access
  fs.writeFileSync(
    path.join(__dirname, "../deployment-addresses.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("📝 Deployment addresses saved to:");
  console.log("   -", filepath);
  console.log("   - deployment-addresses.json");

  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("ChainId:", deploymentData.chainId);
  console.log("\nContract Addresses:");
  console.log("  TokenA (TKA):", tokenAAddress);
  console.log("  TokenB (TKB):", tokenBAddress);
  console.log("  SimpleDEX:", dexAddress);
  console.log("  Project Factory:", projectAddress);
  console.log("=".repeat(60));

  // Verification instructions
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n📌 To verify contracts on Etherscan, run:");
    console.log(`\nnpx hardhat verify --network ${hre.network.name} ${tokenAAddress} "Test Token A" "TKA" "1000000000000000000000000"`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${tokenBAddress} "Test Token B" "TKB" "1000000000000000000000000"`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${dexAddress} ${tokenAAddress} ${tokenBAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${projectAddress} ${dexAddress}`);
  }

  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
