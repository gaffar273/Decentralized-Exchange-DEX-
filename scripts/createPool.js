const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n💧 Initializing Liquidity Pool...\n");

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "../deployment-addresses.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment file not found. Please run deploy.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Get contract instances
  const tokenA = await hre.ethers.getContractAt(
    "MockToken",
    deployment.contracts.tokenA.address
  );

  const tokenB = await hre.ethers.getContractAt(
    "MockToken",
    deployment.contracts.tokenB.address
  );

  const dex = await hre.ethers.getContractAt(
    "SimpleDEX",
    deployment.contracts.dex.address
  );

  console.log("📊 Current Token Balances:");
  const balanceA = await tokenA.balanceOf(signer.address);
  const balanceB = await tokenB.balanceOf(signer.address);
  console.log("  TokenA:", hre.ethers.formatEther(balanceA), "TKA");
  console.log("  TokenB:", hre.ethers.formatEther(balanceB), "TKB\n");

  // Define liquidity amounts
  const liquidityA = hre.ethers.parseEther("1000"); // 1000 TKA
  const liquidityB = hre.ethers.parseEther("2000"); // 2000 TKB (1:2 ratio)

  console.log("💧 Adding Initial Liquidity:");
  console.log("  TokenA:", hre.ethers.formatEther(liquidityA), "TKA");
  console.log("  TokenB:", hre.ethers.formatEther(liquidityB), "TKB");
  console.log("  Initial Price: 1 TKA = 2 TKB\n");

  // Check if we have enough tokens
  if (balanceA < liquidityA || balanceB < liquidityB) {
    console.log("⚠️  Insufficient token balance. Minting more tokens...");
    
    if (balanceA < liquidityA) {
      const mintAmount = liquidityA - balanceA + hre.ethers.parseEther("100");
      await tokenA.mint(signer.address, mintAmount);
      console.log("✅ Minted", hre.ethers.formatEther(mintAmount), "TKA");
    }

    if (balanceB < liquidityB) {
      const mintAmount = liquidityB - balanceB + hre.ethers.parseEther("100");
      await tokenB.mint(signer.address, mintAmount);
      console.log("✅ Minted", hre.ethers.formatEther(mintAmount), "TKB\n");
    }
  }

  // Approve tokens
  console.log("🔐 Approving tokens...");
  
  const approveTxA = await tokenA.approve(deployment.contracts.dex.address, liquidityA);
  await approveTxA.wait();
  console.log("✅ TokenA approved");

  const approveTxB = await tokenB.approve(deployment.contracts.dex.address, liquidityB);
  await approveTxB.wait();
  console.log("✅ TokenB approved\n");

  // Add liquidity
  console.log("💧 Adding liquidity to pool...");
  
  const addLiquidityTx = await dex.addLiquidity(liquidityA, liquidityB);
  const receipt = await addLiquidityTx.wait();
  
  console.log("✅ Liquidity added!");
  console.log("   Transaction hash:", receipt.hash);

  // Get LP token balance
  const lpBalance = await dex.balanceOf(signer.address);
  console.log("   LP tokens received:", hre.ethers.formatEther(lpBalance), "SDEX-LP\n");

  // Get pool reserves
  const [reserveA, reserveB] = await dex.getReserves();
  console.log("📊 Pool Reserves:");
  console.log("   TokenA:", hre.ethers.formatEther(reserveA), "TKA");
  console.log("   TokenB:", hre.ethers.formatEther(reserveB), "TKB");

  // Get prices
  const priceAInB = await dex.getPriceAInB();
  const priceBInA = await dex.getPriceBInA();
  console.log("\n💰 Current Prices:");
  console.log("   1 TKA =", hre.ethers.formatEther(priceAInB), "TKB");
  console.log("   1 TKB =", hre.ethers.formatEther(priceBInA), "TKA");

  // Calculate pool value
  const totalValueInA = reserveA + (reserveB * priceAInB / hre.ethers.parseEther("1"));
  console.log("\n📈 Pool Statistics:");
  console.log("   Total Value (in TKA):", hre.ethers.formatEther(totalValueInA), "TKA");
  console.log("   LP Token Supply:", hre.ethers.formatEther(lpBalance), "SDEX-LP");

  // Test swap calculation
  const testSwapAmount = hre.ethers.parseEther("10");
  const expectedOut = await dex.getAmountOut(testSwapAmount, reserveA, reserveB);
  
  console.log("\n🔄 Example Swap:");
  console.log("   Swapping", hre.ethers.formatEther(testSwapAmount), "TKA");
  console.log("   Would receive ≈", hre.ethers.formatEther(expectedOut), "TKB");
  console.log("   (with 0.3% trading fee)");

  console.log("\n✅ Pool initialization complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Pool creation failed:");
    console.error(error);
    process.exit(1);
  });
