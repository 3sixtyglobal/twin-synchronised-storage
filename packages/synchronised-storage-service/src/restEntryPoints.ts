// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@twin.org/api-models";
import {
	generateRestRoutesSynchronisedStorage,
	tagsSynchronisedStorage
} from "./synchronisedStorageRoutes";

export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "synchronised-storage",
		defaultBaseRoute: "synchronised-storage",
		tags: tagsSynchronisedStorage,
		generateRoutes: generateRestRoutesSynchronisedStorage
	}
];
