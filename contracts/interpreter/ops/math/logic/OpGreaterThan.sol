// SPDX-License-Identifier: CAL
pragma solidity ^0.8.15;
import "../../../run/LibStackPointer.sol";
import "../../../../type/LibCast.sol";
import "../../../run/LibInterpreterState.sol";
import "../../../deploy/LibIntegrityCheck.sol";

/// @title OpGreaterThan
/// @notice Opcode to compare the top two stack values.
library OpGreaterThan {
    using LibCast for bool;
    using LibStackPointer for StackPointer;
    using LibIntegrityCheck for IntegrityCheckState;

    function _greaterThan(
        uint256 a_,
        uint256 b_
    ) internal pure returns (uint256) {
        return (a_ > b_).asUint256();
    }

    function integrity(
        IntegrityCheckState memory integrityCheckState_,
        Operand,
        StackPointer stackTop_
    ) internal pure returns (StackPointer) {
        return integrityCheckState_.applyFn(stackTop_, _greaterThan);
    }

    function greaterThan(
        InterpreterState memory,
        Operand,
        StackPointer stackTop_
    ) internal view returns (StackPointer) {
        return stackTop_.applyFn(_greaterThan);
    }
}
