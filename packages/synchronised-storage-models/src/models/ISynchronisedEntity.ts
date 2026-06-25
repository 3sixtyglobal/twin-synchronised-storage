// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISynchronisedEntityCore } from "./ISynchronisedEntityCore.js";

/**
 * The base definition for synchronised entries.
 */
export interface ISynchronisedEntity extends ISynchronisedEntityCore {
	/**
	 * The id of the entry.
	 */
	id: string;

	/**
	 * The identity of the node that owns the entry.
	 * @json-ld namespace:twin-common
	 */
	nodeIdentity: string;
}
