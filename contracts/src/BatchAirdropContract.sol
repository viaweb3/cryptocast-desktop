// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Minimal ERC20 Interface
 * @dev Only includes the transferFrom function needed for batch transfers
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title BatchAirdropContract - Gas Optimized
 * @dev Ultra-lightweight batch transfer contract for ERC20 tokens and native tokens
 *
 * Gas Optimizations:
 * - No external dependencies (OpenZeppelin removed)
 * - Uses calldata instead of memory for array parameters
 * - Caches array length to avoid repeated SLOAD operations
 * - Uses unchecked increment (safe because loop counter can't overflow)
 * - Caches token contract reference to avoid repeated type conversions
 * - Uses custom errors instead of require strings (saves ~50 gas per error)
 *
 * Security:
 * - Atomic transactions: all transfers succeed or all fail (no partial success)
 * - No reentrancy risk: only calls transferFrom with no state changes after
 * - Reverts on any transfer failure (insufficient balance/allowance)
 */
contract BatchAirdropContract {
    /// @notice Thrown when recipients and amounts arrays have different lengths
    error LengthMismatch();

    /// @notice Thrown when a token transfer fails
    error TransferFailed();

    /// @notice Thrown when native token transfer fails
    error NativeTransferFailed();

    /// @notice Thrown when insufficient native token sent
    error InsufficientValue();

    /**
     * @notice Executes batch transfers of ERC20 tokens to multiple recipients
     * @dev Caller must have approved this contract to spend tokens beforehand
     * @param token The ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of token amounts (in token's smallest unit)
     *
     * Requirements:
     * - recipients.length must equal amounts.length
     * - Caller must have sufficient token balance
     * - Caller must have approved sufficient allowance for this contract
     *
     * Effects:
     * - Transfers tokens from msg.sender to each recipient
     * - Reverts entirely if any single transfer fails (atomic operation)
     */
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 length = recipients.length;
        if (length != amounts.length) revert LengthMismatch();

        IERC20 tokenContract = IERC20(token);

        for (uint256 i = 0; i < length; ) {
            if (!tokenContract.transferFrom(msg.sender, recipients[i], amounts[i])) {
                revert TransferFailed();
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Executes batch transfers of native tokens (ETH/BNB/MATIC/etc) to multiple recipients
     * @dev Accepts native tokens via msg.value and distributes to recipients
     * @param recipients Array of recipient addresses
     * @param amounts Array of native token amounts (in wei)
     *
     * Requirements:
     * - recipients.length must equal amounts.length
     * - msg.value must equal the sum of all amounts
     *
     * Effects:
     * - Transfers native tokens to each recipient
     * - Reverts entirely if any single transfer fails (atomic operation)
     */
    function batchTransferNative(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        uint256 length = recipients.length;
        if (length != amounts.length) revert LengthMismatch();

        // Calculate total amount needed
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < length; ) {
            totalAmount += amounts[i];
            unchecked { ++i; }
        }

        // Verify sufficient value sent
        if (msg.value < totalAmount) revert InsufficientValue();

        // Transfer native tokens to each recipient
        for (uint256 i = 0; i < length; ) {
            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            if (!success) revert NativeTransferFailed();
            unchecked { ++i; }
        }

        // Refund excess if any
        uint256 excess = msg.value - totalAmount;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            if (!success) revert NativeTransferFailed();
        }
    }
}
