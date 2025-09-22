// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { HeaderTypes } from "@twin.org/web";

/**
 * Request for the decryption key for the synchronised storage.
 */
export interface ISyncDecryptionKeyRequest {
	/**
	 * The headers which can be used to determine the response data type.
	 */
	headers: {
		[HeaderTypes.Authorization]: string;
	};
}
