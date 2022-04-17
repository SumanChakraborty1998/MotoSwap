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
}
