const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Minilend Contract - Kenyan Farmer Journey with cKES", function () {
  let Minilend, minilend, usdc, cKES, cEUR, cREAL, aavePool, oracles;
  let farmer, owner;
  const POOL_ADDRESS_PROVIDER = "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5";
  const MOCK_SORTED_ORACLES = "0xc81a713E5FF5Bd0Bb176646e22dCB282A63917cA";
  const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
  const CKES_ADDRESS = "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
  const CEUR_ADDRESS = "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73";
  const CREAL_ADDRESS = "0xE8537a3d056DA446677B9E9d6c5dB704EaAb4787";
  const LOCK_30_DAYS = 30 * 24 * 60 * 60;
  const CKES_AMOUNT = ethers.utils.parseEther("10.5"); // 10,000 test units ($10, 1 cKES = $0.0077)
  const USDC_AMOUNT = ethers.utils.parseUnits("1", 6); // 5,000 test units ($5, 6 decimals)
  const CREAL_AMOUNT = ethers.utils.parseEther("1"); // 25,000 test units ($5, 1 cREAL = $0.2)

  beforeEach(async function () {
    [owner, farmer] = await ethers.getSigners();

    // Deploy mock tokens for local testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USDC", "USDC", 6);
    cKES = await MockERC20.deploy("cKES", "cKES", 18);
    cEUR = await MockERC20.deploy("cEUR", "cEUR", 18);
    cREAL = await MockERC20.deploy("cREAL", "cREAL", 18);

    // Fund farmer
    await cKES.mint(farmer.address, CKES_AMOUNT);
    await usdc.mint(farmer.address, USDC_AMOUNT);
    await cREAL.mint(farmer.address, CREAL_AMOUNT);

    // Deploy Minilend
    Minilend = await ethers.getContractFactory("Minilend");
    minilend = await Minilend.deploy(
      POOL_ADDRESS_PROVIDER,
      MOCK_SORTED_ORACLES,
      USDC_ADDRESS,
      [CKES_ADDRESS, CEUR_ADDRESS, CREAL_ADDRESS],
      [USDC_ADDRESS, CKES_ADDRESS, CEUR_ADDRESS]
    );
    await minilend.deployed();

    // Deploy mock oracle
    const MockSortedOracles = await ethers.getContractFactory("MockSortedOracles");
    oracles = await MockSortedOracles.deploy();
    await oracles.setMedianRate(CKES_ADDRESS, ethers.utils.parseEther("0.0077")); // 1 cKES = $0.0077
    await oracles.setMedianRate(CEUR_ADDRESS, ethers.utils.parseEther("1.2")); // 1 cEUR = $1.2
    await oracles.setMedianRate(CREAL_ADDRESS, ethers.utils.parseEther("0.2")); // 1 cREAL = $0.2
  });

  describe("Farmer Journey on Celo Mainnet with cKES", function () {
    it("should allow farmer to supply cKES with 30-day lock", async function () {
      await cKES.connect(farmer).approve(minilend.address, CKES_AMOUNT);
      const tx = await minilend.connect(farmer).supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);

      const depositBalance = await minilend.userDeposits(farmer.address, CKES_ADDRESS);
      expect(depositBalance).to.equal(CKES_AMOUNT); // 10,000 test units ($10 ≈ 1,296.5 cKES)

      const lockEnd = await minilend.depositLockEnd(farmer.address, CKES_ADDRESS);
      expect(lockEnd).to.be.closeTo(
        (await ethers.provider.getBlock("latest")).timestamp + LOCK_30_DAYS,
        100
      );

      await expect(tx)
        .to.emit(minilend, "Supplied")
        .withArgs(farmer.address, CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);
    });

    it("should prevent farmer from borrowing without USDC collateral", async function () {
      await cKES.connect(farmer).approve(minilend.address, CKES_AMOUNT);
      await minilend.connect(farmer).supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);

      await expect(minilend.connect(farmer).borrow(CREAL_ADDRESS, CREAL_AMOUNT))
        .to.be.revertedWith("No USDC collateral deposited");
    });

    it("should allow farmer to deposit USDC collateral and borrow cREAL", async function () {
      await usdc.connect(farmer).approve(minilend.address, USDC_AMOUNT);
      const depositTx = await minilend.connect(farmer).depositCollateral(USDC_AMOUNT);

      const collateralBalance = await minilend.userCollateral(farmer.address);
      expect(collateralBalance).to.equal(USDC_AMOUNT); // 5,000 test units ($5)

      await expect(depositTx)
        .to.emit(minilend, "CollateralDeposited")
        .withArgs(farmer.address, USDC_ADDRESS, USDC_AMOUNT);

      const borrowTx = await minilend.connect(farmer).borrow(CREAL_ADDRESS, CREAL_AMOUNT);

      const borrowBalance = await minilend.userBorrows(farmer.address, CREAL_ADDRESS);
      expect(borrowBalance).to.equal(CREAL_AMOUNT); // 25,000 test units ($5)

      await expect(borrowTx)
        .to.emit(minilend, "Borrowed")
        .withArgs(farmer.address, CREAL_ADDRESS, CREAL_AMOUNT, USDC_AMOUNT);
    });

    it("should allow farmer to repay cREAL loan", async function () {
      await usdc.connect(farmer).approve(minilend.address, USDC_AMOUNT);
      await minilend.connect(farmer).depositCollateral(USDC_AMOUNT);
      await minilend.connect(farmer).borrow(CREAL_ADDRESS, CREAL_AMOUNT);

      await cREAL.connect(farmer).approve(minilend.address, CREAL_AMOUNT);
      const repayTx = await minilend.connect(farmer).repay(CREAL_ADDRESS, CREAL_AMOUNT);

      const borrowBalance = await minilend.userBorrows(farmer.address, CREAL_ADDRESS);
      expect(borrowBalance).to.equal(0);

      await expect(repayTx)
        .to.emit(minilend, "Repaid")
        .withArgs(farmer.address, CREAL_ADDRESS, CREAL_AMOUNT, 0);
    });

    it("should prevent farmer from withdrawing cKES before lock-up ends", async function () {
      await cKES.connect(farmer).approve(minilend.address, CKES_AMOUNT);
      await minilend.connect(farmer).supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);

      await expect(minilend.connect(farmer).withdraw(CKES_ADDRESS, CKES_AMOUNT))
        .to.be.revertedWith("Deposit still locked");
    });

    it("should prevent farmer from withdrawing USDC collateral with outstanding cREAL loan", async function () {
      await usdc.connect(farmer).approve(minilend.address, USDC_AMOUNT);
      await minilend.connect(farmer).depositCollateral(USDC_AMOUNT);
      await minilend.connect(farmer).borrow(CREAL_ADDRESS, CREAL_AMOUNT);

      await expect(minilend.connect(farmer).withdraw(USDC_ADDRESS, USDC_AMOUNT))
        .to.be.revertedWith("Repay loans before withdrawing");
    });

    it("should allow farmer to withdraw USDC collateral after repaying cREAL loan", async function () {
      await usdc.connect(farmer).approve(minilend.address, USDC_AMOUNT);
      await minilend.connect(farmer).depositCollateral(USDC_AMOUNT);
      await minilend.connect(farmer).borrow(CREAL_ADDRESS, CREAL_AMOUNT);

      await cREAL.connect(farmer).approve(minilend.address, CREAL_AMOUNT);
      await minilend.connect(farmer).repay(CREAL_ADDRESS, CREAL_AMOUNT);

      const withdrawTx = await minilend.connect(farmer).withdraw(USDC_ADDRESS, USDC_AMOUNT);

      const collateralBalance = await minilend.userCollateral(farmer.address);
      expect(collateralBalance).to.equal(0);

      await expect(withdrawTx)
        .to.emit(minilend, "CollateralWithdrawn")
        .withArgs(farmer.address, USDC_ADDRESS, USDC_AMOUNT);
    });

    it("should allow farmer to withdraw cKES after lock-up and repaying any loans", async function () {
      await cKES.connect(farmer).approve(minilend.address, CKES_AMOUNT);
      await minilend.connect(farmer).supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);

      await ethers.provider.send("evm_increaseTime", [LOCK_30_DAYS + 100]);
      await ethers.provider.send("evm_mine");

      const withdrawTx = await minilend.connect(farmer).withdraw(CKES_ADDRESS, CKES_AMOUNT);

      const depositBalance = await minilend.userDeposits(farmer.address, CKES_ADDRESS);
      expect(depositBalance).to.equal(0);

      await expect(withdrawTx)
        .to.emit(minilend, "Withdrawn")
        .withArgs(farmer.address, CKES_ADDRESS, CKES_AMOUNT);
    });

    it("should emit BalanceUpdated event when checking cKES balance", async function () {
      await cKES.connect(farmer).approve(minilend.address, CKES_AMOUNT);
      await minilend.connect(farmer).supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_30_DAYS);

      const tx = await minilend.connect(farmer).getUserBalance(farmer.address, CKES_ADDRESS);
      await expect(tx)
        .to.emit(minilend, "BalanceUpdated")
        .withArgs(farmer.address, CKES_ADDRESS, CKES_AMOUNT, 0);
    });
  });
});