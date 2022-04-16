// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Dex {
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    mapping(bytes32 => Token) public tokens;

    bytes32[] public tokenList;
    address public admin;

    constructor() public {
        admin = msg.sender;
    }
}
