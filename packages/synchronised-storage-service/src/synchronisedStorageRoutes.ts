// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IUnauthorizedResponse,
	IHttpRequestContext,
	INoContentResponse,
	IRestRoute,
	ITag
} from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import type {
	ISyncChangeSetRequest,
	ISyncDecryptionKeyRequest,
	ISyncDecryptionKeyResponse,
	ISynchronisedStorageComponent
} from "@twin.org/synchronised-storage-models";
import { HttpStatusCode } from "@twin.org/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "synchronisedStorageRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsSynchronisedStorage: ITag[] = [
	{
		name: "Synchronised Storage",
		description: "Endpoints which are modelled to access a synchronised storage contract."
	}
];

/**
 * The REST routes for synchronised storage.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesSynchronisedStorage(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const syncChangeSetRoute: IRestRoute<ISyncChangeSetRequest, INoContentResponse> = {
		operationId: "synchronisedStorageSyncChangeSetRequest",
		summary: "Request that the node perform a sync request for a changeset.",
		tag: tagsSynchronisedStorage[0].name,
		method: "POST",
		path: `${baseRouteName}/sync-changeset`,
		handler: async (httpRequestContext, request) =>
			synchronisedStorageSyncChangeSetRequest(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<ISyncChangeSetRequest>(),
			examples: [
				{
					id: "synchronisedStorageSyncChangeSetRequestExample",
					request: {
						body: {
							id: "0909090909090909090909090909090909090909090909090909090909090909",
							dateCreated: "2025-05-29T01:00:00.000Z",
							dateModified: "2025-05-29T01:00:00.000Z",
							nodeIdentity:
								"did:entity-storage:0xd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
							changes: [
								{
									entity: {
										dateModified: "2025-01-01T00:00:00.000Z"
									},
									id: "test-id-1",
									operation: "set"
								}
							],
							proof: {
								"@context": "https://www.w3.org/ns/credentials/v2",
								created: "2025-05-29T01:00:00.000Z",
								cryptosuite: "eddsa-jcs-2022",
								proofPurpose: "assertionMethod",
								proofValue:
									"z5efBErQs3YBLZoH7jgKMQaRc9YjAxA5XSYKmW3FmTBDw9WionT2NS2x1SMvcRyBvw53cSSoaCT1xQH9tkWngGCX3",
								type: "DataIntegrityProof",
								verificationMethod:
									"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0#synchronised-storage-assertion"
							},
							storageKey: "test-type"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			}
		],
		// Authentication is provided by the proof in the request body.
		skipAuth: true
	};

	const getDecryptionKeyRoute: IRestRoute<ISyncDecryptionKeyRequest, ISyncDecryptionKeyResponse> = {
		operationId: "synchronisedStorageGetDecryptionKeyRequest",
		summary: "Request the decryption key.",
		tag: tagsSynchronisedStorage[0].name,
		method: "POST",
		path: `${baseRouteName}/decryption-key`,
		handler: async (httpRequestContext, request) =>
			synchronisedStorageGetDecryptionKeyRequest(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<ISyncChangeSetRequest>(),
			examples: [
				{
					id: "synchronisedStorageSyncGetDecryptionKeyRequestExample",
					request: {
						body: {
							nodeIdentity:
								"did:entity-storage:0xd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
							proof: {
								"@context": "https://www.w3.org/ns/credentials/v2",
								created: "2025-05-29T01:00:00.000Z",
								cryptosuite: "eddsa-jcs-2022",
								proofPurpose: "assertionMethod",
								proofValue:
									"z5efBErQs3YBLZoH7jgKMQaRc9YjAxA5XSYKmW3FmTBDw9WionT2NS2x1SMvcRyBvw53cSSoaCT1xQH9tkWngGCX3",
								type: "DataIntegrityProof",
								verificationMethod:
									"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0#synchronised-storage-assertion"
							}
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<ISyncDecryptionKeyResponse>(),
				examples: [
					{
						id: "synchronisedStorageSyncGetDecryptionKeyResponseExample",
						response: {
							body: {
								decryptionKey:
									"z5efBErQs3YBLZoH7jgKMQaRc9YjAxA5XSYKmW3FmTBDw9WionT2NS2x1SMvcRyBvw53cSSoaCT1xQH9tkWngGCX3"
							}
						}
					}
				]
			},
			{
				type: nameof<IUnauthorizedResponse>()
			}
		],
		// Authentication is provided by the proof in the request body.
		skipAuth: true
	};

	return [syncChangeSetRoute, getDecryptionKeyRoute];
}

/**
 * Perform the sync change set operation.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function synchronisedStorageSyncChangeSetRequest(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: ISyncChangeSetRequest
): Promise<INoContentResponse> {
	Guards.object<ISyncChangeSetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<ISyncChangeSetRequest["body"]>(ROUTES_SOURCE, nameof(request.body), request.body);
	const component = ComponentFactory.get<ISynchronisedStorageComponent>(componentName);
	await component.syncChangeSet(request.body);
	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Request the decryption key.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function synchronisedStorageGetDecryptionKeyRequest(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: ISyncDecryptionKeyRequest
): Promise<ISyncDecryptionKeyResponse> {
	Guards.object<ISyncDecryptionKeyRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<ISyncDecryptionKeyRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const component = ComponentFactory.get<ISynchronisedStorageComponent>(componentName);
	const key = await component.getDecryptionKey(request.body.nodeIdentity, request.body.proof);
	return {
		body: {
			decryptionKey: key
		}
	};
}
