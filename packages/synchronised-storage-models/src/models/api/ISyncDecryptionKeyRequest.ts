// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProof } from "@twin.org/standards-w3c-did";

/**
 * Request for the decryption key for the synchronised storage.
 */
export interface ISyncDecryptionKeyRequest {
	/**
	 * The body of the request.
	 */
	body: {
		/**
		 * The identity of the node making the request.
		 */
		nodeIdentity: string;

		/**
		 * The proof of the request.
		 */
		proof: IProof;
	};
}
