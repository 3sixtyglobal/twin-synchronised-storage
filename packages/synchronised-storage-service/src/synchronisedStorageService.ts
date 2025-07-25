// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITaskSchedulerComponent } from "@twin.org/background-task-models";
import type { IBlobStorageComponent } from "@twin.org/blob-storage-models";
import { BaseError, ComponentFactory, GeneralError, Guards, Is } from "@twin.org/core";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import { IdentityConnectorFactory, type IIdentityConnector } from "@twin.org/identity-models";
import { type ILoggingConnector, LoggingConnectorFactory } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncItemChange,
	type ISyncRegisterStorageKey,
	SynchronisedStorageTopics,
	type ISynchronisedEntity,
	type ISynchronisedStorageComponent
} from "@twin.org/synchronised-storage-models";
import {
	type IVerifiableStorageConnector,
	VerifiableStorageConnectorFactory
} from "@twin.org/verifiable-storage-models";
import type { SyncSnapshotEntry } from "./entities/syncSnapshotEntry";
import { ChangeSetHelper } from "./helpers/changeSetHelper";
import { LocalSyncStateHelper } from "./helpers/localSyncStateHelper";
import { RemoteSyncStateHelper } from "./helpers/remoteSyncStateHelper";
import type { ISynchronisedStorageServiceConfig } from "./models/ISynchronisedStorageServiceConfig";
import type { ISynchronisedStorageServiceConstructorOptions } from "./models/ISynchronisedStorageServiceConstructorOptions";

/**
 * Class for performing synchronised storage operations.
 */
