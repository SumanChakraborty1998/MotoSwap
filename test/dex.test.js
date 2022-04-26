const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Shib = artifacts.require("mocks/Shib.sol");
const Xrp = artifacts.require("mocks/Xrp.sol");
const Dex = artifacts.require("Dex.sol");
// const { expectRevert } = require("@openzeppelin/test-helpers");

contract("Dex", (accounts) => {
  let dai, bat, xrp, shib, dex;

  const [trader1, trader2] = [accounts[0], accounts[1]];

  const [DAI, BAT, XRP, SHIB] = ["DAI", "BAT", "XRP", "SHIB"].map((ticker) =>
    web3.utils.fromAscii(ticker),
  );

  beforeEach(async () => {
    [dai, bat, shib, xrp] = await Promise.all([
      Dai.new(),
      Bat.new(),
      Shib.new(),
      Xrp.new(),
    ]);

    dex = await Dex.new();

    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(BAT, bat.address),
      dex.addToken(SHIB, shib.address),
      dex.addToken(XRP, xrp.address),
    ]);

    const amount = web3.utils.toWei("1000");

    const fundInitialToken = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(dex.address, amount, { from: trader });
    };

    await Promise.all(
      [dai, bat, xrp, shib].map((token) => fundInitialToken(token, trader1)),
    );

    await Promise.all(
      [dai, bat, xrp, shib].map((token) => fundInitialToken(token, trader2)),
    );
  });

  //Testing Deposit Function
  it("Should deposit tokens", async () => {
    const amount = web3.utils.toWei("100");
    await dex.deposit(amount, DAI, { from: trader1 });
    const balance = await dex.traderBalances(trader1, DAI);
    assert(balance.toString() === amount);
  });

  it("Should not deposit token, if token does not exist", async () => {
    const amount = web3.utils.toWei("100");
    const RANDOM_TOKEN = web3.utils.fromAscii("RANDOM");

    try {
      await dex.deposit(amount, RANDOM_TOKEN, { from: trader1 });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Token is not supported");
    }
  });

  //Testing Withdraw Function
  it("Should withdraw tokens", async () => {
    const amount = web3.utils.toWei("100");
    await dex.deposit(amount, DAI, { from: trader1 });
    await dex.withdraw(amount, DAI, { from: trader1 });

    const [balanceDex, balanceDai] = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dai.balanceOf(trader1),
    ]);

    assert(balanceDex.toString() === web3.utils.toWei("0"));
    assert(balanceDai.toString() === web3.utils.toWei("1000"));
  });

  it("Should not withdraw tokens, if token is not exist", async () => {
    const amount = web3.utils.toWei("100");
    const RANDOM_TOKEN = web3.utils.fromAscii("RANDOM");

    try {
      await dex.withdraw(amount, RANDOM_TOKEN, { from: trader1 });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Token is not supported");
    }
  });

  it("Should prevent to withdraw more token, when exceeds the amount of stocks", async () => {
    const amount = web3.utils.toWei("100");
    await dex.deposit(amount, DAI, { from: trader1 });

    try {
      await dex.withdraw(web3.utils.toWei("1000000"), DAI, { from: trader1 });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Not enough Balances");
    }
  });
});
