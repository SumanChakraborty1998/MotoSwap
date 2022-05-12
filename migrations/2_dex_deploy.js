const Dex = artifacts.require("Dex");
const Dai = artifacts.require("./mocks/Dai");
const Bat = artifacts.require("./mocks/Bat");
const Shib = artifacts.require("./mocks/Shib");
const Xrp = artifacts.require("./mocks/Xrp");

const { ethers } = require("ethers");

module.exports = async function (deployer, network, accounts) {
  const [DAI, BAT, SHIB, XRP] = ["DAI", "BAT", "SHIB", "XRP"].map((ticker) =>
    ethers.utils.formatBytes32String(ticker),
  );

  const SIDE = {
    BUY: 0,
    SELL: 1,
  };

  const [trader1, trader2, trader3, trader4] = [
    accounts[0],
    accounts[1],
    accounts[2],
    accounts[3],
  ];

  await deployer.deploy(Dex, { from: accounts[0] });
  await deployer.deploy(Dai, { from: accounts[0] });
  await deployer.deploy(Bat, { from: accounts[0] });
  await deployer.deploy(Shib, { from: accounts[0] });
  await deployer.deploy(Xrp, { from: accounts[0] });

  const dex = await Dex.deployed();
  const dai = await Dai.deployed();
  const bat = await Bat.deployed();
  const shib = await Shib.deployed();
  const xrp = await Xrp.deployed();

  console.log("Dex:", dex.address);
  console.log("Dai:", dai.address);
  console.log("Bat:", bat.address);
  console.log("Shib:", shib.address);
  console.log("Xrp:", xrp.address);
  console.log("trader1", trader1);
  console.log("trader2", trader2);
  // console.log("DAIIIII:", dai);
  // console.log("DEX:", dex);

  await Promise.all([
    dex.addToken(DAI, dai.address),
    dex.addToken(BAT, bat.address),
    dex.addToken(SHIB, shib.address),
    dex.addToken(XRP, xrp.address),
  ]);

  const amount = ethers.utils.parseEther("100");

  const seedTokenBalance = async (token, trader) => {
    console.log("Called");
    await token.faucet(trader, amount);
    await token
      // .connect(trader)
      .approve(dex.address, amount);
    const ticker = await token.name();
    await dex
      // .connect(trader)
      .deposit(amount, ethers.utils.formatBytes32String(ticker));
  };

  // console.log(await dex.getTokens());

  await Promise.all(
    [dai, bat, shib, xrp].map((token) => seedTokenBalance(token, trader1)),
  );
  // await Promise.all(
  //   [dai, bat, shib, xrp].map((token) => seedTokenBalance(token, trader2)),
  // );
  // await Promise.all(
  //   [dai, bat, xrp, shib].map((token) => seedTokenBalance(token, trader3)),
  // );
  // await Promise.all(
  //   [dai, bat, xrp, shib].map((token) => seedTokenBalance(token, trader4)),
  // );
};
