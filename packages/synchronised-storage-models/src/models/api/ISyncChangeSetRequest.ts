// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityAuthenticationActionRequest } from "@twin.org/identity-authentication";
import type { HeaderTypes, MimeTypes } from "@twin.org/web";
import type { ISyncChangeSet } from "../ISyncChangeSet";

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

	/**
	 * The action request used in the verifiable credential.
	 */
	authentication: IIdentityAuthenticationActionRequest;
}
