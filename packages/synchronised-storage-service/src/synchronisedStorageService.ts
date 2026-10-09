// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITaskSchedulerComponent } from "@3sixty/background-task-models";
import {
	BlobStorageConnectorFactory,
	type IBlobStorageConnector
} from "@3sixty/blob-storage-models";
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from "@3sixty/context";
import {
	BaseError,
	ComponentFactory,
	Converter,
	GeneralError,
	Guards,
	Is,
	UnauthorizedError
} from "@3sixty/core";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IEventBusComponent } from "@3sixty/event-bus-models";
import type { ILoggingComponent } from "@3sixty/logging-models";
import { nameof } from "@3sixty/nameof";
import {
	type ISyncChangeSet,
	type ISynchronisedStorageComponent,
	type ISyncItemChange,
	type ISyncRegisterStorageKey,
	SynchronisedStorageDataTypes,
	SynchronisedStorageTopics
} from "@3sixty/synchronised-storage-models";
import { type ITrustComponent, TrustHelper } from "@3sixty/trust-models";
import { type IVaultConnector, VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import {
	type IVerifiableStorageConnector,
	VerifiableStorageConnectorFactory
} from "@3sixty/verifiable-storage-models";
import verifiableStorageKeys from "./data/verifiableStorageKeys.json" with { type: "json" };
import type { SyncSnapshotEntry } from "./entities/syncSnapshotEntry.js";
import { BlobStorageHelper } from "./helpers/blobStorageHelper.js";
import { ChangeSetHelper } from "./helpers/changeSetHelper.js";
import { LocalSyncStateHelper } from "./helpers/localSyncStateHelper.js";
import { RemoteSyncStateHelper } from "./helpers/remoteSyncStateHelper.js";
import type { ISynchronisedStorageServiceConfig } from "./models/ISynchronisedStorageServiceConfig.js";
import type { ISynchronisedStorageServiceConstructorOptions } from "./models/ISynchronisedStorageServiceConstructorOptions.js";

/**
 * Class for performing synchronised storage operations.
 */
export class SynchronisedStorageService implements ISynchronisedStorageComponent {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<SynchronisedStorageService>();

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
	 * The default max number of consolidations to keep in storage.
	 * @internal
	 */
	private static readonly _DEFAULT_MAX_CONSOLIDATIONS: number = 5;

	/**
	 * The logging component to use for logging.
	 * @internal
	 */
	private readonly _logging?: ILoggingComponent;

	/**
	 * The event bus component.
	 * @internal
	 */
	private readonly _eventBusComponent: IEventBusComponent;

	/**
	 * The vault connector.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The storage connector for the sync snapshot entries.
	 * @internal
	 */
	private readonly _localSyncSnapshotEntryEntityStorage: IEntityStorageConnector<SyncSnapshotEntry>;

	/**
	 * The blob storage connector to use for remote sync states.
	 * @internal
	 */
	private readonly _blobStorageConnector: IBlobStorageConnector;

	/**
	 * The verifiable storage connector to use for storing sync pointers.
	 * @internal
	 */
	private readonly _verifiableSyncPointerStorageConnector: IVerifiableStorageConnector;

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
	 * The blob storage helper.
	 * @internal
	 */
	private readonly _blobStorageHelper: BlobStorageHelper;

	/**
	 * The trust component.
	 * @internal
	 */
	private readonly _trustComponent: ITrustComponent;

	/**
	 * The change set helper.
	 * @internal
	 */
	private readonly _changeSetHelper: ChangeSetHelper;

	/**
	 * The local sync state helper to use for applying changesets.
	 * @internal
	 */
	private readonly _localSyncStateHelper: LocalSyncStateHelper;

	/**
	 * The remote sync state helper to use for applying changesets.
	 * @internal
	 */
	private readonly _remoteSyncStateHelper: RemoteSyncStateHelper;

	/**
	 * The options for the connector.
	 * @internal
	 */
	private readonly _config: Required<ISynchronisedStorageServiceConfig>;

	/**
	 * The synchronised storage key to use for the remote synchronised storage.
	 * @internal
	 */
	private readonly _synchronisedStorageKey: string;

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
	private _nodeId?: string;

	/**
	 * Create a new instance of SynchronisedStorageService.
	 * @param options The options for the service.
	 */
	constructor(options: ISynchronisedStorageServiceConstructorOptions) {
		Guards.object<ISynchronisedStorageServiceConstructorOptions>(
			SynchronisedStorageService.CLASS_NAME,
			nameof(options),
			options
		);
		Guards.object<ISynchronisedStorageServiceConfig>(
			SynchronisedStorageService.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.stringValue(
			SynchronisedStorageService.CLASS_NAME,
			nameof(options.config.verifiableStorageKeyId),
			options.config.verifiableStorageKeyId
		);

		this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType ?? "event-bus");
		this._logging = ComponentFactory.getIfExists(options.loggingComponentType);
		this._vaultConnector = VaultConnectorFactory.get(options.vaultConnectorType ?? "vault");

		this._localSyncSnapshotEntryEntityStorage = EntityStorageConnectorFactory.get<
			IEntityStorageConnector<SyncSnapshotEntry>
		>(options.syncSnapshotStorageConnectorType ?? "sync-snapshot-entry");

		this._verifiableSyncPointerStorageConnector = VerifiableStorageConnectorFactory.get(
			options.verifiableStorageConnectorType ?? "verifiable-storage"
		);

		this._blobStorageConnector = BlobStorageConnectorFactory.get(
			options.blobStorageConnectorType ?? "blob-storage"
		);

		this._taskSchedulerComponent = ComponentFactory.get(
			options.taskSchedulerComponentType ?? "task-scheduler"
		);

		this._trustComponent = ComponentFactory.get<ITrustComponent>(
			options?.trustComponentType ?? "trust"
		);

		// If this is empty we assume the local node has the rights to write to the verifiable storage.
		let isTrustedNode = true;
		if (!Is.empty(options.trustedSynchronisedStorageComponentType)) {
			isTrustedNode = false;

			// If it is set then we used the trusted component to send changesets to
			this._trustedSynchronisedStorageComponent =
				ComponentFactory.get<ISynchronisedStorageComponent>(
					options.trustedSynchronisedStorageComponentType
				);
		}

		this._config = {
			entityUpdateIntervalMinutes:
				options.config.entityUpdateIntervalMinutes ??
				SynchronisedStorageService._DEFAULT_ENTITY_UPDATE_INTERVAL_MINUTES,
			consolidationIntervalMinutes:
				options.config.consolidationIntervalMinutes ??
				SynchronisedStorageService._DEFAULT_CONSOLIDATION_INTERVAL_MINUTES,
			consolidationBatchSize:
				options.config.consolidationBatchSize ??
				SynchronisedStorageService._DEFAULT_CONSOLIDATION_BATCH_SIZE,
			maxConsolidations:
				options.config.maxConsolidations ?? SynchronisedStorageService._DEFAULT_MAX_CONSOLIDATIONS,
			blobStorageEncryptionKeyId:
				options.config.blobStorageEncryptionKeyId ?? "synchronised-storage-blob-encryption-key",
			verifiableStorageKeyId: options.config.verifiableStorageKeyId,
			overrideTrustGeneratorType: options.config.overrideTrustGeneratorType ?? ""
		};

		this._synchronisedStorageKey =
			verifiableStorageKeys[
				options.config.verifiableStorageKeyId as keyof typeof verifiableStorageKeys
			] ?? options.config.verifiableStorageKeyId;

		Guards.stringValue(
			SynchronisedStorageService.CLASS_NAME,
			"synchronisedStorageKey",
			this._synchronisedStorageKey
		);

		this._blobStorageHelper = new BlobStorageHelper(
			this._logging,
			this._vaultConnector,
			this._blobStorageConnector,
			this._config.blobStorageEncryptionKeyId,
			isTrustedNode
		);

		this._changeSetHelper = new ChangeSetHelper(
			this._logging,
			this._eventBusComponent,
			this._blobStorageHelper
		);

		this._localSyncStateHelper = new LocalSyncStateHelper(
			this._logging,
			this._localSyncSnapshotEntryEntityStorage,
			this._changeSetHelper
		);

		this._remoteSyncStateHelper = new RemoteSyncStateHelper(
			this._logging,
			this._eventBusComponent,
			this._verifiableSyncPointerStorageConnector,
			this._blobStorageHelper,
			this._changeSetHelper,
			isTrustedNode,
			this._config.maxConsolidations
		);

		this._serviceStarted = false;
		this._activeStorageKeys = {};

		SynchronisedStorageDataTypes.registerTypes();
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return SynchronisedStorageService.CLASS_NAME;
	}

	/**
	 * The component needs to be started when the node is initialized.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns A promise that resolves when the service is started and all event bus subscriptions are active.
	 */
	public async start(nodeLoggingComponentType?: string): Promise<void> {
		const contextIds = await ContextIdStore.getContextIds();
		ContextIdHelper.guard(contextIds, ContextIdKeys.Node);
		this._nodeId = contextIds[ContextIdKeys.Node];

		this._remoteSyncStateHelper.setNodeId(this._nodeId);
		this._changeSetHelper.setNodeId(this._nodeId);
		this._blobStorageHelper.setNodeId(this._nodeId);

		this._remoteSyncStateHelper.setSynchronisedStorageKey(this._synchronisedStorageKey);
		this._serviceStarted = true;

		// If this is not a trusted node we need to request the decryption key from a trusted node
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			const trustPayload = await this._trustComponent.generate(
				this._nodeId,
				this._config.overrideTrustGeneratorType.length > 0
					? this._config.overrideTrustGeneratorType
					: undefined
			);

			const decryptionKey =
				await this._trustedSynchronisedStorageComponent.getDecryptionKey(trustPayload);

			const blobStorageEncryptionKeyId = `${this._nodeId}/${this._config.blobStorageEncryptionKeyId}`;

			// If the key exists remove it and get a new one, in case the key has been rotated
			const existingKey = await this._vaultConnector.getKey(blobStorageEncryptionKeyId);

			if (!Is.empty(existingKey)) {
				await this._vaultConnector.removeKey(blobStorageEncryptionKeyId);
			}

			await this._vaultConnector.addKey(
				blobStorageEncryptionKeyId,
				VaultKeyType.ChaCha20Poly1305,
				Converter.base64ToBytes(decryptionKey)
			);
		}

		await this._eventBusComponent.subscribe<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			async event => this.registerStorageKey(event.data)
		);

		await this._eventBusComponent.subscribe<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			async event => {
				// Make sure the change event is from this node
				if (Is.stringValue(this._nodeId) && this._nodeId === event.data.nodeId) {
					await this._localSyncStateHelper.addLocalChange(
						event.data.storageKey,
						event.data.operation,
						event.data.id
					);
				}
			}
		);

		await this._remoteSyncStateHelper.start();

		// If there are already storage keys registered, we need to activate them
		for (const storageKey in this._activeStorageKeys) {
			await this.activateStorageKey(storageKey);
		}
	}

	/**
	 * The component needs to be stopped when the node is closed.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns A promise that resolves when all scheduled tasks are removed and storage keys are deactivated.
	 */
	public async stop(nodeLoggingComponentType?: string): Promise<void> {
		for (const storageKey in this._activeStorageKeys) {
			this._activeStorageKeys[storageKey] = false;
			await this._taskSchedulerComponent.removeTask(`synchronised-storage-update-${storageKey}`);
			await this._taskSchedulerComponent.removeTask(
				`synchronised-storage-consolidation-${storageKey}`
			);
		}
	}

	/**
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns The decryption key.
	 */
	public async getDecryptionKey(trustPayload: unknown): Promise<string> {
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			throw new GeneralError(SynchronisedStorageService.CLASS_NAME, "notTrustedNode");
		}

		const trustInfo = await TrustHelper.verifyTrust(
			this._trustComponent,
			trustPayload,
			"getDecryptionKey"
		);

		await this._logging?.log({
			level: "info",
			source: SynchronisedStorageService.CLASS_NAME,
			message: "decryptionKeyRequest",
			data: {
				nodeId: trustInfo.identity
			}
		});

		const blobStorageEncryptionKeyId = `${this._nodeId}/${this._config.blobStorageEncryptionKeyId}`;
		const key = await this._vaultConnector.getKey(blobStorageEncryptionKeyId);
		if (Is.undefined(key.privateKey)) {
			throw new UnauthorizedError(SynchronisedStorageService.CLASS_NAME, "decryptionKeyNotFound");
		}

		return Converter.bytesToBase64(key.privateKey);
	}

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @param trustPayload Trust payload to verify the requesters identity.
	 * @returns A promise that resolves when the change set has been applied and the sync state updated.
	 */
	public async syncChangeSet(syncChangeSet: ISyncChangeSet, trustPayload: unknown): Promise<void> {
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			throw new GeneralError(SynchronisedStorageService.CLASS_NAME, "notTrustedNode");
		}

		Guards.object<ISyncChangeSet>(
			SynchronisedStorageService.CLASS_NAME,
			nameof(syncChangeSet),
			syncChangeSet
		);
		const trustInfo = await TrustHelper.verifyTrust(
			this._trustComponent,
			trustPayload,
			"syncChangeSet"
		);

		await this._logging?.log({
			level: "info",
			source: SynchronisedStorageService.CLASS_NAME,
			message: "syncChangeSetForRemoteNode",
			data: {
				changeSetStorageId: syncChangeSet.id,
				nodeId: trustInfo.identity
			}
		});

		const copy = await this._changeSetHelper.copyChangeset(syncChangeSet);

		if (!Is.empty(copy)) {
			// Apply the changes to this node
			await this._changeSetHelper.applyChangeset(copy.syncChangeSet);

			// And update the sync state with the latest changes
			await this._remoteSyncStateHelper.addChangeSetToSyncState(
				copy.syncChangeSet.storageKey,
				copy.changeSetStorageId
			);
		}
	}

	/**
	 * Start the sync with further updates after an interval.
	 * @param storageKey The storage key to sync.
	 * @returns A promise that resolves when the remote and local sync passes are complete.
	 * @internal
	 */
	private async startEntitySync(storageKey: string): Promise<void> {
		try {
			await this._logging?.log({
				level: "info",
				source: SynchronisedStorageService.CLASS_NAME,
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
				source: SynchronisedStorageService.CLASS_NAME,
				message: "entitySyncFailed",
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Check for updates in the remote storage.
	 * @param storageKey The storage key to check for updates.
	 * @returns A promise that resolves when the local state has been updated from the remote sync state.
	 * @internal
	 */
	private async updateFromRemoteSyncState(storageKey: string): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: SynchronisedStorageService.CLASS_NAME,
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
			const remoteSyncState = await this._remoteSyncStateHelper.getSyncState(
				verifiableSyncPointerStore.syncPointers[storageKey]
			);

			// If we got the sync state we can try and sync from it
			if (!Is.undefined(remoteSyncState)) {
				await this._localSyncStateHelper.applySyncState(storageKey, remoteSyncState);
			}
		}
	}

	/**
	 * Find any local updates and send them to the remote storage.
	 * @param storageKey The key of the storage to synchronise.
	 * @returns A promise that resolves when local changes have been built into a changeset and dispatched.
	 * @internal
	 */
	private async updateFromLocalSyncState(storageKey: string): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: SynchronisedStorageService.CLASS_NAME,
			message: "updateFromLocalSyncState",
			data: {
				storageKey
			}
		});

		const localChangeSnapshots = await this._localSyncStateHelper.getSnapshots(storageKey, true);

		if (localChangeSnapshots.length > 0) {
			const localChangeSnapshot = localChangeSnapshots[0];

			if (Is.arrayValue(localChangeSnapshot.changes)) {
				await this._remoteSyncStateHelper.buildChangeSet(
					storageKey,
					localChangeSnapshot.changes,
					async (syncChangeSet, changeSetStorageId) => {
						if (Is.empty(syncChangeSet) && Is.empty(changeSetStorageId)) {
							await this._logging?.log({
								level: "info",
								source: SynchronisedStorageService.CLASS_NAME,
								message: "builtStorageChangeSetNone",
								data: {
									storageKey
								}
							});
						} else {
							await this._logging?.log({
								level: "info",
								source: SynchronisedStorageService.CLASS_NAME,
								message: "builtStorageChangeSet",
								data: {
									storageKey,
									changeSetStorageId
								}
							});
							// Send the local changes to the remote storage if we are a trusted node
							if (
								Is.empty(this._trustedSynchronisedStorageComponent) &&
								Is.stringValue(changeSetStorageId)
							) {
								// If we are a trusted node, we can add the change set to the sync state
								// and remove the local change snapshot
								await this._remoteSyncStateHelper.addChangeSetToSyncState(
									storageKey,
									changeSetStorageId
								);
								await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
							} else if (
								!Is.empty(this._trustedSynchronisedStorageComponent) &&
								Is.object(syncChangeSet) &&
								Is.stringValue(this._nodeId)
							) {
								// If we are not a trusted node, we need to send the changes to the trusted node
								// and then remove the local change snapshot
								await this._logging?.log({
									level: "info",
									source: SynchronisedStorageService.CLASS_NAME,
									message: "sendingChangeSetToTrustedNode",
									data: {
										storageKey,
										changeSetStorageId
									}
								});

								const trustPayload = await this._trustComponent.generate(
									this._nodeId,
									this._config.overrideTrustGeneratorType.length > 0
										? this._config.overrideTrustGeneratorType
										: undefined
								);

								await this._trustedSynchronisedStorageComponent.syncChangeSet(
									syncChangeSet,
									trustPayload
								);

								await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
							}
						}
					}
				);
			} else {
				await this._logging?.log({
					level: "info",
					source: SynchronisedStorageService.CLASS_NAME,
					message: "updateFromLocalSyncStateNoChanges",
					data: {
						storageKey
					}
				});
			}
		}
	}

	/**
	 * Start the consolidation sync.
	 * @param storageKey The storage key to consolidate.
	 * @returns A promise that resolves when the consolidation batch request is dispatched.
	 * @internal
	 */
	private async startConsolidationSync(storageKey: string): Promise<void> {
		try {
			// If we are going to perform a consolidation first take any local updates
			// we have and create a changeset from them, so that anybody applying
			// just changes since a consolidation can use the changeset
			// and skip the consolidation
			await this.updateFromLocalSyncState(storageKey);

			// Now start the consolidation
			await this._remoteSyncStateHelper.consolidationStart(
				storageKey,
				this._config.consolidationBatchSize ??
					SynchronisedStorageService._DEFAULT_CONSOLIDATION_BATCH_SIZE
			);
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: SynchronisedStorageService.CLASS_NAME,
				message: "consolidationSyncFailed",
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Register a new storage key for synchronisation.
	 * @param syncRegisterStorageKey The registration payload containing the storage key.
	 * @returns A promise that resolves when the storage key is registered and activated if the service has started.
	 * @internal
	 */
	private async registerStorageKey(syncRegisterStorageKey: ISyncRegisterStorageKey): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: SynchronisedStorageService.CLASS_NAME,
			message: "registerStorageKey",
			data: {
				storageKey: syncRegisterStorageKey.storageKey
			}
		});

		if (Is.empty(this._activeStorageKeys[syncRegisterStorageKey.storageKey])) {
			this._activeStorageKeys[syncRegisterStorageKey.storageKey] = false;

			if (this._serviceStarted) {
				await this.activateStorageKey(syncRegisterStorageKey.storageKey);
			}
		}
	}

	/**
	 * Activate a storage key by scheduling update and consolidation tasks.
	 * @param storageKey The storage key to activate.
	 * @returns A promise that resolves when the scheduled tasks are registered.
	 * @internal
	 */
	private async activateStorageKey(storageKey: string): Promise<void> {
		if (!Is.empty(this._activeStorageKeys[storageKey]) && !this._activeStorageKeys[storageKey]) {
			await this._logging?.log({
				level: "info",
				source: SynchronisedStorageService.CLASS_NAME,
				message: "activateStorageKey",
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

			if (
				!Is.empty(this._trustedSynchronisedStorageComponent) &&
				this._config.consolidationIntervalMinutes > 0
			) {
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
