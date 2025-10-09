// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@twin.org/api-models";
import { Guards } from "@twin.org/core";
import type { IIdentityAuthenticationActionRequest } from "@twin.org/identity-authentication";
import { nameof } from "@twin.org/nameof";
import type {
	ISyncChangeSet,
	ISyncChangeSetRequest,
	ISyncDecryptionKeyRequest,
	ISyncDecryptionKeyResponse,
	ISynchronisedStorageComponent
} from "@twin.org/synchronised-storage-models";

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
		super(
			SynchronisedStorageRestClient.CLASS_NAME,
			{
				...config,
				authenticationGeneratorType: config.authenticationGeneratorType ?? "verifiable-credential"
			},
			"synchronised-storage"
		);
	}

	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param actionRequest The action request used in the verifiable credential.
	 * @returns The decryption key.
	 */
	public async getDecryptionKey(
		actionRequest: IIdentityAuthenticationActionRequest
	): Promise<string> {
		Guards.object<IIdentityAuthenticationActionRequest>(
			SynchronisedStorageRestClient.CLASS_NAME,
			nameof(actionRequest),
			actionRequest
		);

		const response = await this.fetch<ISyncDecryptionKeyRequest, ISyncDecryptionKeyResponse>(
			"/decryption-key",
			"GET",
			{
				authentication: actionRequest
			}
		);

		return response.body.decryptionKey;
	}

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param actionRequest The action request used in the verifiable credential.
	 * @returns Nothing.
	 */
	public async syncChangeSet(
		syncChangeSet: ISyncChangeSet,
		actionRequest: IIdentityAuthenticationActionRequest
	): Promise<void> {
		Guards.object<ISyncChangeSet>(
			SynchronisedStorageRestClient.CLASS_NAME,
			nameof(syncChangeSet),
			syncChangeSet
		);

		await this.fetch<ISyncChangeSetRequest, INoContentResponse>("/sync-changeset", "POST", {
			body: syncChangeSet,
			authentication: actionRequest
		});
	}
}
