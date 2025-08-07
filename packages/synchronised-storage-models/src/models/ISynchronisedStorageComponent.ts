// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { IProof } from "@twin.org/standards-w3c-did";
import type { ISyncChangeSet } from "./ISyncChangeSet";

/**
 * Class for performing synchronised storage operations.
 */
export interface ISynchronisedStorageComponent extends IComponent {
	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param nodeIdentity The identity of the node requesting the decryption key.
	 * @param proof The proof of the request so we know the request is from the specified node.
	 * @returns The decryption key.
	 */
	getDecryptionKey(nodeIdentity: string, proof: IProof): Promise<string>;

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @returns Nothing.
	 */
	syncChangeSet(syncChangeSet: ISyncChangeSet): Promise<void>;
}
