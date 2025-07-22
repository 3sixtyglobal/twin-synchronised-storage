// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The operations for a change.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SyncChangeOperation = {
	/**
	 * An item was set in the storage.
	 */
	Set: "set",

	/**
	 * An item was deleted from the storage.
	 */
	Delete: "delete"
} as const;

/**
 * The operations for a change
 */
export type SyncChangeOperation = (typeof SyncChangeOperation)[keyof typeof SyncChangeOperation];
