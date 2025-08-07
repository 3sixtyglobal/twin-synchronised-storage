// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISyncChangeSet } from "../ISyncChangeSet";

/**
 * Request a trusted node to perform a sync request for a changeset.
 */
export interface ISyncChangeSetRequest {
	/**
	 * The body of the request.
	 */
	body: ISyncChangeSet;
}
