// SPDX-License-Identifier: CAL
pragma solidity ^0.8.0;

/// @dev The index of a source within a deployed expression that can be evaluated
/// by an `IInterpreterV1`. MAY be an entrypoint or the index of a source called
/// internally such as by the `call` opcode.
type SourceIndex is uint256;
/// @dev Encoded information about a specific evaluation including the expression
/// address onchain, entrypoint and expected return values.
type EncodedDispatch is uint256;
/// @dev The namespace for state changes as requested by the calling contract.
/// The interpreter MUST apply this namespace IN ADDITION to namespacing by
/// caller etc.
type StateNamespace is uint256;
/// @dev Additional bytes that can be used to configure a single opcode dispatch.
/// Commonly used to specify the number of inputs to a variadic function such
/// as addition or multiplication.
type Operand is uint256;

/// @title IInterpreterV1
/// Interface into a standard interpreter that supports:
///
/// - evaluating `view` logic deployed onchain by an `IExpressionDeployerV1`
/// - receiving arbitrary `uint256[][]` supporting context to be made available
///   to the evaluated logic
/// - handling subsequent state changes in bulk in response to evaluated logic
/// - namespacing state changes according to the caller's preferences to avoid
///   unwanted key collisions
/// - exposing its internal function pointers to support external precompilation
///   of logic for more gas efficient runtime evaluation by the interpreter
///
/// The interface is designed to be stable across many versions and
/// implementations of an interpreter, balancing minimalism with features
/// required for a general purpose onchain interpreted compute environment.
///
/// The security model of an interpreter is that it MUST be resilient to
/// malicious expressions even if they dispatch arbitrary internal function
/// pointers during an eval. The interpreter MAY return garbage or exhibit
/// undefined behaviour or error during an eval, _provided that no state changes
/// are persisted_ e.g. in storage, such that only the caller that specifies the
/// malicious expression can be negatively impacted by the result. In turn, the
/// caller must guard itself against arbitrarily corrupt/malicious reverts and
/// return values from any interpreter that it requests an expression from. And
/// so on and so forth up to the externally owned account (EOA) who signs the
/// transaction and agrees to a specific combination of contracts, expressions
/// and interpreters, who can presumably make an informed decision about which
/// ones to trust to get the job done.
///
/// The state changes for an interpreter are expected to be produces by an `eval`
/// and passed back to the interpreter as-is by the caller, after the caller has
/// had an opportunity to apply their own intermediate logic such as reentrancy
/// defenses against malicious interpreters. The interpreter is free to structure
/// the state changes however it wants but MUST guard against the calling
/// contract corrupting the changes between `eval` and `stateChanges`. For
/// example an interpreter could sandbox storage writes per-caller so that a
/// malicious caller can only damage their own state changes, while honest
/// callers respect, benefit from and are protected by the interpreter's state
/// change handling.
///
/// The two step eval-state model allows eval to be read-only which provides
/// security guarantees for the caller such as no stateful reentrancy, either
/// from the interpreter or some contract interface used by some word, while
/// still allowing for storage writes. As the storage writes happen on the
/// interpreter rather than the caller (c.f. delegate call) the caller DOES NOT
/// need to trust the interpreter, which allows for permissionless selection of
/// interpreters by end users. Delegate call always implies an admin key on the
/// caller because the delegatee contract can write arbitrarily to the state of
/// the delegator, which severely limits the generality of contract composition.
interface IInterpreterV1 {
    /// Exposes the function pointers as `uint16` values packed into a single
    /// `bytes` in the same order as they would be indexed into by opcodes. For
    /// example, if opcode `2` should dispatch function at position `0x1234` then
    /// the start of the returned bytes would be `0xXXXXXXXX1234` where `X` is
    /// a placeholder for the function pointers of opcodes `0` and `1`.
    ///
    /// `IExpressionDeployerV1` contracts use these function pointers to
    /// "compile" the expression into something that an interpreter can dispatch
    /// directly without paying gas to lookup the same at runtime. As the
    /// validity of any integrity check and subsequent dispatch is highly
    /// sensitive to both the function pointers and overall bytecode of the
    /// interpreter, `IExpressionDeployerV1` contracts SHOULD implement guards
    /// against accidentally being deployed onchain paired against an unknown
    /// interpreter. It is very easy for an apparent compatible pairing to be
    /// subtly and critically incompatible due to addition/removal/reordering of
    /// opcodes and compiler optimisations on the interpreter bytecode.
    ///
    /// This MAY return different values during construction vs. all other times
    /// after the interpreter has been successfully deployed onchain. DO NOT rely
    /// on function pointers reported during contract construction.
    function functionPointers() external view returns (bytes memory);

