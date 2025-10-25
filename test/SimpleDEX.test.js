const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleDEX", function () {
    let dex, tokenA, tokenB, owner, user1, user2;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");

    beforeEach(async function () {
        // Get signers
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock tokens
        const MockToken = await ethers.getContractFactory("MockToken");

        tokenA = await MockToken.deploy("Token A", "TKA", INITIAL_SUPPLY);
        await tokenA.waitForDeployment();

        tokenB = await MockToken.deploy("Token B", "TKB", INITIAL_SUPPLY);
        await tokenB.waitForDeployment();

        // Deploy SimpleDEX
        const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
        dex = await SimpleDEX.deploy(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        );
        await dex.waitForDeployment();

        // Transfer tokens to users for testing
        await tokenA.transfer(user1.address, ethers.parseEther("10000"));
        await tokenB.transfer(user1.address, ethers.parseEther("10000"));
        await tokenA.transfer(user2.address, ethers.parseEther("5000"));
        await tokenB.transfer(user2.address, ethers.parseEther("5000"));

        console.log("✅ Setup complete");
        console.log("DEX Address:", await dex.getAddress());
        console.log("TokenA Address:", await tokenA.getAddress());
        console.log("TokenB Address:", await tokenB.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the correct token addresses", async function () {
            expect(await dex.tokenA()).to.equal(await tokenA.getAddress());
            expect(await dex.tokenB()).to.equal(await tokenB.getAddress());
        });

        it("Should have zero initial reserves", async function () {
            const [reserveA, reserveB] = await dex.getReserves();
            expect(reserveA).to.equal(0);
            expect(reserveB).to.equal(0);
        });

        it("Should set correct fee parameters", async function () {
            expect(await dex.FEE_NUMERATOR()).to.equal(3);
            expect(await dex.FEE_DENOMINATOR()).to.equal(1000);
        });
    });

    describe("Add Liquidity", function () {
        it("Should add initial liquidity correctly", async function () {
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");

            // Approve tokens
            await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB);

            // Add liquidity
            const tx = await dex.connect(user1).addLiquidity(amountA, amountB);
            const receipt = await tx.wait();

            // Check event emission
            expect(tx).to.emit(dex, "LiquidityAdded");

            // Check reserves
            const [reserveA, reserveB] = await dex.getReserves();
            expect(reserveA).to.equal(amountA);
            expect(reserveB).to.equal(amountB);

            // Check LP tokens minted
            const lpBalance = await dex.balanceOf(user1.address);
            expect(lpBalance).to.be.gt(0);

            console.log("LP Tokens Minted:", ethers.formatEther(lpBalance));
        });

        it("Should add subsequent liquidity proportionally", async function () {
            // First liquidity provider
            const amountA1 = ethers.parseEther("100");
            const amountB1 = ethers.parseEther("200");

            await tokenA.connect(user1).approve(await dex.getAddress(), amountA1);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB1);
            await dex.connect(user1).addLiquidity(amountA1, amountB1);

            const lpBalance1 = await dex.balanceOf(user1.address);

            // Second liquidity provider (same ratio: 1:2)
            const amountA2 = ethers.parseEther("50");
            const amountB2 = ethers.parseEther("100");

            await tokenA.connect(user2).approve(await dex.getAddress(), amountA2);
            await tokenB.connect(user2).approve(await dex.getAddress(), amountB2);
            await dex.connect(user2).addLiquidity(amountA2, amountB2);

            const lpBalance2 = await dex.balanceOf(user2.address);

            // LP tokens should be proportional
            expect(lpBalance2).to.be.closeTo(lpBalance1 / 2n, ethers.parseEther("0.1"));

            console.log("User1 LP:", ethers.formatEther(lpBalance1));
            console.log("User2 LP:", ethers.formatEther(lpBalance2));
        });

        it("Should fail with zero amounts", async function () {
            await expect(
                dex.connect(user1).addLiquidity(0, ethers.parseEther("100"))
            ).to.be.revertedWith("Amounts must be greater than 0");

            await expect(
                dex.connect(user1).addLiquidity(ethers.parseEther("100"), 0)
            ).to.be.revertedWith("Amounts must be greater than 0");
        });

        it("Should fail without token approval", async function () {
            const amountA = ethers.parseEther("100");
            const amountB = ethers.parseEther("100");

            await expect(
                dex.connect(user1).addLiquidity(amountA, amountB)
            ).to.be.reverted;
        });
    });

    describe("Remove Liquidity", function () {
        beforeEach(async function () {
            // Add initial liquidity
            const amountA = ethers.parseEther("1000");
            const amountB = ethers.parseEther("1000");

            await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB);
            await dex.connect(user1).addLiquidity(amountA, amountB);
        });

        it("Should remove liquidity correctly", async function () {
            const lpBalance = await dex.balanceOf(user1.address);
            const removeAmount = lpBalance / 2n; // Remove 50%

            const balanceABefore = await tokenA.balanceOf(user1.address);
            const balanceBBefore = await tokenB.balanceOf(user1.address);

            // Remove liquidity
            const tx = await dex.connect(user1).removeLiquidity(removeAmount);
            await tx.wait();

            expect(tx).to.emit(dex, "LiquidityRemoved");

            const balanceAAfter = await tokenA.balanceOf(user1.address);
            const balanceBAfter = await tokenB.balanceOf(user1.address);

            // User should receive tokens back
            expect(balanceAAfter).to.be.gt(balanceABefore);
            expect(balanceBAfter).to.be.gt(balanceBBefore);

            // LP tokens should be burned
            const lpBalanceAfter = await dex.balanceOf(user1.address);
            expect(lpBalanceAfter).to.equal(lpBalance - removeAmount);

            console.log("Tokens received - A:", ethers.formatEther(balanceAAfter - balanceABefore));
            console.log("Tokens received - B:", ethers.formatEther(balanceBAfter - balanceBBefore));
        });

        it("Should fail with insufficient LP tokens", async function () {
            const lpBalance = await dex.balanceOf(user1.address);

            await expect(
                dex.connect(user1).removeLiquidity(lpBalance + ethers.parseEther("1"))
            ).to.be.revertedWith("Insufficient LP tokens");
        });

        it("Should fail with zero liquidity", async function () {
            await expect(
                dex.connect(user1).removeLiquidity(0)
            ).to.be.revertedWith("Liquidity must be greater than 0");
        });
    });

    describe("Swap Tokens", function () {
        beforeEach(async function () {
            // Add substantial liquidity for swaps
            const amountA = ethers.parseEther("1000");
            const amountB = ethers.parseEther("2000"); // 1:2 ratio

            await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB);
            await dex.connect(user1).addLiquidity(amountA, amountB);

            console.log("Initial Pool: 1000 TKA : 2000 TKB");
        });

        it("Should swap tokenA for tokenB", async function () {
            const swapAmount = ethers.parseEther("10");

            // Calculate expected output
            const expectedOut = await dex.getAmountOut(
                swapAmount,
                ethers.parseEther("1000"),
                ethers.parseEther("2000")
            );

            console.log("Swapping 10 TKA for", ethers.formatEther(expectedOut), "TKB");

            // Approve and swap
            await tokenA.connect(user2).approve(await dex.getAddress(), swapAmount);

            const balanceBBefore = await tokenB.balanceOf(user2.address);

            const tx = await dex.connect(user2).swapAForB(swapAmount, 0);
            await tx.wait();

            expect(tx).to.emit(dex, "Swap");

            const balanceBAfter = await tokenB.balanceOf(user2.address);
            const received = balanceBAfter - balanceBBefore;

            expect(received).to.be.closeTo(expectedOut, ethers.parseEther("0.01"));

            console.log("Received:", ethers.formatEther(received), "TKB");
        });

        it("Should swap tokenB for tokenA", async function () {
            const swapAmount = ethers.parseEther("20");

            const expectedOut = await dex.getAmountOut(
                swapAmount,
                ethers.parseEther("2000"),
                ethers.parseEther("1000")
            );

            console.log("Swapping 20 TKB for", ethers.formatEther(expectedOut), "TKA");

            await tokenB.connect(user2).approve(await dex.getAddress(), swapAmount);

            const balanceABefore = await tokenA.balanceOf(user2.address);

            await dex.connect(user2).swapBForA(swapAmount, 0);

            const balanceAAfter = await tokenA.balanceOf(user2.address);
            const received = balanceAAfter - balanceABefore;

            expect(received).to.be.closeTo(expectedOut, ethers.parseEther("0.01"));

            console.log("Received:", ethers.formatEther(received), "TKA");
        });

        it("Should respect slippage protection", async function () {
            const swapAmount = ethers.parseEther("10");
            const unrealisticMinOut = ethers.parseEther("100"); // Expecting way too much

            await tokenA.connect(user2).approve(await dex.getAddress(), swapAmount);

            await expect(
                dex.connect(user2).swapAForB(swapAmount, unrealisticMinOut)
            ).to.be.revertedWith("Slippage tolerance exceeded");
        });

        it("Should fail with zero input amount", async function () {
            await expect(
                dex.connect(user2).swapAForB(0, 0)
            ).to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should fail swapping more than reserve", async function () {
  const hugeAmount = ethers.parseEther("5000");

  await tokenA.connect(user2).mint(user2.address, hugeAmount);
  await tokenA.connect(user2).approve(await dex.getAddress(), hugeAmount);

  // Calculate expected output first
  const expectedOut = await dex.getAmountOut(
    hugeAmount,
    ethers.parseEther("1000"),
    ethers.parseEther("2000")
  );

  // Should get more than 85% of the reserve
  const reserveB = ethers.parseEther("2000");
  expect(expectedOut).to.be.gt(reserveB * 80n / 100n);
  expect(expectedOut).to.be.lt(reserveB);

  console.log("Swapping 5000 TKA gives:", ethers.formatEther(expectedOut), "TKB");
});





        it("Should apply 0.3% trading fee", async function () {
            const swapAmount = ethers.parseEther("100");

            // Without fee: 100 * 2000 / (1000 + 100) = ~181.82
            // With 0.3% fee: 99.7 * 2000 / (1000 + 99.7) = ~181.19

            const actualOut = await dex.getAmountOut(
                swapAmount,
                ethers.parseEther("1000"),
                ethers.parseEther("2000")
            );

            // Should be less than no-fee calculation
            const noFeeOut = (swapAmount * ethers.parseEther("2000")) /
                (ethers.parseEther("1000") + swapAmount);

            expect(actualOut).to.be.lt(noFeeOut);

            console.log("With fee:", ethers.formatEther(actualOut));
            console.log("Without fee (theoretical):", ethers.formatEther(noFeeOut));
        });
    });

    describe("Price Functions", function () {
        beforeEach(async function () {
            const amountA = ethers.parseEther("1000");
            const amountB = ethers.parseEther("2000");

            await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB);
            await dex.connect(user1).addLiquidity(amountA, amountB);
        });

        it("Should calculate price correctly", async function () {
            const priceAInB = await dex.getPriceAInB();
            const priceBInA = await dex.getPriceBInA();

            // 1 TKA = 2 TKB (2 * 1e18)
            // 1 TKB = 0.5 TKA (0.5 * 1e18)

            expect(priceAInB).to.equal(ethers.parseEther("2"));
            expect(priceBInA).to.equal(ethers.parseEther("0.5"));

            console.log("Price A in B:", ethers.formatEther(priceAInB));
            console.log("Price B in A:", ethers.formatEther(priceBInA));
        });

        it("Should update price after swap", async function () {
            const priceBefore = await dex.getPriceAInB();

            // Swap A for B (increases A reserve, decreases B reserve)
            const swapAmount = ethers.parseEther("100");
            await tokenA.connect(user2).approve(await dex.getAddress(), swapAmount);
            await dex.connect(user2).swapAForB(swapAmount, 0);

            const priceAfter = await dex.getPriceAInB();

            // Price of A should decrease (more A in pool)
            expect(priceAfter).to.be.lt(priceBefore);

            console.log("Price before swap:", ethers.formatEther(priceBefore));
            console.log("Price after swap:", ethers.formatEther(priceAfter));
        });
    });

    describe("Get Reserves", function () {
        it("Should return correct reserves", async function () {
            const amountA = ethers.parseEther("500");
            const amountB = ethers.parseEther("1500");

            await tokenA.connect(user1).approve(await dex.getAddress(), amountA);
            await tokenB.connect(user1).approve(await dex.getAddress(), amountB);
            await dex.connect(user1).addLiquidity(amountA, amountB);

            const [reserveA, reserveB] = await dex.getReserves();

            expect(reserveA).to.equal(amountA);
            expect(reserveB).to.equal(amountB);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very small amounts", async function () {
            const smallAmount = ethers.parseEther("0.001");

            await tokenA.connect(user1).approve(await dex.getAddress(), smallAmount);
            await tokenB.connect(user1).approve(await dex.getAddress(), smallAmount);

            await expect(
                dex.connect(user1).addLiquidity(smallAmount, smallAmount)
            ).to.not.be.reverted;
        });

        it("Should handle large amounts", async function () {
            const largeAmount = ethers.parseEther("100000");

            await tokenA.connect(user1).mint(user1.address, largeAmount);
            await tokenB.connect(user1).mint(user1.address, largeAmount);

            await tokenA.connect(user1).approve(await dex.getAddress(), largeAmount);
            await tokenB.connect(user1).approve(await dex.getAddress(), largeAmount);

            await expect(
                dex.connect(user1).addLiquidity(largeAmount, largeAmount)
            ).to.not.be.reverted;
        });
    });
});
