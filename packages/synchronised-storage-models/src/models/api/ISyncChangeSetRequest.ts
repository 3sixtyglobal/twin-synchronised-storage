// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { HeaderTypes, MimeTypes } from "@3sixty/web";
import type { ISyncChangeSet } from "../ISyncChangeSet.js";

/**
 * Request a trusted node to perform a sync request for a changeset.
 */
export interface ISyncChangeSetRequest {
	/**
	 * The headers which can be used to determine the response data type.
	 */
	headers?: {
		[HeaderTypes.Accept]?: typeof MimeTypes.JsonLd | typeof MimeTypes.Json;
		[HeaderTypes.Authorization]?: string;
	};

	/**
	 * The body of the request.
	 */
	body: ISyncChangeSet;
}
