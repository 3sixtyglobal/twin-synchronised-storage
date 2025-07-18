// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
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
	type ISyncItemSet,
	type ISyncRegisterSchemaType,
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
	 * The default interval to check for entity updates, defaults to 5 mins.
	 * @internal
	 */
	private static readonly _DEFAULT_ENTITY_UPDATE_INTERVAL_MS: number = 300000;

	/**
	 * The default interval to perform consolidation, defaults to 60 mins.
	 * @internal
	 */
	private static readonly _DEFAULT_CONSOLIDATION_INTERVAL_MS: number = 3600000;

	/**
	 * The default size of a consolidation batch.
	 * @internal
	 */
	private static readonly _DEFAULT_CONSOLIDATION_BATCH_SIZE: number = 1000;

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
	 * The timer ids for checking for entity updates.
	 * @internal
	 */
	private readonly _entityUpdateTimers: { [schemaType: string]: NodeJS.Timeout };

	/**
	 * The timer ids for consolidation.
	 * @internal
	 */
	private readonly _consolidationTimers: { [schemaType: string]: NodeJS.Timeout };

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

		this._config = {
			synchronisedStorageKey: options.config.synchronisedStorageKey,
			synchronisedStorageMethodId:
				options.config.synchronisedStorageMethodId ?? "synchronised-storage-assertion",
			entityUpdateIntervalMs:
				options.config.entityUpdateIntervalMs ??
				SynchronisedStorageService._DEFAULT_ENTITY_UPDATE_INTERVAL_MS,
			isTrustedNode: options.config.isTrustedNode ?? false,
			consolidationIntervalMs:
				options.config.consolidationIntervalMs ??
				SynchronisedStorageService._DEFAULT_CONSOLIDATION_INTERVAL_MS,
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

		this._consolidationTimers = {};
		this._entityUpdateTimers = {};

		this._eventBusComponent.subscribe<ISyncRegisterSchemaType>(
			SynchronisedStorageTopics.RegisterSchemaType,
			async event => this.registerType(event.data)
		);

		this._eventBusComponent.subscribe<ISyncItemSet<T>>(
			SynchronisedStorageTopics.LocalItemSet,
			async event =>
				this._localSyncStateHelper.addLocalChange(
					event.data.schemaType,
					"set",
					event.data.id,
					event.data.entity
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
		for (const schemaType in this._entityUpdateTimers) {
			clearTimeout(this._entityUpdateTimers[schemaType]);
			delete this._entityUpdateTimers[schemaType];
		}

		for (const schemaType in this._consolidationTimers) {
			clearTimeout(this._consolidationTimers[schemaType]);
			delete this._consolidationTimers[schemaType];
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
			await this._remoteSyncStateHelper.addChangeSetToSyncState(changeSetStorageId);
		}
	}

	/**
	 * Start the sync with further updates after an interval.
	 * @param schemaType The schema type to sync.
	 * @returns Nothing.
	 * @internal
	 */
	private async startEntitySync(schemaType: string): Promise<void> {
		try {
			// First we check for remote changes
			await this.updateFromRemoteSyncState(schemaType);

			// Now send any updates we have to the remote storage
			await this.updateFromLocalSyncState(schemaType);
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "entitySyncFailed",
				error: BaseError.fromError(error)
			});
		} finally {
			// Set a timer to check for updates again
			this._entityUpdateTimers[schemaType] = setTimeout(
				async () => this.startEntitySync(schemaType),
				this._config.entityUpdateIntervalMs
			);
		}
	}

	/**
	 * Check for updates in the remote storage.
	 * @param schemaType The schema type to check for updates.
	 * @returns Nothing.
	 * @internal
	 */
	private async updateFromRemoteSyncState(schemaType: string): Promise<void> {
		// Get the verifiable sync pointer from the verifiable storage
		const verifiableSyncPointer = await this._remoteSyncStateHelper.getVerifiableSyncPointer();

		if (!Is.empty(verifiableSyncPointer)) {
			// Load the sync state from the remote blob storage using the sync pointer
			// to load the sync state
			const remoteSyncState = await this._remoteSyncStateHelper.getRemoteSyncState(
				verifiableSyncPointer.syncPointerId
			);

			// If we got the sync state we can try and sync from it
			if (!Is.undefined(remoteSyncState)) {
				await this._localSyncStateHelper.syncFromRemote(schemaType, remoteSyncState);
			}
		}
	}

	/**
	 * Find any local updates and send them to the remote storage.
	 * @returns Nothing.
	 * @internal
	 */
	private async updateFromLocalSyncState(schemaType: string): Promise<void> {
		if (Is.stringValue(this._nodeIdentity)) {
			// Ge the current local change snapshot
			const localChangeSnapshot =
				await this._localSyncStateHelper.getLocalChangeSnapshot(schemaType);

			if (!Is.empty(localChangeSnapshot)) {
				const changeSetStorageId = await this._remoteSyncStateHelper.createAndStoreChangeSet(
					schemaType,
					localChangeSnapshot.localChanges
				);

				if (Is.stringValue(changeSetStorageId)) {
					// Send the local changes to the remote storage if we are a trusted node
					if (this._config.isTrustedNode) {
						await this._remoteSyncStateHelper.addChangeSetToSyncState(changeSetStorageId);
					} else if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
						// If we are not a trusted node, we need to send the changes to the trusted node
						await this._trustedSynchronisedStorageComponent.syncChangeSet(changeSetStorageId);
					}

					await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
				}
			}
		}
	}

	/**
	 * Start the consolidation sync.
	 * @param schemaType The schema type to consolidate.
	 * @returns Nothing.
	 * @internal
	 */
	private async startConsolidationSync(schemaType: string): Promise<void> {
		let localChangeSnapshot: SyncSnapshotEntry<T> | undefined;
		try {
			// If we are performing a consolidation, we can remove the local changes
			await this._localSyncStateHelper.getLocalChangeSnapshot(schemaType);
			if (!Is.empty(localChangeSnapshot)) {
				await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
			}

			if (Is.stringValue(this._nodeIdentity)) {
				await this._remoteSyncStateHelper.consolidateFromLocal(
					schemaType,
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
		} finally {
			// Set a timer to perform the consolidation again
			this._consolidationTimers[schemaType] = setTimeout(
				async () => this.startConsolidationSync(schemaType),
				this._config.consolidationIntervalMs
			);
		}
	}

	/**
	 * Register a new sync type.
	 * @param syncRegisterType The sync register type to register.
	 * @internal
	 */
	private async registerType(syncRegisterType: ISyncRegisterSchemaType): Promise<void> {
		if (this._config.entityUpdateIntervalMs > 0) {
			await this.startEntitySync(syncRegisterType.schemaType);
		}

		if (this._config.isTrustedNode && this._config.consolidationIntervalMs > 0) {
			await this.startConsolidationSync(syncRegisterType.schemaType);
		}
	}
}
