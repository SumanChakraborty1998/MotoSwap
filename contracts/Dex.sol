// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Dex {
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
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }

    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;
    uint256 public nextOrderId;

    constructor() public {
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

        traderBalances[msg.sender][ticker] += amount;
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

        traderBalances[msg.sender][ticker] -= amount;
    }

    //Creating 2nd Part - Limit Order
    function createLimitOrder(
        bytes32 ticker,
        uint256 amount,
        uint256 price,
        Side side
    ) external tokenExists(ticker) {
        require(ticker != bytes32("DAI"), "DAI is not supported to Trade");

        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "Insufficient Token"
            );
        } else {
            require(
                traderBalances[msg.sender][bytes32("DAI")] >= amount * price,
                "Insufficient Dai Balances"
            );
        }

        Order[] storage orders = orderBook[ticker][uint256(side)];
        orders.push(
            Order(nextOrderId, side, ticker, amount, 0, price, block.timestamp)
        );

        uint256 i = orders.length - 1;

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
}
