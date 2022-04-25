// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Bat is ERC20 {
    constructor() public ERC20("Basic Authentication Token", "BAT") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
