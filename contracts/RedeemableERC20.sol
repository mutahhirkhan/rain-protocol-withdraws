// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

pragma experimental ABIEncoderV2;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

import { PrestigeByConstruction } from "./tv-prestige/contracts/PrestigeByConstruction.sol";
import { IPrestige } from "./tv-prestige/contracts/IPrestige.sol";

import { Phase, Phased } from "./Phased.sol";

/// Everything required by the `RedeemableERC20` constructor.
struct RedeemableERC20Config {
    // Name forwarded through to parent ERC20 contract.
    string name;
    // Symbol forwarded through to parent ERC20 contract.
    string symbol;
    // Prestige contract to compare statuses against on transfer.
    IPrestige prestige;
    // Minimum status required for transfers in `Phase.ZERO`. Can be 0.
    IPrestige.Status minimumStatus;
    // Number of redeemable tokens to mint.
    uint256 totalSupply;
}

/// @title RedeemableERC20
/// `RedeemableERC20` is an ERC20 with 2 phases.
///
/// `Phase.ZERO` is the distribution phase where the token can be freely transfered but not redeemed.
/// `Phase.ONE` is the redemption phase where the token can be redeemed but no longer transferred.
///
/// Redeeming some amount of `RedeemableERC20` burns the token in exchange for some other tokens held by the contract.
/// For example, if the `RedeemableERC20` token contract holds 100 000 USDC then a holder of the redeemable token
/// can burn some of their tokens to receive a % of that USDC. If they redeemed (burned) an amount equal to 10% of the redeemable token supply then
/// they would receive 10 000 USDC.
///
/// Up to 8 redeemable tokens can be registered on the redeemable contract. These will be looped over by default in
/// the `senderRedeem` function. If there is an error during redemption or more than 8 tokens are to be redeemed,
/// there is a `senderRedeemSpecific` function that allows the caller to specify exactly which of the redeemable tokens they want to receive.
/// Note: the same amount of `RedeemableERC20` is burned, regardless of which redeemable tokens were specified. Specifying fewer redeemable tokens 
/// will NOT increase the proportion of each that is returned. `senderRedeemSpecific` is intended as a last resort if the caller cannot resolve
/// issues causing errors for one or more redeemable tokens during redemption.
///
/// `RedeemableERC20` has several owner administrative functions:
/// - Owner can add senders and receivers that can send/receive tokens even during `Phase.ONE`
/// - Owner can add redeemable tokens
///   - But NOT remove them
///   - And everyone can call `senderRedeemSpecific` to override the redeemable list
/// - Owner can schedule `Phase.ONE` during `Phase.ZERO`
///
/// The intent is that the redeemable token contract is owned by a `Trust` contract, NOT an externally owned account.
/// The `Trust` contract will add the minimum possible senders/receivers to facilitate the AMM trading and redemption.
/// The `Trust` will also control access to managing redeemable tokens and moving to `Phase.ONE`.
///
/// RedeemableERC20 is not upgradeable.
///
/// The redeem functions MUST be used to redeem RedeemableERC20s.
/// Sending RedeemableERC20 tokens to the RedeemableERC20 contract address will _make them unrecoverable_.
///
/// The `senderRedeem` and `senderRedeemSpecific` functions will simply revert if called outside `Phase.ONE`.
/// A `Redeem` event is emitted on every redemption (per redeemed token) as `(_redeemer, _redeemable, _redeemAmount)`.
contract RedeemableERC20 is Ownable, Phased, PrestigeByConstruction, ERC20, ReentrancyGuard, ERC20Burnable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// Redeemable token burn amount.
    event Redeem(
        // Account burning and receiving.
        address indexed redeemer,
        // The token being sent to the burner.
        address indexed redeemable,
        // The amount of the redeemable and token being redeemed as `[redeemAmount, tokenAmount]`
        uint256[2] redeemAmounts
    );

    /// The maximum number of redeemables that can be set.
    /// Attempting to add more redeemables than this will fail with an error.
    /// This prevents a very large loop in the default redemption behaviour.
    uint8 public constant MAX_REDEEMABLES = 8;

    /// @dev List of redeemables to loop over in default redemption behaviour.
    ///      see `getRedeemables`.
    IERC20[] private redeemables;

    /// The minimum status that a user must hold to receive transfers during `Phase.ZERO`.
    /// The prestige contract passed to `PrestigeByConstruction` determines if the status is held during `_beforeTokenTransfer`.
    IPrestige.Status public minimumPrestigeStatus;

    /// 8 bit mappings for addresses that can be whitelisted for sending and receiving independently.
    mapping(address => uint8) public unfreezables;

    /// Mint the full ERC20 token supply and configure basic transfer restrictions.
    /// @param redeemableERC20Config_ All the constructor configuration.
    constructor (
        RedeemableERC20Config memory redeemableERC20Config_
    )
        public
        ERC20(redeemableERC20Config_.name, redeemableERC20Config_.symbol)
        PrestigeByConstruction(redeemableERC20Config_.prestige)
    {
        minimumPrestigeStatus = redeemableERC20Config_.minimumStatus;

        // Add the owner as a receiver to simplify `_beforeTokenTransfer` logic.
        // Can't call `ownerAddReceiver` here as the owner is not set at this point.
        unfreezables[msg.sender] = 0x0002;

        _mint(msg.sender, redeemableERC20Config_.totalSupply);
    }

    /// Owner can add accounts to the sender list.
    /// Senders can always send token transfers in either phase.
    /// The original owner is guaranteed to be on the sender list at construction.
    /// Senders cannot be removed.
    /// Senders can ONLY be added during `Phase.ZERO`.
    /// @param account_ The account to set sender status for.
    function ownerAddSender(address account_)
        external
        onlyOwner
        onlyPhase(Phase.ZERO)
    {
        unfreezables[account_] = unfreezables[account_] | 0x0001;
    }

    /// Checks if a given account is on the sender list.
    /// Senders can always send token transfers in either phase.
    /// @param account_ The account to check sender status for.
    /// @return True if the account is a sender.
    function isSender(address account_) public view returns (bool) {
        return (unfreezables[account_] & 0x0001) == 0x0001;
    }

    /// Owner can add accounts to the receiver list.
    /// Receivers can always receive token transfers in either phase.
    /// Receivers cannot be removed.
    /// Receivers can ONLY be added during `Phase.ZERO`.
    /// @param account_ The account to set receiver status for.
    function ownerAddReceiver(address account_)
        external
        onlyOwner
        onlyPhase(Phase.ZERO)
        {
            unfreezables[account_] = unfreezables[account_] | 0x02;
        }

    /// Checks if a given account is on the receiver list.
    /// Receivers can always receive token transfers in either phase.
    /// @param account_ The account to check receiver status for.
    /// @return True if the account is a receiver.
    function isReceiver(address account_) public view returns (bool) {
        return (unfreezables[account_] & 0x0002) == 0x0002;
    }

    /// Owner can schedule `Phase.ONE` at any point during `Phase.ZERO`.
    /// It is intended that the owner will be a contract that can implement controls around this phase shift.
    /// Calling this more than once will error as there is no `Phase.TWO`.
    /// @param newPhaseBlock_ The first block of `Phase.ONE`.
    function ownerScheduleNextPhase(uint32 newPhaseBlock_) external onlyOwner {
        scheduleNextPhase(newPhaseBlock_);
    }

    /// Owner can add up to 8 redeemables to this contract.
    /// Each redeemable will be sent to token holders when they call redeem functions in `Phase.ONE` to burn tokens.
    /// If the owner adds a non-compliant or malicious IERC20 address then token holders can override the list with `senderRedeemSpecific`.
    /// @param newRedeemable_ The redeemable contract address to add.
    function ownerAddRedeemable(IERC20 newRedeemable_) external onlyOwner {
        // Somewhat arbitrary but we limit the length of redeemables to 8.
        // 8 is actually a lot.
        // Consider that every `redeem` call must loop a `balanceOf` and `safeTransfer` per redeemable.
        require(redeemables.length<MAX_REDEEMABLES, "MAX_REDEEMABLES");
        for (uint256 i_ = 0; i_<redeemables.length;i_++) {
            require(redeemables[i_] != newRedeemable_, "DUPLICATE_REDEEMABLE");
        }
        redeemables.push(newRedeemable_);
    }

    /// Public getter for underlying registered redeemables as a fixed sized array.
    /// The underlying array is dynamic but fixed size return values provide clear bounds on gas etc.
    /// @return Dynamic `redeemables` mapped to a fixed size array.
    function getRedeemables() external view returns (address[8] memory) {
        address[8] memory redeemablesArray_;
        for(uint256 i_ = 0;i_<redeemables.length;i_++) {
            redeemablesArray_[i_] = address(redeemables[i_]);
        }
        return redeemablesArray_;
    }

    /// Redeem tokens.
    /// Tokens can be redeemed but NOT transferred during `Phase.ONE`.
    ///
    /// Calculate the redeem value of tokens as:
    ///
    /// ( redeemAmount / redeemableErc20Token.totalSupply() ) * token.balanceOf(address(this))
    ///
    /// This means that the users get their redeemed pro-rata share of the outstanding token supply
    /// burned in return for a pro-rata share of the current balance of each redeemable token.
    ///
    /// I.e. whatever % of redeemable tokens the sender burns is the % of the current reserve they receive.
    ///
    /// Note: Any tokens held by `address(0)` are burned defensively.
    ///       This is because transferring directly to `address(0)` will succeed but the `totalSupply` won't reflect it.
    function senderRedeemSpecific(IERC20[] memory specificRedeemables_, uint256 redeemAmount_) public onlyPhase(Phase.ONE) nonReentrant {
        // The fraction of the redeemables we release is the fraction of the outstanding total supply passed in.
        // Every redeemable is released in the same proportion.
        uint256 supplyBeforeBurn_ = totalSupply();

        // Redeem __burns__ tokens which reduces the total supply and requires no approval.
        // _burn reverts internally if needed (e.g. if burn exceeds balance).
        // This function is `nonReentrant` but we burn before redeeming anyway.
        _burn(msg.sender, redeemAmount_);

        for(uint256 i_ = 0; i_ < specificRedeemables_.length; i_++) {
            IERC20 ithRedeemable_ = specificRedeemables_[i_];
            uint256 tokenAmount_ = ithRedeemable_.balanceOf(address(this)).mul(redeemAmount_).div(supplyBeforeBurn_);
            emit Redeem(msg.sender, address(ithRedeemable_), [redeemAmount_, tokenAmount_]);
            ithRedeemable_.safeTransfer(
                msg.sender,
                tokenAmount_
            );
        }
    }

    /// Default redemption behaviour.
    /// Thin wrapper for `senderRedeemSpecific`.
    /// `msg.sender` specifies an amount of their own redeemable token to redeem.
    /// Each redeemable token specified by this contract's owner will be sent to the sender pro-rata.
    /// The sender's tokens are burned in the process.
    /// @param redeemAmount_ The amount of the sender's redeemable erc20 to burn.
    function senderRedeem(uint256 redeemAmount_) external { senderRedeemSpecific(redeemables, redeemAmount_); }

    /// Sanity check to ensure `Phase.ONE` is the final phase.
    /// @inheritdoc Phased
    function _beforeScheduleNextPhase(uint32 nextPhaseBlock_) internal override virtual {
        super._beforeScheduleNextPhase(nextPhaseBlock_);
        assert(currentPhase() < Phase.ONE);
    }

    /// Apply phase sensitive transfer restrictions.
    /// During `Phase.ZERO` only prestige requirements apply.
    /// During `Phase.ONE` all transfers except burns are prevented.
    /// If a transfer involves either a sender or receiver with the relevant `unfreezables` state it will ignore these restrictions.
    /// @inheritdoc ERC20
    function _beforeTokenTransfer(
        address sender_,
        address receiver_,
        uint256 amount_
    )
        internal
        override
        virtual
    {
        super._beforeTokenTransfer(sender_, receiver_, amount_);

        // Sending tokens to this contract (e.g. instead of redeeming) is always an error.
        require(receiver_ != address(this), "TOKEN_SEND_SELF");

        // Some contracts may attempt a preflight (e.g. Balancer) of a 0 amount transfer.
        // We don't want to accidentally cause external errors due to zero value transfers.
        if (amount_ > 0
            // The sender and receiver lists bypass all access restrictions.
            && !(isSender(sender_) || isReceiver(receiver_))) {

            // During `Phase.ZERO` transfers are only restricted by the prestige of the recipient.
            if (currentPhase() == Phase.ZERO) { require(isStatus(receiver_, minimumPrestigeStatus), "MIN_STATUS"); }
            // During `Phase.ONE` only token burns are allowed.
            else if (currentPhase() == Phase.ONE) { require(receiver_ == address(0), "FROZEN"); }
            // There are no other phases.
            else { assert(false); }
        }
    }
}
