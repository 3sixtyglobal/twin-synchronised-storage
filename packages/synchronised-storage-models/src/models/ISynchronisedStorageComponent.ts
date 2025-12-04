// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { ISyncChangeSet } from "./ISyncChangeSet.js";

/**
 * Class for performing synchronised storage operations.
 */
export interface ISynchronisedStorageComponent extends IComponent {
	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns The decryption key.
	 */
	getDecryptionKey(trustPayload: unknown): Promise<string>;

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns Nothing.
	 */
	syncChangeSet(syncChangeSet: ISyncChangeSet, trustPayload: unknown): Promise<void>;
}
