// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to a request for the decryption key for the synchronised storage.
 */
export interface ISyncDecryptionKeyResponse {
	/**
	 * The body of the response.
	 */
	body: {
		/**
		 * The decryption key for the synchronised storage as base64.
		 */
		decryptionKey: string;
	};
}
