// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@twin.org/api-models";
import { Guards } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import type { IProof } from "@twin.org/standards-w3c-did";
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
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param nodeIdentity The identity of the node requesting the decryption key.
	 * @param proof The proof of the request so we know the request is from the specified node.
	 * @returns The decryption key.
	 */
	public async getDecryptionKey(nodeIdentity: string, proof: IProof): Promise<string> {
		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);
		Guards.object<IProof>(this.CLASS_NAME, nameof(proof), proof);

		const response = await this.fetch<ISyncDecryptionKeyRequest, ISyncDecryptionKeyResponse>(
			"/decryption-key",
			"POST",
			{
				body: {
					nodeIdentity,
					proof
				}
			}
		);

		return response.body.decryptionKey;
	}

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @returns Nothing.
	 */
	public async syncChangeSet(syncChangeSet: ISyncChangeSet): Promise<void> {
		Guards.object<ISyncChangeSet>(this.CLASS_NAME, nameof(syncChangeSet), syncChangeSet);

		await this.fetch<ISyncChangeSetRequest, INoContentResponse>("/sync-changeset", "POST", {
			body: syncChangeSet
		});
	}
}
