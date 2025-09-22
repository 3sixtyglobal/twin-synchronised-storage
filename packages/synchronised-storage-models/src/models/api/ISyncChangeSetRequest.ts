// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { HeaderTypes } from "@twin.org/web";
import type { ISyncChangeSet } from "../ISyncChangeSet";

/**
 * Request a trusted node to perform a sync request for a changeset.
 */
export interface ISyncChangeSetRequest {
	/**
	 * The headers which can be used to determine the response data type.
	 */
	headers: {
		[HeaderTypes.Authorization]: string;
	};

	/**
	 * The body of the request.
	 */
	body: ISyncChangeSet;
}
