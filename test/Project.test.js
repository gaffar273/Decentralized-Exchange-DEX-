const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Project Factory", function () {
    let project, dex, owner, creator1, creator2;
    const MIN_SUPPLY = ethers.parseEther("1000");
    const MAX_SUPPLY = ethers.parseEther("1000000000");

    beforeEach(async function () {
        [owner, creator1, creator2] = await ethers.getSigners();

        // Deploy a mock DEX address (we just need an address)
        const MockToken = await ethers.getContractFactory("MockToken");
        const mockDex = await MockToken.deploy("Mock", "MCK", ethers.parseEther("1000"));
        await mockDex.waitForDeployment();

        // Deploy Project Factory
        const Project = await ethers.getContractFactory("Project");
        project = await Project.deploy(await mockDex.getAddress());
        await project.waitForDeployment();

        console.log("✅ Project Factory deployed:", await project.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await project.owner()).to.equal(owner.address);
        });

        it("Should set the DEX contract address", async function () {
            expect(await project.dexContract()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should start with zero projects", async function () {
            expect(await project.projectCount()).to.equal(0);
        });
    });

    describe("Create Project", function () {
        it("Should create a new project with token", async function () {
            const name = "Test Token";
            const symbol = "TEST";
            const supply = ethers.parseEther("100000");

            const tx = await project.connect(creator1).createProject(name, symbol, supply);
            const receipt = await tx.wait();

            expect(tx).to.emit(project, "ProjectCreated");

            // Check project count
            expect(await project.projectCount()).to.equal(1);

            // Get project details
            const projectInfo = await project.getProject(0);

            expect(projectInfo.name).to.equal(name);
            expect(projectInfo.symbol).to.equal(symbol);
            expect(projectInfo.creator).to.equal(creator1.address);
            expect(projectInfo.totalSupply).to.equal(supply);
            expect(projectInfo.isActive).to.equal(true);

            console.log("Project created:");
            console.log("  Name:", projectInfo.name);
            console.log("  Symbol:", projectInfo.symbol);
            console.log("  Token:", projectInfo.tokenAddress);
        });

        it("Should mint tokens to creator", async function () {
            const supply = ethers.parseEther("100000");

            await project.connect(creator1).createProject("Token", "TKN", supply);

            const projectInfo = await project.getProject(0);

            // Get token contract
            const token = await ethers.getContractAt("ProjectToken", projectInfo.tokenAddress);

            const balance = await token.balanceOf(creator1.address);
            expect(balance).to.equal(supply);

            console.log("Creator balance:", ethers.formatEther(balance), "TKN");
        });

        it("Should fail with empty name", async function () {
            await expect(
                project.connect(creator1).createProject("", "TKN", ethers.parseEther("10000"))
            ).to.be.revertedWith("Name cannot be empty");
        });

        it("Should fail with empty symbol", async function () {
            await expect(
                project.connect(creator1).createProject("Token", "", ethers.parseEther("10000"))
            ).to.be.revertedWith("Symbol cannot be empty");
        });

        it("Should fail with supply too low", async function () {
            await expect(
                project.connect(creator1).createProject("Token", "TKN", ethers.parseEther("100"))
            ).to.be.revertedWith("Supply too low");
        });

        it("Should fail with supply too high", async function () {
            const tooMuch = ethers.parseEther("2000000000"); // 2 billion

            await expect(
                project.connect(creator1).createProject("Token", "TKN", tooMuch)
            ).to.be.revertedWith("Supply too high");
        });

        it("Should allow multiple projects from same creator", async function () {
            await project.connect(creator1).createProject("Token1", "TK1", ethers.parseEther("10000"));
            await project.connect(creator1).createProject("Token2", "TK2", ethers.parseEther("20000"));

            expect(await project.projectCount()).to.equal(2);

            const creatorProjects = await project.getCreatorProjects(creator1.address);
            expect(creatorProjects.length).to.equal(2);
        });
    });

    describe("Get Project Info", function () {
        beforeEach(async function () {
            await project.connect(creator1).createProject("Token1", "TK1", ethers.parseEther("10000"));
            await project.connect(creator2).createProject("Token2", "TK2", ethers.parseEther("20000"));
        });

        it("Should get project by ID", async function () {
            const proj0 = await project.getProject(0);
            const proj1 = await project.getProject(1);

            expect(proj0.name).to.equal("Token1");
            expect(proj0.creator).to.equal(creator1.address);

            expect(proj1.name).to.equal("Token2");
            expect(proj1.creator).to.equal(creator2.address);
        });

        it("Should fail getting non-existent project", async function () {
            await expect(
                project.getProject(999)
            ).to.be.revertedWith("Project does not exist");
        });

        it("Should get projects by creator", async function () {
            await project.connect(creator1).createProject("Token3", "TK3", ethers.parseEther("30000"));

            const creator1Projects = await project.getCreatorProjects(creator1.address);
            const creator2Projects = await project.getCreatorProjects(creator2.address);

            expect(creator1Projects.length).to.equal(2);
            expect(creator2Projects.length).to.equal(1);

            console.log("Creator1 projects:", creator1Projects.toString());
            console.log("Creator2 projects:", creator2Projects.toString());
        });

        it("Should get project by token address", async function () {
            const proj0 = await project.getProject(0);

            const projectId = await project.getProjectByToken(proj0.tokenAddress);
            expect(projectId).to.equal(0);
        });
    });

    describe("Deactivate/Reactivate Project", function () {
        beforeEach(async function () {
            await project.connect(creator1).createProject("Token", "TKN", ethers.parseEther("10000"));
        });

        it("Should allow creator to deactivate project", async function () {
            const tx = await project.connect(creator1).deactivateProject(0);
            expect(tx).to.emit(project, "ProjectDeactivated");

            const projectInfo = await project.getProject(0);
            expect(projectInfo.isActive).to.equal(false);
        });

        it("Should allow owner to deactivate project", async function () {
            await project.connect(owner).deactivateProject(0);

            const projectInfo = await project.getProject(0);
            expect(projectInfo.isActive).to.equal(false);
        });

        it("Should fail if unauthorized user tries to deactivate", async function () {
            await expect(
                project.connect(creator2).deactivateProject(0)
            ).to.be.revertedWith("Not authorized");
        });

        it("Should allow reactivation", async function () {
            await project.connect(creator1).deactivateProject(0);

            const tx = await project.connect(creator1).reactivateProject(0);
            expect(tx).to.emit(project, "ProjectReactivated");

            const projectInfo = await project.getProject(0);
            expect(projectInfo.isActive).to.equal(true);
        });

        it("Should fail reactivating already active project", async function () {
            await expect(
                project.connect(creator1).reactivateProject(0)
            ).to.be.revertedWith("Project already active");
        });
    });

    describe("Get Active Projects", function () {
        beforeEach(async function () {
            await project.connect(creator1).createProject("Token1", "TK1", ethers.parseEther("10000"));
            await project.connect(creator1).createProject("Token2", "TK2", ethers.parseEther("20000"));
            await project.connect(creator2).createProject("Token3", "TK3", ethers.parseEther("30000"));
        });

        it("Should return all active projects", async function () {
            const activeProjects = await project.getActiveProjects();
            expect(activeProjects.length).to.equal(3);
        });

        it("Should exclude deactivated projects", async function () {
            await project.connect(creator1).deactivateProject(1);

            const activeProjects = await project.getActiveProjects();
            expect(activeProjects.length).to.equal(2);

            // Check that project 1 is not in the list
            expect(activeProjects).to.not.include(1n);
        });

        it("Should include reactivated projects", async function () {
            await project.connect(creator1).deactivateProject(0);

            let activeProjects = await project.getActiveProjects();
            expect(activeProjects.length).to.equal(2);

            await project.connect(creator1).reactivateProject(0);

            activeProjects = await project.getActiveProjects();
            expect(activeProjects.length).to.equal(3);
        });
    });

    describe("Token Registration Check", function () {
        it("Should check if token is registered", async function () {
            await project.connect(creator1).createProject("Token", "TKN", ethers.parseEther("10000"));

            const projectInfo = await project.getProject(0);

            const isRegistered = await project.isTokenRegistered(projectInfo.tokenAddress);
            expect(isRegistered).to.equal(true);
        });

        it("Should return false for unregistered token", async function () {
            const randomAddress = ethers.Wallet.createRandom().address;

            const isRegistered = await project.isTokenRegistered(randomAddress);
            expect(isRegistered).to.equal(false);
        });

        it("Should return false for deactivated project token", async function () {
            await project.connect(creator1).createProject("Token", "TKN", ethers.parseEther("10000"));

            const projectInfo = await project.getProject(0);
            await project.connect(creator1).deactivateProject(0);

            const isRegistered = await project.isTokenRegistered(projectInfo.tokenAddress);
            expect(isRegistered).to.equal(false);
        });
    });

    describe("Update DEX Contract", function () {
        it("Should allow owner to update DEX contract", async function () {
            const newAddress = ethers.Wallet.createRandom().address;

            const tx = await project.connect(owner).updateDEXContract(newAddress);
            expect(tx).to.emit(project, "DEXContractUpdated");

            expect(await project.dexContract()).to.equal(newAddress);
        });

        it("Should fail if non-owner tries to update", async function () {
            const newAddress = ethers.Wallet.createRandom().address;

            await expect(
                project.connect(creator1).updateDEXContract(newAddress)
            ).to.be.reverted;
        });

        it("Should fail with zero address", async function () {
            await expect(
                project.connect(owner).updateDEXContract(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid address");
        });
    });

    describe("ProjectToken", function () {
        let tokenAddress, token;

        beforeEach(async function () {
            await project.connect(creator1).createProject("Test Token", "TST", ethers.parseEther("50000"));

            const projectInfo = await project.getProject(0);
            tokenAddress = projectInfo.tokenAddress;
            token = await ethers.getContractAt("ProjectToken", tokenAddress);
        });

        it("Should have correct token info", async function () {
            const info = await token.getTokenInfo();

            expect(info.tokenName).to.equal("Test Token");
            expect(info.tokenSymbol).to.equal("TST");
            expect(info.tokenTotalSupply).to.equal(ethers.parseEther("50000"));
            expect(info.tokenCreator).to.equal(creator1.address);
        });


        it("Should allow token transfers", async function () {
            const transferAmount = ethers.parseEther("1000");

            await token.connect(creator1).transfer(creator2.address, transferAmount);

            const balance = await token.balanceOf(creator2.address);
            expect(balance).to.equal(transferAmount);
        });

        it("Should have standard ERC20 functions", async function () {
            expect(await token.name()).to.equal("Test Token");
            expect(await token.symbol()).to.equal("TST");
            expect(await token.decimals()).to.equal(18);
        });
    });
});
