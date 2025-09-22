// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ActionType } from "@twin.org/standards-w3c-odrl";

/**
 * The ODRL asset types for SynchronisedStorage.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SynchronisedStorageAssetTypes = {
	/**
	 * Decryption Key.
	 */
	DecryptionKey: "decryption-key",

	/**
	 * Decryption Key Actions.
	 */
	DecryptionKeyActions: [ActionType.Read],

	/**
	 * Change Set.
	 */
	ChangeSet: "change-set",

	/**
	 * Change Set Actions.
	 */
	ChangeSetActions: [ActionType.Write]
} as const;

/**
 * The ODRL asset types for SynchronisedStorage.
 */
export type SynchronisedStorageAssetTypes =
	(typeof SynchronisedStorageAssetTypes)[keyof typeof SynchronisedStorageAssetTypes];
