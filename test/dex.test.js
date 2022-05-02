const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Shib = artifacts.require("mocks/Shib.sol");
const Xrp = artifacts.require("mocks/Xrp.sol");
const Dex = artifacts.require("Dex.sol");
// const { expectRevert } = require("@openzeppelin/test-helpers");

const SIDE = {
  BUY: 0,
  SELL: 1,
};

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

  //Create Limit Order
  it("Should Create Limit Order", async () => {
    await dex.deposit(web3.utils.toWei("100"), DAI, { from: trader1 });

    await dex.createLimitOrder(BAT, web3.utils.toWei("10"), 10, SIDE.BUY, {
      from: trader1,
    });

    let buyOrders;
    let sellOrders;
    buyOrders = await dex.getOrders(BAT, SIDE.BUY);
    sellOrders = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrders.length === 1);
    assert(buyOrders[0].trader === trader1);
    assert(buyOrders[0].ticker === web3.utils.padRight(BAT, 64));
    assert(buyOrders[0].price === "10");
    assert(buyOrders[0].amount === web3.utils.toWei("10"));
    assert(sellOrders.length === 0);

    await dex.deposit(web3.utils.toWei("200"), DAI, { from: trader2 });

    await dex.createLimitOrder(BAT, web3.utils.toWei("10"), 11, SIDE.BUY, {
      from: trader2,
    });

    buyOrders = await dex.getOrders(BAT, SIDE.BUY);
    sellOrders = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrders.length === 2);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(buyOrders[0].price === "11");

    await dex.deposit(web3.utils.toWei("200"), DAI, { from: trader2 });

    await dex.createLimitOrder(BAT, web3.utils.toWei("10"), 9, SIDE.BUY, {
      from: trader2,
    });

    buyOrders = await dex.getOrders(BAT, SIDE.BUY);
    sellOrders = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrders.length === 3);
    assert(buyOrders[0].trader === trader2);
    assert(buyOrders[1].trader === trader1);
    assert(buyOrders[2].trader === trader2);
    assert(buyOrders[2].price === "9");
  });

  it("Should not create limit order, if DAI balance is too low", async () => {
    await dex.deposit(web3.utils.toWei("190"), DAI, { from: trader2 });
    try {
      await dex.createLimitOrder(BAT, web3.utils.toWei("20"), 10, SIDE.BUY, {
        from: trader2,
      });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Insufficient Dai Balances");
    }
  });

  it("Should not create limit order, if tokens balance is too low", async () => {
    await dex.deposit(web3.utils.toWei("90"), BAT, { from: trader2 });
    try {
      await dex.createLimitOrder(BAT, web3.utils.toWei("100"), 10, SIDE.SELL, {
        from: trader2,
      });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Insufficient Token");
    }
  });

  it("Should not create limit order, if token is DAI", async () => {
    try {
      await dex.createLimitOrder(DAI, web3.utils.toWei("100"), 10, SIDE.BUY, {
        from: trader2,
      });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "DAI is not supported to Trade");
    }
  });

  it("Should not create limit order, if token does not exist", async () => {
    try {
      await dex.createLimitOrder(
        web3.utils.fromAscii("RANDOM"),
        web3.utils.toWei("100"),
        10,
        SIDE.BUY,
        {
          from: trader2,
        },
      );
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Token is not supported");
    }
  });

  //Create Market Order
  it("Should Create Market Order & match", async () => {
    await dex.deposit(web3.utils.toWei("100"), DAI, { from: trader1 });

    await dex.createLimitOrder(BAT, web3.utils.toWei("10"), 10, SIDE.BUY, {
      from: trader1,
    });

    await dex.deposit(web3.utils.toWei("100"), BAT, { from: trader2 });

    await dex.createMarketOrder(BAT, web3.utils.toWei("5"), SIDE.SELL, {
      from: trader2,
    });

    const balances = await Promise.all([
      dex.traderBalances(trader1, DAI),
      dex.traderBalances(trader1, BAT),
      dex.traderBalances(trader2, DAI),
      dex.traderBalances(trader2, BAT),
    ]);

    const orders = await dex.getOrders(BAT, SIDE.BUY);

    assert(orders.length === 1);
    assert(orders[0].filled === web3.utils.toWei("5"));
    assert(balances[0].toString() === web3.utils.toWei("50"));
    assert(balances[1].toString() === web3.utils.toWei("5"));
    assert(balances[2].toString() === web3.utils.toWei("50"));
    assert(balances[3].toString() === web3.utils.toWei("95"));
  });

  it("Should not create Market order, if token does not exist", async () => {
    try {
      await dex.createMarketOrder(
        web3.utils.fromAscii("RANDOM"),
        web3.utils.toWei("100"),
        SIDE.BUY,
        {
          from: trader1,
        },
      );
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Token is not supported");
    }
  });

  it("Should not create Market order, if token is DAI", async () => {
    try {
      await dex.createMarketOrder(DAI, web3.utils.toWei("100"), SIDE.BUY, {
        from: trader2,
      });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "DAI is not supported to Trade");
    }
  });

  it("Should not create Market order, if tokens balance is too low", async () => {
    await dex.deposit(web3.utils.toWei("90"), BAT, { from: trader2 });
    try {
      await dex.createMarketOrder(BAT, web3.utils.toWei("100"), SIDE.SELL, {
        from: trader2,
      });
    } catch (e) {
      // console.log(e);
      assert(e.reason === "Insufficient Token");
    }
  });
});
