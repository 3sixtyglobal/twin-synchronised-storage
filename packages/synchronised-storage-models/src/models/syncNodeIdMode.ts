// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The mode to determine how node identities are matched.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SyncNodeIdMode = {
	/**
	 * Match the local node identity.
	 */
	Local: "local",

	/**
	 * Match all but the local node identity.
	 */
	Remote: "remote",

	/**
	 * All match both local and remote entities.
	 */
	All: "all"
} as const;

/**
 * The mode to determine how node identities are matched.
 */
export type SyncNodeIdMode = (typeof SyncNodeIdMode)[keyof typeof SyncNodeIdMode];
