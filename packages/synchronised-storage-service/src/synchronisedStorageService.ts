// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITaskSchedulerComponent } from "@twin.org/background-task-models";
import {
	BlobStorageConnectorFactory,
	type IBlobStorageConnector
} from "@twin.org/blob-storage-models";
import {
	BaseError,
	ComponentFactory,
	Converter,
	GeneralError,
	Guards,
	Is,
	UnauthorizedError
} from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import {
	DocumentHelper,
	IdentityConnectorFactory,
	type IIdentityConnector
} from "@twin.org/identity-models";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import { type IProof, ProofTypes } from "@twin.org/standards-w3c-did";
import {
	type ISyncChangeSet,
	type ISynchronisedEntity,
	type ISynchronisedStorageComponent,
	type ISyncItemChange,
	type ISyncRegisterStorageKey,
	SynchronisedStorageTopics
} from "@twin.org/synchronised-storage-models";
import { type IVaultConnector, VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import {
	type IVerifiableStorageConnector,
	VerifiableStorageConnectorFactory
} from "@twin.org/verifiable-storage-models";
import verifiableStorageKeys from "./data/verifiableStorageKeys.json";
import type { SyncSnapshotEntry } from "./entities/syncSnapshotEntry";
import { BlobStorageHelper } from "./helpers/blobStorageHelper";
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
	 * The default max number of consolidations to keep in storage.
	 * @internal
	 */
	private static readonly _DEFAULT_MAX_CONSOLIDATIONS: number = 5;

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<SynchronisedStorageService>();

	/**
	 * The logging component to use for logging.
	 * @internal
	 */
	private readonly _loggingComponent: ILoggingComponent | undefined;

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
	private readonly _localSyncSnapshotEntryEntityStorage: IEntityStorageConnector<
		SyncSnapshotEntry<T>
	>;

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
	 * The blob storage helper.
	 * @internal
	 */
	private readonly _blobStorageHelper: BlobStorageHelper;

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
		Guards.stringValue(
			this.CLASS_NAME,
			nameof(options.config.verifiableStorageKeyId),
			options.config.verifiableStorageKeyId
		);

		this._eventBusComponent = ComponentFactory.get(options.eventBusComponentType ?? "event-bus");
		this._loggingComponent = ComponentFactory.getIfExists(
			options.loggingComponentType ?? "logging"
		);
		this._vaultConnector = VaultConnectorFactory.get(options.vaultConnectorType ?? "vault");

		this._localSyncSnapshotEntryEntityStorage = EntityStorageConnectorFactory.get<
			IEntityStorageConnector<SyncSnapshotEntry<T>>
		>(options.syncSnapshotStorageConnectorType ?? "sync-snapshot-entry");

		this._verifiableSyncPointerStorageConnector = VerifiableStorageConnectorFactory.get(
			options.verifiableStorageConnectorType ?? "verifiable-storage"
		);

		this._blobStorageConnector = BlobStorageConnectorFactory.get(
			options.blobStorageConnectorType ?? "blob-storage"
		);

		this._identityConnector = IdentityConnectorFactory.get(
			options.identityConnectorType ?? "identity"
		);

		this._taskSchedulerComponent = ComponentFactory.get(
			options.taskSchedulerComponentType ?? "task-scheduler"
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
			synchronisedStorageMethodId:
				options.config.synchronisedStorageMethodId ?? "synchronised-storage-assertion",
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
			verifiableStorageKeyId: options.config.verifiableStorageKeyId
		};

		this._synchronisedStorageKey =
			verifiableStorageKeys[
				options.config.verifiableStorageKeyId as keyof typeof verifiableStorageKeys
			] ?? options.config.verifiableStorageKeyId;

		Guards.stringValue(this.CLASS_NAME, "synchronisedStorageKey", this._synchronisedStorageKey);

		this._blobStorageHelper = new BlobStorageHelper(
			this._loggingComponent,
			this._vaultConnector,
			this._blobStorageConnector,
			this._config.blobStorageEncryptionKeyId,
			isTrustedNode
		);

		this._changeSetHelper = new ChangeSetHelper<T>(
			this._loggingComponent,
			this._eventBusComponent,
			this._identityConnector,
			this._blobStorageHelper,
			this._config.synchronisedStorageMethodId
		);

		this._localSyncStateHelper = new LocalSyncStateHelper<T>(
			this._loggingComponent,
			this._localSyncSnapshotEntryEntityStorage,
			this._changeSetHelper
		);

		this._remoteSyncStateHelper = new RemoteSyncStateHelper<T>(
			this._loggingComponent,
			this._eventBusComponent,
			this._verifiableSyncPointerStorageConnector,
			this._blobStorageHelper,
			this._changeSetHelper,
			isTrustedNode,
			this._config.maxConsolidations
		);

		this._serviceStarted = false;
		this._activeStorageKeys = {};

		this._eventBusComponent.subscribe<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			async event => this.registerStorageKey(event.data)
		);

		this._eventBusComponent.subscribe<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			async event => {
				// Make sure the change event is from this node
				if (Is.stringValue(this._nodeIdentity) && this._nodeIdentity === event.data.nodeIdentity) {
					await this._localSyncStateHelper.addLocalChange(
						event.data.storageKey,
						event.data.operation,
						event.data.id
					);
				}
			}
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
		this._changeSetHelper.setNodeIdentity(nodeIdentity);
		this._remoteSyncStateHelper.setSynchronisedStorageKey(this._synchronisedStorageKey);
		this._serviceStarted = true;

		// If this is not a trusted node we need to request the decryption key from a trusted node
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			const proof = await this._identityConnector.createProof(
				this._nodeIdentity,
				DocumentHelper.joinId(this._nodeIdentity, this._config.synchronisedStorageMethodId),
				ProofTypes.DataIntegrityProof,
				{ nodeIdentity }
			);

			const decryptionKey = await this._trustedSynchronisedStorageComponent.getDecryptionKey(
				this._nodeIdentity,
				proof
			);

			// If the key exists remove it and get a new one, in case the key has been rotated
			const existingKey = await this._vaultConnector.getKey(
				this._config.blobStorageEncryptionKeyId
			);

			if (!Is.empty(existingKey)) {
				await this._vaultConnector.removeKey(this._config.blobStorageEncryptionKeyId);
			}

			await this._vaultConnector.addKey(
				this._config.blobStorageEncryptionKeyId,
				VaultKeyType.ChaCha20Poly1305,
				Converter.base64ToBytes(decryptionKey)
			);
		}

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
	 * Get the decryption key for the synchronised storage.
	 * This is used to decrypt the data stored in the synchronised storage.
	 * @param nodeIdentity The identity of the node requesting the decryption key.
	 * @param proof The proof of the request so we know the request is from the specified node.
	 * @returns The decryption key.
	 */
	public async getDecryptionKey(nodeIdentity: string, proof: IProof): Promise<string> {
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			throw new GeneralError(this.CLASS_NAME, "notTrustedNode");
		}

		Guards.stringValue(this.CLASS_NAME, nameof(nodeIdentity), nodeIdentity);
		Guards.object<IProof>(this.CLASS_NAME, nameof(proof), proof);

		const isValid = await this._identityConnector.verifyProof(
			{ nodeIdentity } as unknown as IJsonLdNodeObject,
			proof
		);

		if (!isValid) {
			throw new UnauthorizedError(this.CLASS_NAME, "invalidProof");
		}

		// TODO: We need to check if the node has permissions to access the decryption key
		// using rights-management
		const key = await this._vaultConnector.getKey(this._config.blobStorageEncryptionKeyId);

		if (Is.undefined(key.privateKey)) {
			throw new UnauthorizedError(this.CLASS_NAME, "decryptionKeyNotFound");
		}

		return Converter.bytesToBase64(key.privateKey);
	}

	/**
	 * Synchronise a set of changes from an untrusted node, assumes this is a trusted node.
	 * @param syncChangeSet The change set to synchronise.
	 * @returns Nothing.
	 */
	public async syncChangeSet(syncChangeSet: ISyncChangeSet<T>): Promise<void> {
		if (!Is.empty(this._trustedSynchronisedStorageComponent)) {
			throw new GeneralError(this.CLASS_NAME, "notTrustedNode");
		}

		Guards.object<ISyncChangeSet>(this.CLASS_NAME, nameof(syncChangeSet), syncChangeSet);

		await this._loggingComponent?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "syncChangeSetForRemoteNode",
			data: {
				changeSetStorageId: syncChangeSet.id
			}
		});

		// TODO: The change set has a proof signed by the originating node identity
		// The proof is verified that the change set is valid and has not been tampered with.
		// but we also need to check that the originating node has permissions
		// to store the change set in the synchronised storage.
		// This will be performed using rights-management

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
	 * @returns Nothing.
	 * @internal
	 */
	private async startEntitySync(storageKey: string): Promise<void> {
		try {
			await this._loggingComponent?.log({
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
			await this._loggingComponent?.log({
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
		await this._loggingComponent?.log({
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
	 * @returns Nothing.
	 * @internal
	 */
	private async updateFromLocalSyncState(storageKey: string): Promise<void> {
		await this._loggingComponent?.log({
			level: "info",
			source: this.CLASS_NAME,
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
							await this._loggingComponent?.log({
								level: "info",
								source: this.CLASS_NAME,
								message: "builtStorageChangeSetNone",
								data: {
									storageKey
								}
							});
						} else {
							await this._loggingComponent?.log({
								level: "info",
								source: this.CLASS_NAME,
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
								Is.object(syncChangeSet)
							) {
								// If we are not a trusted node, we need to send the changes to the trusted node
								// and then remove the local change snapshot
								await this._loggingComponent?.log({
									level: "info",
									source: this.CLASS_NAME,
									message: "sendingChangeSetToTrustedNode",
									data: {
										storageKey,
										changeSetStorageId
									}
								});
								await this._trustedSynchronisedStorageComponent.syncChangeSet(syncChangeSet);
								await this._localSyncStateHelper.removeLocalChangeSnapshot(localChangeSnapshot);
							}
						}
					}
				);
			} else {
				await this._loggingComponent?.log({
					level: "info",
					source: this.CLASS_NAME,
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
	 * @returns Nothing.
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
			await this._loggingComponent?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "consolidationSyncFailed",
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Register a new sync type.
	 * @param syncRegisterStorageKey The sync register type to register.
	 * @internal
	 */
	private async registerStorageKey(syncRegisterStorageKey: ISyncRegisterStorageKey): Promise<void> {
		await this._loggingComponent?.log({
			level: "info",
			source: this.CLASS_NAME,
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
	 * Activate a storage key.
	 * @param storageKey The storage key to activate.
	 * @internal
	 */
	private async activateStorageKey(storageKey: string): Promise<void> {
		if (!Is.empty(this._activeStorageKeys[storageKey]) && !this._activeStorageKeys[storageKey]) {
			await this._loggingComponent?.log({
				level: "info",
				source: this.CLASS_NAME,
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
