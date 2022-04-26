// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Dex {
    using SafeMath for uint256;

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    mapping(bytes32 => Token) public tokens;

    bytes32[] public tokenList;
    address public admin;

    mapping(address => mapping(bytes32 => uint256)) public traderBalances;

    //Creating Limit Order-- 2nd Part
    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint256 id;
        Side side;
        bytes32 ticker;
        address trader;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }

    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;
    uint256 public nextOrderId;
    uint256 public nextTradeId;
    bytes32 constant DAI = bytes32("DAI");

    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint256 amount,
        uint256 price,
        uint256 date
    );

    //Creating Market Order and Matching

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can add new Tokens");
        _;
    }

    modifier tokenExists(bytes32 _ticker) {
        require(
            tokens[_ticker].tokenAddress != address(0),
            "Token is not supported"
        );
        _;
    }

    modifier tokenIsNotDai(bytes32 _ticker) {
        require(tokens[_ticker].ticker != DAI, "DAI is not supported to Trade");
        _;
    }

    function getOrders(bytes32 ticker, Side side)
        external
        view
        returns (Order[] memory)
    {
        return orderBook[ticker][uint256(side)];
    }

    function getTokens() external view returns (Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }

    function addToken(bytes32 ticker, address tokenAddress) external onlyAdmin {
        Token memory token = Token(ticker, tokenAddress);
        tokens[ticker] = token;
        tokenList.push(ticker);
    }

    function deposit(uint256 amount, bytes32 ticker)
        external
        tokenExists(ticker)
    {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .add(amount);
    }

    function withdraw(uint256 amount, bytes32 ticker)
        external
        tokenExists(ticker)
    {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            "Not enough Balances"
        );

        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);

        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .sub(amount);
    }

    //Creating 2nd Part - Limit Order
    function createLimitOrder(
        bytes32 ticker,
        uint256 amount,
        uint256 price,
        Side side
    ) external tokenExists(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "Insufficient Token"
            );
        } else {
            require(
                traderBalances[msg.sender][DAI] >= amount.mul(price),
                "Insufficient Dai Balances"
            );
        }

        Order[] storage orders = orderBook[ticker][uint256(side)];
        orders.push(
            Order(
                nextOrderId,
                side,
                ticker,
                msg.sender,
                amount,
                0,
                price,
                block.timestamp
            )
        );

        uint256 i = orders.length > 0 ? orders.length - 1 : 0;

        //Bubble Sort
        while (i > 0) {
            if (side == Side.BUY && orders[i].price < orders[i - 1].price) {
                break;
            }

            if (side == Side.SELL && orders[i].price > orders[i - 1].price) {
                break;
            }

            Order memory temp = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = temp;
            i--;
        }
    }

    //Creating Market Order and Matching
    function createMarketOrder(
        bytes32 ticker,
        uint256 amount,
        Side side
    ) external tokenExists(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "Insufficient Token"
            );
        }

        Order[] storage orders = orderBook[ticker][
            uint256(side == Side.BUY ? Side.SELL : Side.BUY)
        ];

        uint256 i = 0;
        uint256 remaining = amount;

        while (i < orders.length && remaining > 0) {
            uint256 available = orders[i].amount.sub(orders[i].filled);
            uint256 matched = remaining > available ? available : remaining;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);

            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                block.timestamp
            );

            if (side == Side.SELL) {
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][
                    ticker
                ].sub(matched);

                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][
                    DAI
                ].add(matched.mul(orders[i].price));

                traderBalances[orders[i].trader][ticker] = traderBalances[
                    orders[i].trader
                ][ticker].add(matched);

                traderBalances[orders[i].trader][DAI] = traderBalances[
                    orders[i].trader
                ][DAI].sub(matched.mul(orders[i].price));
            }

            if (side == Side.BUY) {
                require(
                    traderBalances[msg.sender][DAI] >=
                        matched.mul(orders[i].price),
                    "Insufficient Dai Balances"
                );

                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][
                    ticker
                ].add(matched);

                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][
                    DAI
                ].sub(matched.mul(orders[i].price));

                traderBalances[orders[i].trader][ticker] = traderBalances[
                    orders[i].trader
                ][ticker].sub(matched);

                traderBalances[orders[i].trader][DAI] = traderBalances[
                    orders[i].trader
                ][DAI].add(matched.mul(orders[i].price));
            }
            nextTradeId++;
            i++;
        }

        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint256 j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }

            orders.pop();
            i++;
        }
    }
}
