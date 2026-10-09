// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@3sixty/api-models";
import {
	generateRestRoutesSynchronisedStorage,
	tagsSynchronisedStorage
} from "./synchronisedStorageRoutes.js";

/**
 * REST entry points for the synchronised storage service.
 */
export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "synchronised-storage",
		defaultBaseRoute: "synchronised-storage",
		tags: tagsSynchronisedStorage,
		generateRoutes: generateRestRoutesSynchronisedStorage
	}
];
