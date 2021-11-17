/* eslint-disable @typescript-eslint/no-var-requires */
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import type { ReserveToken } from "../../typechain/ReserveToken";
import * as Util from "../Util";
import type { Contract } from "ethers";
import type { ReadWriteTier } from "../../typechain/ReadWriteTier";
import type { RedeemableERC20Pool } from "../../typechain/RedeemableERC20Pool";
import type { RedeemableERC20 } from "../../typechain/RedeemableERC20";
import { factoriesDeploy } from "../Util";

chai.use(solidity);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { expect, assert } = chai;

const poolJson = require("../../artifacts/contracts/pool/RedeemableERC20Pool.sol/RedeemableERC20Pool.json");
const redeemableTokenJson = require("../../artifacts/contracts/redeemableERC20/RedeemableERC20.sol/RedeemableERC20.json");

enum Tier {
  NIL,
  COPPER,
  BRONZE,
  SILVER,
  GOLD,
  PLATINUM,
  DIAMOND,
  CHAD,
  JAWAD,
}

enum RaiseStatus {
  PENDING,
  SEEDED,
  TRADING,
  TRADINGCANEND,
  SUCCESS,
  FAIL,
}

enum Phase {
  ZERO,
  ONE,
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
}

describe("TrustRewards", async function () {
  it("should calculate pro-rata correctly for token holders when using multiple reserve token types", async function () {
    this.timeout(0);

    const signers = await ethers.getSigners();

    const [crpFactory, bFactory] = await Util.balancerDeploy();

    const reserveA = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;
    const reserveB = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;
    const reserveC = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;
    const reserveD = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;

    const tierFactory = await ethers.getContractFactory("ReadWriteTier");
    const tier = (await tierFactory.deploy()) as ReadWriteTier & Contract;
    const minimumStatus = Tier.NIL;

    const { trustFactory } = await factoriesDeploy(crpFactory, bFactory);

    const tokenName = "Token";
    const tokenSymbol = "TKN";

    const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + Util.eighteenZeros);
    const initialValuation = ethers.BigNumber.from("20000" + Util.sixZeros);
    const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator/owner
    const deployer = signers[2]; // deployer is not creator
    const signer1 = signers[3];

    const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederUnits = 0;
    const seederCooldownDuration = 0;

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    const minimumTradingDuration = 50;

    const trustFactoryDeployer = trustFactory.connect(deployer);

    const trust = await Util.trustDeploy(
      trustFactoryDeployer,
      creator,
      {
        creator: creator.address,
        minimumCreatorRaise,
        seeder: seeder.address,
        seederFee,
        seederUnits,
        seederCooldownDuration,
        redeemInit,
      },
      {
        name: tokenName,
        symbol: tokenSymbol,
        tier: tier.address,
        minimumStatus,
        totalSupply: totalTokenSupply,
      },
      {
        reserve: reserveA.address,
        reserveInit,
        initialValuation,
        finalValuation: successLevel,
        minimumTradingDuration,
      },
      { gasLimit: 100000000 }
    );

    await trust.deployed();

    // seeder needs some cash, give enough reserveA to seeder
    await reserveA.transfer(seeder.address, reserveInit);

    const reserveSeeder = reserveA.connect(seeder);

    // seeder must transfer funds to pool
    await reserveSeeder.transfer(await trust.pool(), reserveInit);

    const token = new ethers.Contract(
      await trust.token(),
      redeemableTokenJson.abi,
      creator
    ) as RedeemableERC20 & Contract;
    const pool = new ethers.Contract(
      await trust.pool(),
      poolJson.abi,
      creator
    ) as RedeemableERC20Pool & Contract;

    await pool.startDutchAuction({ gasLimit: 100000000 });

    const startBlock = await ethers.provider.getBlockNumber();

    const [crp, bPool] = await Util.poolContracts(signers, pool);

    // raise some funds
    const swapReserveForTokens = async (signer, spend, reserve) => {
      // give signer some reserve
      await reserve.transfer(signer.address, spend);

      const reserveSigner = reserve.connect(signer);
      const crpSigner = crp.connect(signer);
      const bPoolSigner = bPool.connect(signer);

      await crpSigner.pokeWeights();
      await reserveSigner.approve(bPool.address, spend);
      await bPoolSigner.swapExactAmountIn(
        reserve.address,
        spend,
        token.address,
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + Util.sixZeros)
      );
    };

    const spend = ethers.BigNumber.from("250" + Util.sixZeros);

    // trading/swaps occur with default reserve
    for (let i = 0; i < 11; i++) {
      await swapReserveForTokens(signer1, spend, reserveA);
    }

    while (
      (await ethers.provider.getBlockNumber()) <=
      startBlock + minimumTradingDuration
    ) {
      await reserveA.transfer(signers[9].address, 0);
    }

    const finalBalance = await reserveA.balanceOf(bPool.address);

    await trust.anonEndDistribution();

    // on successful raise
    const poolDustA = await reserveA.balanceOf(bPool.address);
    const seederPay = reserveInit.add(seederFee).sub(poolDustA);
    const creatorPay = finalBalance.sub(seederPay.add(redeemInit));

    // should be successful raise
    assert(
      (await trust.getDistributionStatus()) === RaiseStatus.SUCCESS,
      "raise wasn't successful"
    );

    await reserveB.transfer(token.address, spend.mul(2));
    await reserveC.transfer(token.address, spend.mul(3));
    await reserveD.transfer(token.address, spend.mul(4));

    const expectedRemainder = finalBalance.sub(creatorPay).sub(seederPay);

    const tokenReserveA = await reserveA.balanceOf(token.address);
    const tokenReserveB = await reserveB.balanceOf(token.address);
    const tokenReserveC = await reserveC.balanceOf(token.address);
    const tokenReserveD = await reserveD.balanceOf(token.address);

    assert(
      expectedRemainder.eq(tokenReserveA),
      `wrong reserveA remainder transferred to token
      expected  ${expectedRemainder}
      got       ${tokenReserveA}
    `
    );

    const tokenSupply = await token.totalSupply();

    // signer1 redeems tokens equal to 10% of total supply
    await token
      .connect(signer1)
      .redeem(
        [
          reserveA.address,
          reserveB.address,
          reserveC.address,
          reserveD.address,
        ],
        tokenSupply.div(10)
      );

    // holder1 should get 10% of each reserve
    // (some rounding errors fixed manually)
    const balanceA = await reserveA.balanceOf(signer1.address);
    const expectedBalanceA = tokenReserveA.div(10).sub(1);
    assert(
      balanceA.eq(expectedBalanceA),
      `
      reserveA
        expected  ${expectedBalanceA}
        got       ${balanceA}`
    );
    const balanceB = await reserveB.balanceOf(signer1.address);
    const expectedBalanceB = tokenReserveB.div(10).sub(1);
    assert(
      balanceB.eq(expectedBalanceB),
      `
      reserveB
        expected  ${expectedBalanceB}
        got       ${balanceB}`
    );
    const balanceC = await reserveC.balanceOf(signer1.address);
    const expectedBalanceC = tokenReserveC.div(10).sub(1);
    assert(
      balanceC.eq(expectedBalanceC),
      `
      reserveC
        expected  ${expectedBalanceC}
        got       ${balanceC}`
    );
    const balanceD = await reserveD.balanceOf(signer1.address);
    const expectedBalanceD = tokenReserveD.div(10).sub(1);
    assert(
      balanceD.eq(expectedBalanceD),
      `
      reserveD
        expected  ${expectedBalanceD}
        got       ${balanceD}`
    );

    // for simplicity, burn signer1 reserve tokens
    await reserveA
      .connect(signer1)
      .burn(await reserveA.balanceOf(signer1.address));
    await reserveB
      .connect(signer1)
      .burn(await reserveB.balanceOf(signer1.address));
    await reserveC
      .connect(signer1)
      .burn(await reserveC.balanceOf(signer1.address));
    await reserveD
      .connect(signer1)
      .burn(await reserveD.balanceOf(signer1.address));

    // Now again, 10% of new total supply

    const tokenSupply2 = await token.totalSupply();
    const tokenReserveA2 = await reserveA.balanceOf(token.address);
    const tokenReserveB2 = await reserveB.balanceOf(token.address);
    const tokenReserveC2 = await reserveC.balanceOf(token.address);
    const tokenReserveD2 = await reserveD.balanceOf(token.address);

    // 9/10ths remaining
    const expectedTokenSupply2 = tokenSupply.mul(9).div(10).add(1);
    assert(
      tokenSupply2.eq(expectedTokenSupply2),
      `
    wrong new total token supply
      expected  ${expectedTokenSupply2}
      got       ${tokenSupply2}
    `
    );

    // signer1 redeems tokens equal to 10% of new total supply
    await token
      .connect(signer1)
      .redeem(
        [
          reserveA.address,
          reserveB.address,
          reserveC.address,
          reserveD.address,
        ],
        tokenSupply2.div(10)
      );

    // holder1 should get 10% of each reserve
    // (some rounding errors fixed manually)
    const balanceA2 = await reserveA.balanceOf(signer1.address);
    const expectedBalanceA2 = tokenReserveA2.div(10);
    assert(
      balanceA2.eq(expectedBalanceA2),
      `
      reserveA2
        expected  ${expectedBalanceA2}
        got       ${balanceA2}`
    );
    const balanceB2 = await reserveB.balanceOf(signer1.address);
    const expectedBalanceB2 = tokenReserveB2.div(10);
    assert(
      balanceB2.eq(expectedBalanceB2),
      `
      reserveB2
        expected  ${expectedBalanceB2}
        got       ${balanceB2}`
    );
    const balanceC2 = await reserveC.balanceOf(signer1.address);
    const expectedBalanceC2 = tokenReserveC2.div(10);
    assert(
      balanceC2.eq(expectedBalanceC2),
      `
      reserveC2
        expected  ${expectedBalanceC2}
        got       ${balanceC2}`
    );
    const balanceD2 = await reserveD.balanceOf(signer1.address);
    const expectedBalanceD2 = tokenReserveD2.div(10);
    assert(
      balanceD2.eq(expectedBalanceD2),
      `
      reserveD2
        expected  ${expectedBalanceD2}
        got       ${balanceD2}`
    );
  });

  it("should allow redemption only after token phase change", async function () {
    this.timeout(0);

    const signers = await ethers.getSigners();

    const [crpFactory, bFactory] = await Util.balancerDeploy();

    const reserve = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;

    const tierFactory = await ethers.getContractFactory("ReadWriteTier");
    const tier = (await tierFactory.deploy()) as ReadWriteTier & Contract;
    const minimumStatus = Tier.NIL;

    const { trustFactory } = await factoriesDeploy(crpFactory, bFactory);

    const tokenName = "Token";
    const tokenSymbol = "TKN";

    const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const initialValuation = ethers.BigNumber.from("10000" + Util.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + Util.eighteenZeros);

    const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederUnits = 0;
    const seederCooldownDuration = 0;

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator
    const deployer = signers[2]; // deployer is not creator
    const signer1 = signers[3];

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    const minimumTradingDuration = 50;

    const trustFactoryDeployer = trustFactory.connect(deployer);

    const trust = await Util.trustDeploy(
      trustFactoryDeployer,
      creator,
      {
        creator: creator.address,
        minimumCreatorRaise,
        seeder: seeder.address,
        seederFee,
        seederUnits,
        seederCooldownDuration,
        redeemInit,
      },
      {
        name: tokenName,
        symbol: tokenSymbol,
        tier: tier.address,
        minimumStatus,
        totalSupply: totalTokenSupply,
      },
      {
        reserve: reserve.address,
        reserveInit,
        initialValuation,
        finalValuation: successLevel,
        minimumTradingDuration,
      },
      { gasLimit: 100000000 }
    );

    await trust.deployed();

    // seeder needs some cash, give enough to seeder
    await reserve.transfer(seeder.address, reserveInit);

    const reserveSeeder = new ethers.Contract(
      reserve.address,
      reserve.interface,
      seeder
    ) as ReserveToken & Contract;

    // seeder must transfer seed funds before pool init
    await reserveSeeder.transfer(await trust.pool(), reserveInit);

    const token = new ethers.Contract(
      await trust.token(),
      redeemableTokenJson.abi,
      creator
    ) as RedeemableERC20 & Contract;
    const pool = new ethers.Contract(
      await trust.pool(),
      poolJson.abi,
      creator
    ) as RedeemableERC20Pool & Contract;

    await pool.startDutchAuction({ gasLimit: 100000000 });

    const [crp, bPool] = await Util.poolContracts(signers, pool);

    assert(
      (await token.currentPhase()) === Phase.ZERO,
      "token current phase was not ZERO"
    );

    assert(
      ethers.BigNumber.from("0xffffffff").eq(await token.phaseBlocks(0)), // max uint32
      "token phaseOneBlock should not be set until endRaise"
    );

    const startBlock = await ethers.provider.getBlockNumber();

    const reserveSpend = ethers.BigNumber.from("10" + Util.sixZeros);

    const swapReserveForTokens = async (signer, spend) => {
      // give signer some reserve
      await reserve.transfer(signer.address, spend);

      const reserveSigner = reserve.connect(signer);
      const crpSigner = crp.connect(signer);
      const bPoolSigner = bPool.connect(signer);

      await reserveSigner.approve(bPool.address, spend);
      await crpSigner.pokeWeights();
      await bPoolSigner.swapExactAmountIn(
        reserve.address,
        spend,
        token.address,
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + Util.sixZeros)
      );
    };

    await swapReserveForTokens(signer1, reserveSpend);

    const token1 = token.connect(signer1);

    await Util.assertError(
      async () =>
        await token1.redeem(
          [reserve.address],
          await token1.balanceOf(signer1.address)
        ),
      "revert BAD_PHASE",
      "signer1 redeemed tokens before token phase change"
    );

    // create empty transfer blocks until reaching pool phase change, so raise can end
    while (
      (await ethers.provider.getBlockNumber()) <=
      startBlock + minimumTradingDuration
    ) {
      await reserve.transfer(signers[9].address, 0);
    }

    assert(
      (await token.currentPhase()) === Phase.ZERO,
      "token current phase was still not ZERO"
    );

    assert(
      ethers.BigNumber.from("0xffffffff").eq(await token.phaseBlocks(0)), // max uint32
      "token phaseOneBlock should still not be set until endRaise"
    );

    const signer1TokenBalanceBeforeRed = await token1.balanceOf(
      signer1.address
    );

    await Util.assertError(
      async () =>
        await token1.redeem([reserve.address], signer1TokenBalanceBeforeRed),
      "revert BAD_PHASE",
      `signer1 redeemed tokens before token phase change
      currentBlock        ${await ethers.provider.getBlockNumber()}
      tokenPhaseOneBlock  ${await token.phaseBlocks(0)}`
    );

    const signer1TokenBalanceAfterRed = await token1.balanceOf(signer1.address);

    assert(
      signer1TokenBalanceBeforeRed.eq(signer1TokenBalanceAfterRed),
      "tokens wrongly redeemed before redemption phase"
    );

    const trust1 = trust.connect(signer1);

    // after endRaise is called, token is now next phase
    await trust1.anonEndDistribution();

    assert(
      (await token.phaseBlocks(0)) === (await ethers.provider.getBlockNumber()),
      `token phase ONE block should be set to current block
    currentBlock  ${await ethers.provider.getBlockNumber()}
    tokenPhaseOneBlock ${await token.phaseBlocks(0)}`
    );

    await token1.redeem(
      [reserve.address],
      await token1.balanceOf(signer1.address)
    );
  });

  it("should allow token owner to burn only their own tokens", async function () {
    this.timeout(0);

    const signers = await ethers.getSigners();

    const [crpFactory, bFactory] = await Util.balancerDeploy();

    const reserve = (await Util.basicDeploy(
      "ReserveToken",
      {}
    )) as ReserveToken & Contract;

    const tierFactory = await ethers.getContractFactory("ReadWriteTier");
    const tier = (await tierFactory.deploy()) as ReadWriteTier & Contract;
    const minimumStatus = Tier.NIL;

    const { trustFactory } = await factoriesDeploy(crpFactory, bFactory);

    const tokenName = "Token";
    const tokenSymbol = "TKN";

    const reserveInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const redeemInit = ethers.BigNumber.from("2000" + Util.sixZeros);
    const initialValuation = ethers.BigNumber.from("10000" + Util.sixZeros);
    const totalTokenSupply = ethers.BigNumber.from("2000" + Util.eighteenZeros);

    const minimumCreatorRaise = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederFee = ethers.BigNumber.from("100" + Util.sixZeros);
    const seederUnits = 0;
    const seederCooldownDuration = 0;

    const creator = signers[0];
    const seeder = signers[1]; // seeder is not creator
    const deployer = signers[2]; // deployer is not creator
    const signer1 = signers[3];
    const signer2 = signers[4];

    const successLevel = redeemInit
      .add(minimumCreatorRaise)
      .add(seederFee)
      .add(reserveInit);

    const minimumTradingDuration = 50;

    const trustFactoryDeployer = trustFactory.connect(deployer);

    const trust = await Util.trustDeploy(
      trustFactoryDeployer,
      creator,
      {
        creator: creator.address,
        minimumCreatorRaise,
        seeder: seeder.address,
        seederFee,
        seederUnits,
        seederCooldownDuration,
        redeemInit,
      },
      {
        name: tokenName,
        symbol: tokenSymbol,
        tier: tier.address,
        minimumStatus,
        totalSupply: totalTokenSupply,
      },
      {
        reserve: reserve.address,
        reserveInit,
        initialValuation,
        finalValuation: successLevel,
        minimumTradingDuration,
      },
      { gasLimit: 100000000 }
    );

    await trust.deployed();

    // seeder needs some cash, give enough to seeder
    await reserve.transfer(seeder.address, reserveInit);

    const reserveSeeder = new ethers.Contract(
      reserve.address,
      reserve.interface,
      seeder
    ) as ReserveToken & Contract;

    // seeder must transfer seed funds before pool init
    await reserveSeeder.transfer(await trust.pool(), reserveInit);

    const token = new ethers.Contract(
      await trust.token(),
      redeemableTokenJson.abi,
      creator
    ) as RedeemableERC20 & Contract;
    const pool = new ethers.Contract(
      await trust.pool(),
      poolJson.abi,
      creator
    ) as RedeemableERC20Pool & Contract;

    await pool.startDutchAuction({ gasLimit: 100000000 });

    const [crp, bPool] = await Util.poolContracts(signers, pool);

    const reserveSpend = ethers.BigNumber.from("10" + Util.sixZeros);

    const swapReserveForTokens = async (signer, spend) => {
      // give signer some reserve
      await reserve.transfer(signer.address, spend);

      const reserveSigner = reserve.connect(signer);
      const crpSigner = crp.connect(signer);
      const bPoolSigner = bPool.connect(signer);

      await reserveSigner.approve(bPool.address, spend);
      await crpSigner.pokeWeights();
      await bPoolSigner.swapExactAmountIn(
        reserve.address,
        spend,
        token.address,
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("1000000" + Util.sixZeros)
      );
    };

    await swapReserveForTokens(signer1, reserveSpend);
    await swapReserveForTokens(signer2, reserveSpend);

    const token1 = token.connect(signer1);

    await token1.burn(await token1.balanceOf(signer1.address));

    assert(
      (await token.balanceOf(signer1.address)).isZero(),
      "signer1 failed to burn all of their own tokens"
    );

    await Util.assertError(
      async () =>
        await token1._burn(
          signer2.address,
          await token1.balanceOf(signer2.address)
        ),
      "TypeError: token1._burn is not a function", // internal
      "signer1 burned signer2's tokens"
    );
  });
});
