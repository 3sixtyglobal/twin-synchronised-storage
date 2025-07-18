// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IHttpRequestContext,
	INoContentResponse,
	IRestRoute,
	ITag
} from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import type {
	ISyncChangeSetRequest,
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
		method: "GET",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			synchronisedStorageSyncChangeSetRequest(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<ISyncChangeSetRequest>(),
			examples: [
				{
					id: "synchronisedStorageSyncChangeSetRequestExample",
					request: {
						query: {
							changeSetStorageId: "12345"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			}
		]
	};

	return [syncChangeSetRoute];
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
	Guards.object<ISyncChangeSetRequest["query"]>(
		ROUTES_SOURCE,
		nameof(request.query),
		request.query
	);
	const component = ComponentFactory.get<ISynchronisedStorageComponent>(componentName);
	await component.syncChangeSet(request.query.changeSetStorageId);
	return {
		statusCode: HttpStatusCode.noContent
	};
}
