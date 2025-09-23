// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { IIdentityAuthenticationActionRequest } from "@twin.org/identity-authentication";
import type { ISyncChangeSet } from "./ISyncChangeSet";

/**
 * Class for performing synchronised storage operations.
 */
export interface ISynchronisedStorageComponent extends IComponent {
	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param actionRequest The action request used in the verifiable credential.
	 * @returns The decryption key.
	 */
	getDecryptionKey(actionRequest: IIdentityAuthenticationActionRequest): Promise<string>;

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param actionRequest The action request used in the verifiable credential.
	 * @returns Nothing.
	 */
	syncChangeSet(
		syncChangeSet: ISyncChangeSet,
		actionRequest: IIdentityAuthenticationActionRequest
	): Promise<void>;
}
