// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@twin.org/api-models";
import { Guards } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import type {
	ISyncChangeSetRequest,
	ISynchronisedStorageComponent
} from "@twin.org/synchronised-storage-models";

/**
 * Client for performing synchronised storage through to REST endpoints.
 */
export class SynchronisedStorageClient
	extends BaseRestClient
	implements ISynchronisedStorageComponent
{
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<SynchronisedStorageClient>();

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = SynchronisedStorageClient._CLASS_NAME;

	/**
	 * Create a new instance of SynchronisedStorageClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(SynchronisedStorageClient._CLASS_NAME, config, "synchronised-storage");
	}

	/**
	 * Synchronise a complete set of changes, assumes this is a trusted node.
	 * @param changeSetStorageId The id of the change set to synchronise in blob storage.
	 * @returns Nothing.
	 */
	public async syncChangeSet(changeSetStorageId: string): Promise<void> {
		Guards.string(this.CLASS_NAME, nameof(changeSetStorageId), changeSetStorageId);

		await this.fetch<ISyncChangeSetRequest, INoContentResponse>("/", "GET", {
			query: {
				changeSetStorageId
			}
		});
	}
}