export class SynchronisedStorageService<T extends ISynchronisedEntity = ISynchronisedEntity>
	implements ISynchronisedStorageComponent
{
	/**
	 * The default interval to check for entity updates.
	 * @internal
	 */
	private static readonly _DEFAULT_ENTITY_UPDATE_INTERVAL_MINUTES: number = 5;

	/**
	 * The default interval to perform consolidation.
	 * @internal
	 */
	private static readonly _DEFAULT_CONSOLIDATION_INTERVAL_MINUTES: number = 60;

	/**
	 * The default size of a consolidation batch.
	 * @internal
	 */
	private static readonly _DEFAULT_CONSOLIDATION_BATCH_SIZE: number = 100;

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<SynchronisedStorageService>();

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
	 * The storage connector for the sync snapshot entries.
	 * @internal
	 */
	private readonly _localSyncSnapshotEntryEntityStorage: IEntityStorageConnector<
		SyncSnapshotEntry<T>
	>;

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
	 * The identity connector to use for signing/verifying changesets.
	 * @internal
	 */
	private readonly _identityConnector: IIdentityConnector;

	/**
	 * The task scheduler component.
	 * @internal
	 */
	private readonly _taskSchedulerComponent: ITaskSchedulerComponent;

	/**
	 * The synchronised storage service to use when this is not a trusted node.
	 * @internal
	 */
	private readonly _trustedSynchronisedStorageComponent?: ISynchronisedStorageComponent;

	/**
	 * The change set helper.
	 * @internal
	 */
	private readonly _changeSetHelper: ChangeSetHelper<T>;

	/**
	 * The local sync state helper to use for applying changesets.
	 * @internal
	 */
	private readonly _localSyncStateHelper: LocalSyncStateHelper<T>;

	/**
	 * The remote sync state helper to use for applying changesets.
	 * @internal
	 */
	private readonly _remoteSyncStateHelper: RemoteSyncStateHelper<T>;

	/**
	 * The options for the connector.
	 * @internal
	 */
	private readonly _config: Required<ISynchronisedStorageServiceConfig>;

	/**
	 * The flag to determine if the service has been started.
	 * @internal
	 */
	private _serviceStarted: boolean;

	/**
	 * The active storage keys for the synchronised storage service.
	 * @internal
	 */
	private readonly _activeStorageKeys: { [storageKey: string]: boolean };

	/**
	 * The identity of the node this connector is running on.
	 * @internal
	 */
	private _nodeIdentity?: string;

	/**
	 * Create a new instance of SynchronisedStorageService.
	 * @param options The options for the service.
	 */
	constructor(options: ISynchronisedStorageServiceConstructorOptions) {
		Guards.object<ISynchronisedStorageServiceConstructorOptions>(
			this.CLASS_NAME,
			nameof(options),
			options
		);
		Guards.object<ISynchronisedStorageServiceConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);

		this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType ?? "event-bus");
		this._logging = LoggingConnectorFactory.getIfExists(options.loggingConnectorType ?? "logging");

		this._localSyncSnapshotEntryEntityStorage = EntityStorageConnectorFactory.get<
			IEntityStorageConnector<SyncSnapshotEntry<T>>
		>(options.syncSnapshotStorageConnectorType ?? "sync-snapshot-entry");

		this._verifiableSyncPointerStorageConnector = VerifiableStorageConnectorFactory.get(
			options.verifiableStorageConnectorType ?? "verifiable-storage"
		);

		this._blobStorageComponent = ComponentFactory.get(
			options.blobStorageComponentType ?? "blob-storage"
		);

		this._identityConnector = IdentityConnectorFactory.get(
			options.identityConnectorType ?? "identity"
		);

		this._taskSchedulerComponent = ComponentFactory.get(
			options.taskSchedulerComponentType ?? "task-scheduler"
		);

		this._config = {
			synchronisedStorageKey: options.config.synchronisedStorageKey,
			synchronisedStorageMethodId:
				options.config.synchronisedStorageMethodId ?? "synchronised-storage-assertion",
			entityUpdateIntervalMinutes:
				options.config.entityUpdateIntervalMinutes ??
				SynchronisedStorageService._DEFAULT_ENTITY_UPDATE_INTERVAL_MINUTES,
			isTrustedNode: options.config.isTrustedNode ?? false,
			consolidationIntervalMinutes:
				options.config.consolidationIntervalMinutes ??
				SynchronisedStorageService._DEFAULT_CONSOLIDATION_INTERVAL_MINUTES,
			consolidationBatchSize:
				options.config.consolidationBatchSize ??
				SynchronisedStorageService._DEFAULT_CONSOLIDATION_BATCH_SIZE
		};

		// If this is not a trusted node, we need to use a synchronised storage service
		// to synchronise with a trusted node.
		if (!this._config.isTrustedNode) {
			Guards.stringValue(
				this.CLASS_NAME,
				nameof(options.trustedSynchronisedStorageComponentType),
				options.trustedSynchronisedStorageComponentType
			);
			this._trustedSynchronisedStorageComponent =
				ComponentFactory.get<ISynchronisedStorageComponent>(
					options.trustedSynchronisedStorageComponentType
				);
		}

		this._changeSetHelper = new ChangeSetHelper<T>(
			this._logging,
			this._eventBusComponent,
			this._blobStorageComponent,
			this._identityConnector,
			this._config.synchronisedStorageMethodId
		);

		this._localSyncStateHelper = new LocalSyncStateHelper<T>(
			this._logging,
			this._localSyncSnapshotEntryEntityStorage,
			this._changeSetHelper
		);

		this._remoteSyncStateHelper = new RemoteSyncStateHelper<T>(
			this._logging,
			this._eventBusComponent,
			this._blobStorageComponent,
			this._verifiableSyncPointerStorageConnector,
			this._changeSetHelper,
			this._config.synchronisedStorageKey
		);

		this._serviceStarted = false;
		this._activeStorageKeys = {};

		this._eventBusComponent.subscribe<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			async event => this.registerType(event.data)
		);

		this._eventBusComponent.subscribe<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			async event =>
				this._localSyncStateHelper.addLocalChange(
					event.data.storageKey,
					event.data.operation,
					event.data.id
				)
		);
	}

	/**
	 * The component needs to be started when the node is initialized.
	 * @param nodeIdentity The identity of the node starting the component.
	 * @param nodeLoggingConnectorType The node logging connector type, defaults to "node-logging".
	 * @param componentState A persistent state which can be modified by the method.
	 * @returns Nothing.
	 */
	public async start(
		nodeIdentity: string,
		nodeLoggingConnectorType: string | undefined,
		componentState?: {
			[id: string]: unknown;
		}
	): Promise<void> {
		this._nodeIdentity = nodeIdentity;
		this._remoteSyncStateHelper.setNodeIdentity(nodeIdentity);
		this._serviceStarted = true;

		// If there are already storage keys registered, we need to activate them
		for (const storageKey in this._activeStorageKeys) {
			await this.activateStorageKey(storageKey);
		}
	}

	/**
	 * The component needs to be stopped when the node is closed.
	 * @param nodeIdentity The identity of the node stopping the component.
	 * @param nodeLoggingConnectorType The node logging connector type, defaults to "node-logging".
	 * @param componentState A persistent state which can be modified by the method.
	 * @returns Nothing.
	 */
	public async stop(
		nodeIdentity: string,
		nodeLoggingConnectorType: string | undefined,
		componentState?: { [id: string]: unknown }
	): Promise<void> {
		for (const storageKey in this._activeStorageKeys) {
			this._activeStorageKeys[storageKey] = false;
			this._taskSchedulerComponent.removeTask(`synchronised-storage-update-${storageKey}`);
			this._taskSchedulerComponent.removeTask(`synchronised-storage-consolidation-${storageKey}`);
		}
	}

	/**
	 * Synchronise a complete set of changes, assumes this is a trusted node.
	 * @param changeSetStorageId The id of the change set to synchronise in blob storage.
	 * @returns Nothing.
	 */
	public async syncChangeSet(changeSetStorageId: string): Promise<void> {
		if (!this._config.isTrustedNode) {
			throw new GeneralError(this.CLASS_NAME, "notTrustedNode");
		}

		// This method is called by non trusted nodes to synchronise changes
		Guards.stringValue(this.CLASS_NAME, nameof(changeSetStorageId), changeSetStorageId);

		// TODO: The change set has a proof signed by the originating node identity
		// The proof is verified that the change set is valid and has not been tampered with.
		// but we also need to check that the originating node has permissions
		// to store the change set in the synchronised storage.
		// This will be performed using rights-management

		const changeSet = await this._changeSetHelper.getAndApplyChangeset(changeSetStorageId);

		if (!Is.empty(changeSet)) {
			await this._remoteSyncStateHelper.addChangeSetToSyncState(
				changeSet.storageKey,
				changeSetStorageId
			);
		}
	}

	/**
	 * Start the sync with further updates after an interval.
	 * @param storageKey The storage key to sync.
	 * @returns Nothing.
	 * @internal
	 */
	private async startEntitySync(storageKey: string): Promise<void> {
		try {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "startEntitySync",
				data: {
					storageKey
				}
			});

			// First we check for remote changes
			await this.updateFromRemoteSyncState(storageKey);

			// Now send any updates we have to the remote storage
			await this.updateFromLocalSyncState(storageKey);
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "entitySyncFailed",
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Check for updates in the remote storage.
	 * @param storageKey The storage key to check for updates.
	 * @returns Nothing.
	 * @internal
	 */
	private async updateFromRemoteSyncState(storageKey: string): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "updateFromRemoteSyncState",
			data: {
				storageKey
			}
		});

		// Get the verifiable sync pointer store from the verifiable storage
		const verifiableSyncPointerStore =
			await this._remoteSyncStateHelper.getVerifiableSyncPointerStore();

		if (!Is.empty(verifiableSyncPointerStore.syncPointers[storageKey])) {
			// Load the sync state from the remote blob storage using the sync pointer
			// to load the sync state
			const remoteSyncState = await this._remoteSyncStateHelper.getRemoteSyncState(
				verifiableSyncPointerStore.syncPointers[storageKey]
			);

			// If we got the sync state we can try and sync from it
			if (!Is.undefined(remoteSyncState)) {
				await this._localSyncStateHelper.syncFromRemote(storageKey, remoteSyncState);
			}
		}
	}

	/**
	 * Find any local updates and send them to the remote storage.
	 * @returns Nothing.
	 * @internal
	 */
	private async updateFromLocalSyncState(storageKey: string): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "updateFromLocalSyncState",
			data: {
				storageKey
			}
		});

		const localChangeSnapshot = await this._localSyncStateHelper.getLocalChangeSnapshot(storageKey);

		if (Is.arrayValue(localChangeSnapshot.changes)) {
			await this._remoteSyncStateHelper.createAndStoreChangeSet(
				storageKey,
				localChangeSnapshot.changes,
				async changeSetStorageId => {
					if (Is.stringValue(changeSetStorageId)) {
						await this._logging?.log({
							level: "info",
							source: this.CLASS_NAME,
							message: "createdStorageChangeSet",
							data: {
								storageKey,
								changeSetStorageId
							}
						});
						// Send the local changes to the remote storage if we are a trusted node
						if (this._config.isTrustedNode) {
							await this._remoteSyncStateHelper.addChangeSetToSyncState(
								storageKey,
								changeSetStorageId
							);
							await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
						} else if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
							// If we are not a trusted node, we need to send the changes to the trusted node
							await this._trustedSynchronisedStorageComponent.syncChangeSet(changeSetStorageId);
							await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
						}
					} else {
						await this._logging?.log({
							level: "info",
							source: this.CLASS_NAME,
							message: "createdStorageChangeSetNone",
							data: {
								storageKey
							}
						});
					}
				}
			);
		} else {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "updateFromLocalSyncStateNoChanges",
				data: {
					storageKey
				}
			});
		}
	}

	/**
	 * Start the consolidation sync.
	 * @param storageKey The storage key to consolidate.
	 * @returns Nothing.
	 * @internal
	 */
	private async startConsolidationSync(storageKey: string): Promise<void> {
		let localChangeSnapshot: SyncSnapshotEntry<T> | undefined;
		try {
			// If we are performing a consolidation, we can remove the local changes
			await this._localSyncStateHelper.getLocalChangeSnapshot(storageKey);
			if (!Is.empty(localChangeSnapshot)) {
				await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
			}

			if (Is.stringValue(this._nodeIdentity)) {
				await this._remoteSyncStateHelper.consolidateFromLocal(
					storageKey,
					this._config.consolidationBatchSize ??
						SynchronisedStorageService._DEFAULT_CONSOLIDATION_BATCH_SIZE
				);

				// The consolidation was successful, so we can remove the local change snapshot permanently
				localChangeSnapshot = undefined;
			}
		} catch (error) {
			if (localChangeSnapshot) {
				// If the consolidation failed, we can keep the local change snapshot
				await this._localSyncStateHelper.setLocalChangeSnapshot(localChangeSnapshot);
			}
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "consolidationSyncFailed",
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Register a new sync type.
	 * @param syncRegisterType The sync register type to register.
	 * @internal
	 */
	private async registerType(syncRegisterType: ISyncRegisterStorageKey): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "registerType",
			data: {
				storageKey: syncRegisterType.storageKey
			}
		});

		if (Is.empty(this._activeStorageKeys[syncRegisterType.storageKey])) {
			this._activeStorageKeys[syncRegisterType.storageKey] = false;

			if (this._serviceStarted) {
				await this.activateStorageKey(syncRegisterType.storageKey);
			}
		}
	}

	/**
	 * Activate a storage key.
	 * @param storageKey The storage key to activate.
	 * @internal
	 */
	private async activateStorageKey(storageKey: string): Promise<void> {
		if (!Is.empty(this._activeStorageKeys[storageKey]) && !this._activeStorageKeys[storageKey]) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "activateType",
				data: {
					storageKey
				}
			});

			this._activeStorageKeys[storageKey] = true;

			if (this._config.entityUpdateIntervalMinutes > 0) {
				await this._taskSchedulerComponent.addTask(
					`synchronised-storage-update-${storageKey}`,
					[
						{
							nextTriggerTime: Date.now(),
							intervalMinutes: this._config.entityUpdateIntervalMinutes
						}
					],
					async () => this.startEntitySync(storageKey)
				);
			}

			if (this._config.isTrustedNode && this._config.consolidationIntervalMinutes > 0) {
				await this._taskSchedulerComponent.addTask(
					`synchronised-storage-consolidation-${storageKey}`,
					[
						{
							nextTriggerTime: Date.now(),
							intervalMinutes: this._config.consolidationIntervalMinutes
						}
					],
					async () => this.startConsolidationSync(storageKey)
				);
			}
		}
	}
}
