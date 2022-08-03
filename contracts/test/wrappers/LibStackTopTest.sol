// SPDX-License-Identifier: CAL
pragma solidity ^0.8.15;

import "../../vm/runtime/LibStackTop.sol";

/// @title LibStackTopTest
/// Test wrapper around `LibStackTop` library.
/// This contract DOES NOT simply expose library functions.
/// Liberties have been made to make these functions testable, such as
/// converting inputs to StackTop type, or adding `up(n_)` shift functionality
/// to functions so we can test in cases where a function is called when stack
/// top is not at the bottom of the stack.
contract LibStackTopTest {
    using LibStackTop for bytes;
    using LibStackTop for uint256[];
    using LibStackTop for StackTop;

    function peekUp(bytes memory bytes_) external pure returns (uint256) {
        return bytes_.asStackTop().peekUp();
    }

    function peekUp(bytes memory bytes_, uint256 n_)
        external
        pure
        returns (uint256)
    {
        return bytes_.asStackTop().up(n_).peekUp();
    }

    function peekUp(uint256[] memory array_) external pure returns (uint256) {
        return array_.asStackTop().peekUp();
    }

    function peekUp(uint256[] memory array_, uint256 n_)
        external
        pure
        returns (uint256)
    {
        return array_.asStackTop().up(n_).peekUp();
    }

    function peek(bytes memory bytes_) external pure returns (uint256) {
        return bytes_.asStackTop().peek();
    }

    function peek(bytes memory bytes_, uint256 n_)
        external
        pure
        returns (uint256)
    {
        return bytes_.asStackTop().up(n_).peek();
    }

    function peek(uint256[] memory array_) external pure returns (uint256) {
        return array_.asStackTop().peek();
    }

    function peek(uint256[] memory array_, uint256 n_)
        external
        pure
        returns (uint256)
    {
        return array_.asStackTop().up(n_).peek();
    }

    function peek2(bytes memory bytes_, uint256 n_)
        external
        pure
        returns (uint256, uint256)
    {
        return bytes_.asStackTop().up(n_).peek2();
    }

    function peek2(uint256[] memory array_, uint256 n_)
        external
        pure
        returns (uint256, uint256)
    {
        return array_.asStackTop().up(n_).peek2();
    }

    function pop(bytes memory bytes_, uint256 n_)
        external
        pure
        returns (StackTop stackTopAfter_, uint256 a_)
    {
        (stackTopAfter_, a_) = bytes_.asStackTop().up(n_).pop();
    }

    function pop(uint256[] memory array_, uint256 n_)
        external
        pure
        returns (StackTop stackTopAfter_, uint256 a_)
    {
        (stackTopAfter_, a_) = array_.asStackTop().up(n_).pop();
    }
}
