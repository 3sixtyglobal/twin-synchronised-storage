// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@3sixty/entity";
import { nameof } from "@3sixty/nameof";
import { SyncSnapshotEntry } from "./entities/syncSnapshotEntry.js";

/**
 * Initialize the schema for the synchronised service.
 */
export function initSchema(): void {
	EntitySchemaFactory.register(nameof<SyncSnapshotEntry>(), () =>
		EntitySchemaHelper.getSchema(SyncSnapshotEntry)
	);
}
