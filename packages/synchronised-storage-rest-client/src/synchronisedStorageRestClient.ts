// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@3sixty/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@3sixty/api-models";
import { Guards } from "@3sixty/core";
import { nameof } from "@3sixty/nameof";
import type {
	ISyncChangeSet,
	ISyncChangeSetRequest,
	ISyncDecryptionKeyRequest,
	ISyncDecryptionKeyResponse,
	ISynchronisedStorageComponent
} from "@3sixty/synchronised-storage-models";
import { HeaderHelper, HeaderTypes, HttpMethod } from "@3sixty/web";

/**
 * Client for performing synchronised storage through to REST endpoints.
 */
export class SynchronisedStorageRestClient
	extends BaseRestClient
	implements ISynchronisedStorageComponent
{
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<SynchronisedStorageRestClient>();

	/**
	 * Create a new instance of SynchronisedStorageRestClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(SynchronisedStorageRestClient.CLASS_NAME, config, "synchronised-storage");
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return SynchronisedStorageRestClient.CLASS_NAME;
	}

	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns The decryption key.
	 */
	public async getDecryptionKey(trustPayload: unknown): Promise<string> {
		Guards.stringValue(
			SynchronisedStorageRestClient.CLASS_NAME,
			nameof(trustPayload),
			trustPayload
		);

		const response = await this.fetch<ISyncDecryptionKeyRequest, ISyncDecryptionKeyResponse>(
			"/decryption-key",
			HttpMethod.GET,
			{
				headers: {
					[HeaderTypes.Authorization]: HeaderHelper.createBearer(trustPayload)
				}
			}
		);

		return response.body.decryptionKey;
	}

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns A promise that resolves when the change set has been accepted by the trusted node.
	 */
	public async syncChangeSet(syncChangeSet: ISyncChangeSet, trustPayload: unknown): Promise<void> {
		Guards.object<ISyncChangeSet>(
			SynchronisedStorageRestClient.CLASS_NAME,
			nameof(syncChangeSet),
			syncChangeSet
		);

		Guards.stringValue(
			SynchronisedStorageRestClient.CLASS_NAME,
			nameof(trustPayload),
			trustPayload
		);

		await this.fetch<ISyncChangeSetRequest, INoContentResponse>(
			"/sync-changeset",
			HttpMethod.POST,
			{
				headers: {
					[HeaderTypes.Authorization]: HeaderHelper.createBearer(trustPayload)
				},
				body: syncChangeSet
			}
		);
	}
}
