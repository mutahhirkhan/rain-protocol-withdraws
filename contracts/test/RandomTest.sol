// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "../math/Random.sol";

import "hardhat/console.sol";

contract RandomTest {
    function microLottery(
        uint256 seed_,
        uint256 max_,
        uint256 n_
    ) public pure returns (uint256 item_) {
        // uint256 a_ = gasleft();
        item_ = Random.microLottery(seed_, max_, n_);
        // uint256 b_ = gasleft();
        // console.log("microLottery gas used: %s", a_ - b_);
    }
}