    /// The raison d'etre for an interpreter. Given some expression and per-call
    /// additional contextual data, produce a stack of results and a set of state
    /// changes that the caller MAY OPTIONALLY pass back to be persisted by a
    /// call to `stateChanges`.
    /// @param dispatch All the information required for the interpreter to load
    /// an expression, select an entrypoint and return the values expected by the
    /// caller. The interpreter MAY encode dispatches differently to
    /// `LibEncodedDispatch` but this WILL negatively impact compatibility for
    /// calling contracts that hardcode the encoding logic.
    /// @param context A 2-dimensional array of data that can be indexed into at
    /// runtime by the interpreter. The calling contract is responsible for
    /// ensuring the authenticity and completeness of context data. The
    /// interpreter MUST revert at runtime if an expression attempts to index
    /// into some context value that is not provided by the caller. This implies
    /// that context reads cannot be checked for out of bounds reads at deploy
    /// time, as the runtime context MAY be provided in a different shape to what
    /// the expression is expecting.
    function eval(
        EncodedDispatch dispatch,
        uint256[][] calldata context
    )
        external
        view
        returns (uint256[] memory stack, uint256[] memory stateChanges);

    /// Applies state changes from a prior eval to the storage of the
    /// interpreter. The interpreter is responsible for ensuring that applying
    /// these state changes is safe from key collisions, both with any internal
    /// state the interpreter needs for itself and with calls to `stateChanges`
    /// from different `msg.sender` callers. I.e. it MUST NOT be possible for
    /// a caller to modify the state changes associated with some other caller.
    ///
    /// The interpreter defines the shape of its own state changes, which is
    /// opaque to the calling contract. For example, some interpreter may treat
    /// the list of state changes as a pairwise key/value set, and some other
    /// interpreter may treat it as a literal list to be stored as-is.
    ///
    /// The interpreter MUST assume the state changes have been corrupted by the
    /// calling contract due to bugs or malicious intent, and enforce state
    /// isolation between callers despite arbitrarily invalid state changes. The
    /// interpreter MUST revert if it can detect invalid state changes, such
    /// as a key/value list having an odd number of items, but this MAY NOT be
    /// possible if the corruption is undetectable.
    ///
    /// @param stateChanges The list of changes to apply to the interpreter's
    /// internal state.
    function stateChanges(uint256[] calldata stateChanges) external;

    /// Same as `eval` but allowing the caller to specify a namespace under which
    /// the state changes will be applied. The interpeter MUST ensure that keys
    /// will never collide across namespaces, even if, for example:
    ///
    /// - The calling contract is malicious and attempts to craft a collision
    ///   with state changes from another contract
    /// - The expression is malicious and attempts to craft a collision with
    ///   other expressions evaluated by the same calling contract
    ///
    /// A malicious entity MAY have access to significant offchain resources to
    /// attempt to precompute key collisions through brute force. The collision
    /// resistance of namespaces should be comparable or equivalent to the
    /// collision resistance of the hashing algorithms employed by the blockchain
    /// itself, such as the design of `mapping` in Solidity that hashes each
    /// nested key to produce a collision resistant compound key.
    ///
    /// Calls to `eval` without a namespace are implied to be under namespace `0`
    /// so an interpreter MAY implement `eval` in terms of `evalWithNamespace` if
    /// this simplifies the implementation.
    ///
    /// @param namespace The namespace specified by the calling contract.
    /// @param dispatch As per `eval`.
    /// @param context As per `eval`.
    /// @return stack As per `eval`.
    /// @return stateChanges As per `eval`.
    function evalWithNamespace(
        StateNamespace namespace,
        EncodedDispatch dispatch,
        uint256[][] calldata context
    )
        external
        view
        returns (uint256[] memory stack, uint256[] memory stateChanges);

    /// Same as `stateChanges` but following `evalWithNamespace`. The caller MUST
    /// use the same namespace for both `evalWithNamespace` and
    /// `stateChangesWithNamespace` for a given expression evaluation.
    /// @param namespace As per `evalWithNamespace`.
    /// @param stateChanges as per `stateChanges`.
    function stateChangesWithNamespace(
        StateNamespace namespace,
        uint256[] calldata stateChanges
    ) external;
}
