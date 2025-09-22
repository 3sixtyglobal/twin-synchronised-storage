// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { ISyncChangeSet } from "./ISyncChangeSet";

/**
 * Class for performing synchronised storage operations.
 */
export interface ISynchronisedStorageComponent extends IComponent {
	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param proofToken The proof token to validate the request.
	 * @returns The decryption key.
	 */
	getDecryptionKey(proofToken: string): Promise<string>;

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param proofToken The proof token to validate the request.
	 * @returns Nothing.
	 */
	syncChangeSet(syncChangeSet: ISyncChangeSet, proofToken: string): Promise<void>;
}
