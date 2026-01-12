// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IHttpRequestContext,
	INoContentResponse,
	IRestRoute,
	ITag,
	IUnauthorizedResponse
} from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import {
	SynchronisedStorageContexts,
	SynchronisedStorageTypes,
	type ISyncChangeSetRequest,
	type ISyncDecryptionKeyRequest,
	type ISyncDecryptionKeyResponse,
	type ISynchronisedStorageComponent
} from "@twin.org/synchronised-storage-models";
import { HeaderHelper, HeaderTypes, HttpStatusCode } from "@twin.org/web";

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
						headers: {
							[HeaderTypes.Authorization]: "z3V32BP9ShC...z3V32BP9ShC"
						},
						body: {
							"@context": SynchronisedStorageContexts.ContextRoot,
							type: SynchronisedStorageTypes.ChangeSet,
							id: "0909090909090909090909090909090909090909090909090909090909090909",
							dateCreated: "2025-05-29T01:00:00.000Z",
							dateModified: "2025-05-29T01:00:00.000Z",
							nodeId:
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
					request: {}
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
	Guards.object<ISyncChangeSetRequest["headers"]>(
		ROUTES_SOURCE,
		nameof(request.headers),
		request.headers
	);
	Guards.object<ISyncChangeSetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<ISyncChangeSetRequest["body"]>(ROUTES_SOURCE, nameof(request.body), request.body);

	const component = ComponentFactory.get<ISynchronisedStorageComponent>(componentName);
	await component.syncChangeSet(
		request.body,
		HeaderHelper.extractBearer(request.headers?.[HeaderTypes.Authorization])
	);
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
	Guards.object<ISyncChangeSetRequest["headers"]>(
		ROUTES_SOURCE,
		nameof(request.headers),
		request.headers
	);
	Guards.object<ISyncDecryptionKeyRequest>(ROUTES_SOURCE, nameof(request), request);

	const component = ComponentFactory.get<ISynchronisedStorageComponent>(componentName);
	const key = await component.getDecryptionKey(
		HeaderHelper.extractBearer(request.headers?.[HeaderTypes.Authorization])
	);
	return {
		body: {
			decryptionKey: key
		}
	};
}
