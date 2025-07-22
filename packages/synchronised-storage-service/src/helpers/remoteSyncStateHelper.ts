// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BlobStorageCompressionType,
	type IBlobStorageComponent
} from "@twin.org/blob-storage-models";
import {
	BaseError,
	Converter,
	Is,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@twin.org/core";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import type { ILoggingConnector } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncBatchRequest,
	SynchronisedStorageTopics,
	type ISyncBatchResponse,
	type ISynchronisedEntity,
	type ISyncItemResponse,
	SyncChangeOperation
} from "@twin.org/synchronised-storage-models";
import type { IVerifiableStorageConnector } from "@twin.org/verifiable-storage-models";
import type { ChangeSetHelper } from "./changeSetHelper";
import type { ISyncChange } from "../models/ISyncChange";
import type { ISyncChangeSet } from "../models/ISyncChangeSet";
import type { ISyncPointer } from "../models/ISyncPointer";
import type { ISyncSnapshot } from "../models/ISyncSnapshot";
import type { ISyncState } from "../models/ISyncState";

/**
 * Class for performing entity storage operations in decentralised storage.
 */
export class RemoteSyncStateHelper<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<RemoteSyncStateHelper>();

	/**
	 * The logging connector to use for logging.
	 * @internal
	 */
	private readonly _logging: ILoggingConnector | undefined;

	/**
	 * The event bus component.
	 * @internal
	 */
	private readonly _eventBusComponent: IEventBusComponent;

	/**
	 * The blob storage component to use for remote sync states.
	 * @internal
	 */
	private readonly _blobStorageComponent: IBlobStorageComponent;

	/**
	 * The verifiable storage connector to use for storing sync pointers.
	 * @internal
	 */
	private readonly _verifiableSyncPointerStorageConnector: IVerifiableStorageConnector;

	/**
	 * The change set helper to use for applying changesets.
	 * @internal
	 */
	private readonly _changeSetHelper: ChangeSetHelper<T>;

	/**
	 * The storage ids of the batch responses for each schema type.
	 * @internal
	 */
	private readonly _batchResponseStorageIds: { [schemaType: string]: string[] };

	/**
	 * The full changes for each schema type.
	 * @internal
	 */
	private readonly _populateFullChanges: {
		[schemaType: string]: {
			changes: ISyncChange<T>[];
			entities: { [id: string]: T | undefined };
			requestIds: string[];
			completeCallback: (id?: string) => Promise<void>;
		};
	};

	/**
	 * The synchronised storage key to use for verified storage operations.
	 * @internal
	 */
	private readonly _synchronisedStorageKey: string;

	/**
	 * The identity of the node that is performing the update.
	 * @internal
	 */
	private _nodeIdentity?: string;

	/**
	 * Create a new instance of DecentralisedEntityStorageConnector.
	 * @param logging The logging connector to use for logging.
	 * @param eventBusComponent The event bus component to use for events.
	 * @param blobStorageComponent The blob storage component to use for remote sync states.
	 * @param verifiableSyncPointerStorageConnector The verifiable storage connector to use for storing sync pointers.
	 * @param changeSetHelper The change set helper to use for managing changesets.
	 * @param synchronisedStorageKey The synchronised storage key to use for verified storage operations.
	 */
	constructor(
		logging: ILoggingConnector | undefined,
		eventBusComponent: IEventBusComponent,
		blobStorageComponent: IBlobStorageComponent,
		verifiableSyncPointerStorageConnector: IVerifiableStorageConnector,
		changeSetHelper: ChangeSetHelper<T>,
		synchronisedStorageKey: string
	) {
		this._logging = logging;
		this._eventBusComponent = eventBusComponent;
		this._blobStorageComponent = blobStorageComponent;
		this._verifiableSyncPointerStorageConnector = verifiableSyncPointerStorageConnector;
		this._changeSetHelper = changeSetHelper;
		this._synchronisedStorageKey = synchronisedStorageKey;

		this._batchResponseStorageIds = {};
		this._populateFullChanges = {};

		this._eventBusComponent.subscribe<ISyncBatchResponse<T>>(
			SynchronisedStorageTopics.BatchResponse,
			async response => {
				await this.handleBatchResponse(response.data);
			}
		);

		this._eventBusComponent.subscribe<ISyncItemResponse<T>>(
			SynchronisedStorageTopics.LocalItemResponse,
			async response => {
				await this.handleLocalItemResponse(response.data);
			}
		);
	}

	/**
	 * Set the node identity to use for signing changesets.
	 * @param nodeIdentity The identity of the node that is performing the update.
	 */
	public setNodeIdentity(nodeIdentity: string): void {
		this._nodeIdentity = nodeIdentity;
	}

	/**
	 * Create and store a change set.
	 * @param schemaType The schema type of the change set.
	 * @param changes The changes to apply.
	 * @param completeCallback The callback to call when the changeset is created and stored.
	 * @returns The storage id of the change set if created.
	 */
	public async createAndStoreChangeSet(
		schemaType: string,
		changes: ISyncChange<T>[] | undefined,
		completeCallback: (id?: string) => Promise<void>
	): Promise<void> {
		if (Is.arrayValue(changes)) {
			this._populateFullChanges[schemaType] = {
				changes,
				entities: {},
				requestIds: [],
				completeCallback: async () => this.finaliseFullChanges(schemaType, completeCallback)
			};

			const setChanges = changes.filter(c => c.operation === SyncChangeOperation.Set);
			if (setChanges.length === 0) {
				// If we don't need to request any full details, we can just call the complete callback
				await this.finaliseFullChanges(schemaType, completeCallback);
			} else {
				// Otherwise we need to request the full details for each change
				this._populateFullChanges[schemaType].requestIds = setChanges.map(change => change.id);

				// Once all the requests are handled the callback will be called
				for (const change of setChanges) {
					// Create a request for each change to populate the full details
					this._eventBusComponent.publish<ISyncItemResponse<T>>(
						SynchronisedStorageTopics.LocalItemRequest,
						{
							schemaType,
							id: change.id
						}
					);
				}
			}
		} else {
			await completeCallback();
		}
	}

	/**
	 * Finalise the full details for the sync change set.
	 * @param schemaType The schema type of the change set.
	 * @param completeCallback The callback to call when the changeset is populated.
	 * @returns Nothing.
	 */
	public async finaliseFullChanges(
		schemaType: string,
		completeCallback: (id?: string) => Promise<void>
	): Promise<void> {
		if (Is.stringValue(this._nodeIdentity)) {
			const changes = this._populateFullChanges[schemaType].changes;
			for (const change of changes) {
				change.entity = this._populateFullChanges[schemaType].entities[change.id] ?? change.entity;

				if (change.operation === SyncChangeOperation.Set && Is.objectValue(change.entity)) {
					// Remove the node identity as the changeset has this stored at the top level
					// and we do not want to store it in the change itself to reduce redundancy
					ObjectHelper.propertyDelete(change.entity, "nodeIdentity");
				}
			}

			// Add the changeset to the current snapshot
			const syncChangeSet: ISyncChangeSet<T> = {
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: new Date(Date.now()).toISOString(),
				schemaType,
				changes,
				nodeIdentity: this._nodeIdentity
			};

			// And sign it with the node identity
			syncChangeSet.proof = await this._changeSetHelper.createChangeSetProof(syncChangeSet);

			// Store the changeset in the blob storage
			const changeSetStorageId = await this._changeSetHelper.storeChangeSet(syncChangeSet);
			await completeCallback(changeSetStorageId);
		} else {
			await completeCallback();
		}
	}

	/**
	 * Add a new changeset into the sync state.
	 * @param changeSetStorageId The id of the change set to add the the current state
	 * @returns Nothing.
	 */
	public async addChangeSetToSyncState(changeSetStorageId: string): Promise<void> {
		// First load the current sync state if there is one
		const syncStatePointer = await this.getVerifiableSyncPointer();
		let syncState: ISyncState | undefined;
		if (!Is.empty(syncStatePointer?.syncPointerId)) {
			syncState = await this.getRemoteSyncState(syncStatePointer.syncPointerId);
		}
		// No current sync state, so we create a new one
		if (Is.empty(syncState)) {
			syncState = { snapshots: [] };
		}

		// Sort the snapshots so the newest snapshot is last in the array
		const sortedSnapshots = syncState.snapshots.sort((a, b) =>
			a.dateCreated.localeCompare(b.dateCreated)
		);

		// Get the current snapshot, if it does not exist we create a new one
		let currentSnapshot: ISyncSnapshot | undefined = sortedSnapshots[sortedSnapshots.length - 1];
		if (Is.empty(currentSnapshot)) {
			currentSnapshot = {
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: new Date(Date.now()).toISOString(),
				changeSetStorageIds: []
			};
			syncState.snapshots.push(currentSnapshot);
		} else {
			// Snapshot exists, we update the dateModified
			currentSnapshot.dateModified = new Date(Date.now()).toISOString();
		}

		// Add the changeset storage id to the current snapshot
		currentSnapshot.changeSetStorageIds.push(changeSetStorageId);

		// Store the sync state in the blob storage
		const syncStateId = await this.storeRemoteSyncState(syncState);

		// Store the verifiable sync pointer in the verifiable storage
		await this.storeVerifiableSyncPointer(syncStateId);
	}

	/**
	 * Create a consolidated snapshot for the entire storage.
	 * @param schemaType The schema type of the snapshot to create.
	 * @param batchSize The batch size to use for consolidation.
	 * @returns Nothing.
	 */
	public async consolidateFromLocal(schemaType: string, batchSize: number): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "consolidationStarting"
		});

		await this._eventBusComponent.publish<ISyncBatchRequest>(
			SynchronisedStorageTopics.BatchRequest,
			{ schemaType, batchSize }
		);
	}

	/**
	 * Get the sync pointer.
	 * @returns The sync pointer.
	 */
	public async getVerifiableSyncPointer(): Promise<ISyncPointer | undefined> {
		try {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "verifiableSyncPointerRetrieving",
				data: {
					key: this._synchronisedStorageKey
				}
			});
			const syncPointerStore = await this._verifiableSyncPointerStorageConnector.get(
				this._synchronisedStorageKey,
				{ includeData: true }
			);
			if (Is.uint8Array(syncPointerStore.data)) {
				const syncPointer = ObjectHelper.fromBytes<ISyncPointer>(syncPointerStore.data);
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "verifiableSyncPointerRetrieved",
					data: {
						key: this._synchronisedStorageKey,
						syncPointerId: syncPointer.syncPointerId
					}
				});
				return syncPointer;
			}
		} catch (err) {
			if (!BaseError.someErrorName(err, NotFoundError.CLASS_NAME)) {
				throw err;
			}
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "verifiableSyncPointerNotFound",
			data: {
				key: this._synchronisedStorageKey
			}
		});
	}

	/**
	 * Store the verifiable sync pointer in the verifiable storage.
	 * @param syncStateId The id of the sync state to store.
	 * @returns Nothing.
	 */
	public async storeVerifiableSyncPointer(syncStateId: string): Promise<ISyncPointer> {
		// Create a new verifiable sync pointer object pointing to the sync state
		const verifiableSyncPointer: ISyncPointer = {
			syncPointerId: syncStateId
		};

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "verifiableSyncPointerStoring",
			data: {
				key: this._synchronisedStorageKey,
				syncPointerId: verifiableSyncPointer.syncPointerId
			}
		});

		// Store the verifiable sync pointer in the verifiable storage
		await this._verifiableSyncPointerStorageConnector.create(
			this._synchronisedStorageKey,
			ObjectHelper.toBytes<ISyncPointer>(verifiableSyncPointer)
		);

		return verifiableSyncPointer;
	}

	/**
	 * Store the remote sync state.
	 * @param syncState The sync state to store.
	 * @returns The id of the sync state.
	 */
	public async storeRemoteSyncState(syncState: ISyncState): Promise<string> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "remoteSyncStateStoring",
			data: {
				snapshotCount: syncState.snapshots.length
			}
		});

		// We don't want to encrypt the sync state as no other nodes would be able to read it
		// the blob storage also needs to be publicly accessible so that other nodes can retrieve it
		return this._blobStorageComponent.create(
			Converter.bytesToBase64(ObjectHelper.toBytes<ISyncState>(syncState)),
			undefined,
			undefined,
			undefined,
			{ disableEncryption: true, compress: BlobStorageCompressionType.Gzip }
		);
	}

	/**
	 * Get the remote sync state.
	 * @param syncPointerId The id of the sync pointer to retrieve the state for.
	 * @returns The remote sync state.
	 */
	public async getRemoteSyncState(syncPointerId: string): Promise<ISyncState | undefined> {
		try {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "remoteSyncStateRetrieving",
				data: {
					syncPointerId
				}
			});
			const blobEntry = await this._blobStorageComponent.get(syncPointerId, {
				includeContent: true
			});

			if (Is.stringBase64(blobEntry.blob)) {
				const syncState = ObjectHelper.fromBytes<ISyncState>(
					Converter.base64ToBytes(blobEntry.blob)
				);
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "remoteSyncStateRetrieved",
					data: {
						syncPointerId,
						snapshotCount: syncState.snapshots.length
					}
				});
				return syncState;
			}
		} catch (err) {
			if (!BaseError.someErrorName(err, NotFoundError.CLASS_NAME)) {
				throw err;
			}
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "remoteSyncStateNotFound",
			data: {
				syncPointerId
			}
		});
	}

	/**
	 * Handle the batch response.
	 * @param response The batch response to handle.
	 */
	private async handleBatchResponse(response: ISyncBatchResponse<T>): Promise<void> {
		if (Is.stringValue(this._nodeIdentity)) {
			// Create a new snapshot entry for the current batch
			const syncChangeSet: ISyncChangeSet<T> = {
				id: Converter.bytesToHex(RandomHelper.generate(32)),
				dateCreated: new Date(Date.now()).toISOString(),
				changes: response.entities.map(change => ({
					operation: SyncChangeOperation.Set,
					id: change[response.primaryKey] as string
				})),
				schemaType: response.schemaType,
				nodeIdentity: this._nodeIdentity
			};

			// And sign it with the node identity
			syncChangeSet.proof = await this._changeSetHelper.createChangeSetProof(syncChangeSet);

			// Store the changeset in the blob storage
			const changeSetStorageId = await this._changeSetHelper.storeChangeSet(syncChangeSet);

			// Add the changeset storage id to the snapshot ids
			this._batchResponseStorageIds[response.schemaType] ??= [];
			this._batchResponseStorageIds[response.schemaType].push(changeSetStorageId);

			if (response.lastEntry) {
				const syncState: ISyncState = { snapshots: [] };

				const batchSnapshot: ISyncSnapshot = {
					id: Converter.bytesToHex(RandomHelper.generate(32)),
					dateCreated: new Date(Date.now()).toISOString(),
					changeSetStorageIds: this._batchResponseStorageIds[response.schemaType]
				};
				syncState.snapshots.push(batchSnapshot);

				// Store the sync state in the blob storage
				const syncStateId = await this.storeRemoteSyncState(syncState);

				// Store the verifiable sync pointer in the verifiable storage
				await this.storeVerifiableSyncPointer(syncStateId);

				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "consolidationCompleted"
				});
			}
		}
	}

	/**
	 * Handle the item response.
	 * @param response The item response to handle.
	 */
	private async handleLocalItemResponse(response: ISyncItemResponse<T>): Promise<void> {
		if (!Is.empty(this._populateFullChanges[response.schemaType])) {
			const idx = this._populateFullChanges[response.schemaType].requestIds.indexOf(response.id);

			if (idx !== -1) {
				this._populateFullChanges[response.schemaType].requestIds.splice(idx, 1);
				this._populateFullChanges[response.schemaType].entities[response.id] = response.entity;

				if (this._populateFullChanges[response.schemaType].requestIds.length === 0) {
					await this._populateFullChanges[response.schemaType].completeCallback();
				}
			}
		}
	}
}
