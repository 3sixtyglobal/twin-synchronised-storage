// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DataTypeHelper } from "@3sixty/data-core";
import * as CompiledValidators from "../compiled/validators.js";
import { SynchronisedStorageContexts } from "../models/synchronisedStorageContexts.js";
import { SynchronisedStorageTypes } from "../models/synchronisedStorageTypes.js";
import SyncChangeSchema from "../schemas/SyncChange.json" with { type: "json" };
import SyncChangeOperationSchema from "../schemas/SyncChangeOperation.json" with { type: "json" };
import SyncChangeSetSchema from "../schemas/SyncChangeSet.json" with { type: "json" };
import SynchronisedEntitySchema from "../schemas/SynchronisedEntity.json" with { type: "json" };
import SynchronisedEntityCoreSchema from "../schemas/SynchronisedEntityCore.json" with { type: "json" };
import SyncRequestSchema from "../schemas/SyncRequest.json" with { type: "json" };

/**
 * Handle all the data types for synchronised storage.
 */
export class SynchronisedStorageDataTypes {
	/**
	 * Register all the data types.
	 */
	public static registerTypes(): void {
		const types = [
			{
				type: SynchronisedStorageTypes.SyncRequest,
				schema: SyncRequestSchema,
				compiledValidator: CompiledValidators.CompiledSyncRequest
			},
			{
				type: SynchronisedStorageTypes.SyncChangeSet,
				schema: SyncChangeSetSchema,
				compiledValidator: CompiledValidators.CompiledSyncChangeSet
			},
			{
				type: SynchronisedStorageTypes.SyncChange,
				schema: SyncChangeSchema,
				compiledValidator: CompiledValidators.CompiledSyncChange
			},
			{
				type: SynchronisedStorageTypes.SyncChangeOperation,
				schema: SyncChangeOperationSchema,
				compiledValidator: CompiledValidators.CompiledSyncChangeOperation
			},
			{
				type: SynchronisedStorageTypes.SynchronisedEntity,
				schema: SynchronisedEntitySchema,
				compiledValidator: CompiledValidators.CompiledSynchronisedEntity
			},
			{
				type: SynchronisedStorageTypes.SynchronisedEntityCore,
				schema: SynchronisedEntityCoreSchema,
				compiledValidator: CompiledValidators.CompiledSynchronisedEntityCore
			}
		];

		DataTypeHelper.registerTypes(
			SynchronisedStorageContexts.Namespace,
			SynchronisedStorageContexts.JsonLdContext,
			types
		);
	}
}
