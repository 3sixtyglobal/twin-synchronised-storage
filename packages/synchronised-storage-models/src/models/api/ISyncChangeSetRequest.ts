// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request a trusted node to perform a sync request for a changeset.
 */
export interface ISyncChangeSetRequest {
	/**
	 * The query parameters.
	 */
	query: {
		/**
		 * The storage id of the changeset.
		 */
		changeSetStorageId: string;
	};
}
