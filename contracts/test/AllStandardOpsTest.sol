// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import {RainVM, State, RAIN_VM_OPS_LENGTH} from "../vm/RainVM.sol";
import {LogicOps} from "../vm/ops/math/LogicOps.sol";
import "../vm/ops/AllStandardOps.sol";
import "../vm/VMMeta.sol";

import "hardhat/console.sol";

uint256 constant SOURCE_INDEX = 0;

/// @title StandardOpsTest
/// Simple contract that exposes all standard ops for testing.
contract AllStandardOpsTest is RainVM {
    // using LibDispatchTable for DispatchTable;

    address private vmStatePointer;

    State private _state;

    constructor(bytes memory fnPtrs_) RainVM(fnPtrs_) {}

    function initialize(bytes calldata stateBytes_) external {
        vmStatePointer = SSTORE2.write(stateBytes_);
    }

    /// Wraps `runState` and returns top of stack.
    /// @return top of `runState` stack.
    function stackTop() external view returns (uint256) {
        return _state.stack[_state.stackIndex - 1];
    }

    function stack() external view returns (uint256[] memory) {
        return _state.stack;
    }

    function state() external view returns (State memory) {
        return _state;
    }

    function fnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.fnPtrs();
    }

    /// Runs `eval` and stores full state.
    function run() public {
        uint a_ = gasleft();
        bytes memory stateBytes_ = SSTORE2.read(vmStatePointer);
        uint b_ = gasleft();
        uint c_ = gasleft();
        State memory state_ = LibState.fromBytesPacked(
            stateBytes_
        );
        uint d_ = gasleft();
        uint e_ = gasleft();
        eval("", state_, SOURCE_INDEX);
        uint f_ = gasleft();
        console.log("load gas:", a_ - b_);
        console.log("decode gas:", c_ - d_);
        console.log("run gas:", e_ - f_);
        // Never actually do this, state is gigantic so can't live in storage.
        _state = state_;
    }
}
