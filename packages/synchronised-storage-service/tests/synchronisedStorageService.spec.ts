// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { TaskSchedulerService } from "@twin.org/background-task-scheduler";
import { MemoryBlobStorageConnector } from "@twin.org/blob-storage-connector-memory";
import { BlobStorageConnectorFactory } from "@twin.org/blob-storage-models";
import {
	type BlobStorageEntry,
	BlobStorageService,
	initSchema as initSchemaBlobStorage
} from "@twin.org/blob-storage-service";
import { ComponentFactory, Converter, ObjectHelper, RandomHelper } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { EntitySchemaFactory, EntitySchemaHelper, entity, property } from "@twin.org/entity";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { LocalEventBusConnector } from "@twin.org/event-bus-connector-local";
import {
	EventBusConnectorFactory,
	type IEventBusComponent,
	type IEventBusConnector
} from "@twin.org/event-bus-models";
import { EventBusService } from "@twin.org/event-bus-service";
import {
	EntityStorageIdentityConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@twin.org/identity-connector-entity-storage";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import {
	EntityStorageLoggingConnector,
	type LogEntry,
	initSchema as initSchemaLogging
} from "@twin.org/logging-connector-entity-storage";
import { LoggingConnectorFactory } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncItemChange,
	type ISyncItemRequest,
	type ISyncItemResponse,
	type ISyncRegisterStorageKey,
	SynchronisedStorageTopics
} from "@twin.org/synchronised-storage-models";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import {
	EntityStorageVerifiableStorageConnector,
	type VerifiableItem,
	initSchema as initSchemaVerifiableStorage
} from "@twin.org/verifiable-storage-connector-entity-storage";
import { VerifiableStorageConnectorFactory } from "@twin.org/verifiable-storage-models";
import type { SyncSnapshotEntry } from "../src/entities/syncSnapshotEntry";
import { initSchema } from "../src/schema";
import { SynchronisedStorageService } from "../src/synchronisedStorageService";

/**
 * Test Type Definition.
 */
@entity()
class TestType {
	/**
	 * Id.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * Node Identity.
	 */
	@property({ type: "string", isSecondary: true })
	public nodeIdentity!: string;

	/**
	 * Date Modified.
	 */
	@property({ type: "string", isSecondary: true })
	public dateModified!: string;
}

const synchronisedStorageKey = "verifiable:entity-storage:11111111111111111111111111111111";
let eventBusConnector: IEventBusConnector;
let eventBusService: IEventBusComponent;
let verifiableStorage: MemoryEntityStorageConnector<VerifiableItem>;
let blobEntryEntityStorage: MemoryEntityStorageConnector<BlobStorageEntry>;
let blobStorageConnector: MemoryBlobStorageConnector;
let blobStorageComponent: BlobStorageService;
let syncSnapshotStorageConnector: MemoryEntityStorageConnector<SyncSnapshotEntry>;
let loggingMemoryEntityStorage: MemoryEntityStorageConnector<LogEntry>;
let testNodeIdentity: string;

describe("synchronisedStorageService", () => {
	beforeEach(async () => {
		initSchema();
		initSchemaVerifiableStorage();
		initSchemaBlobStorage();
		initSchemaIdentity();
		initSchemaVault();
		initSchemaLogging();

		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));

		verifiableStorage = new MemoryEntityStorageConnector<VerifiableItem>({
			entitySchema: nameof<VerifiableItem>()
		});
		EntityStorageConnectorFactory.register("verifiable-item", () => verifiableStorage);

		VerifiableStorageConnectorFactory.register(
			"verifiable-storage",
			() => new EntityStorageVerifiableStorageConnector()
		);

		syncSnapshotStorageConnector = new MemoryEntityStorageConnector<SyncSnapshotEntry>({
			entitySchema: nameof<SyncSnapshotEntry>()
		});
		EntityStorageConnectorFactory.register(
			"sync-snapshot-entry",
			() => syncSnapshotStorageConnector
		);

		blobEntryEntityStorage = new MemoryEntityStorageConnector<BlobStorageEntry>({
			entitySchema: "BlobStorageEntry"
		});
		EntityStorageConnectorFactory.register("blob-storage-entry", () => blobEntryEntityStorage);

		blobStorageConnector = new MemoryBlobStorageConnector();
		BlobStorageConnectorFactory.register("memory", () => blobStorageConnector);

		blobStorageComponent = new BlobStorageService();
		ComponentFactory.register("blob-storage", () => blobStorageComponent);

		EntityStorageConnectorFactory.register(
			"vault-key",
			() =>
				new MemoryEntityStorageConnector<VaultKey>({
					entitySchema: nameof<VaultKey>()
				})
		);
		const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>()
		});
		EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

		const identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>()
		});
		EntityStorageConnectorFactory.register(
			"identity-document",
			() => identityDocumentEntityStorage
		);

		const vaultConnector = new EntityStorageVaultConnector();
		VaultConnectorFactory.register("vault", () => vaultConnector);

		const identityConnector = new EntityStorageIdentityConnector();
		IdentityConnectorFactory.register("identity", () => identityConnector);

		eventBusConnector = new LocalEventBusConnector();
		EventBusConnectorFactory.register("local", () => eventBusConnector);

		eventBusService = new EventBusService({
			eventBusConnectorType: "local"
		});
		ComponentFactory.register("event-bus", () => eventBusService);

		const taskSchedulerComponent = new TaskSchedulerService({ config: { overrideInterval: 0.5 } });
		ComponentFactory.register("task-scheduler", () => taskSchedulerComponent);

		loggingMemoryEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>()
		});
		EntityStorageConnectorFactory.register("log-entry", () => loggingMemoryEntityStorage);
		LoggingConnectorFactory.register("logging", () => new EntityStorageLoggingConnector());

		let tickCounter = new Date(2025, 4, 29, 9, 0, 0).getTime();
		Date.now = vi.fn().mockImplementation(() => tickCounter++);

		let randomCounter = 2000;
		RandomHelper.generate = vi
			.fn()
			.mockImplementation(length => new Uint8Array(length).fill(randomCounter++));

		Bip39.randomMnemonic = vi
			.fn()
			.mockImplementation(
				() =>
					"life first castle choose joke eyebrow middle speak lucky improve awesome common energy oval use scare water cluster update steak endorse sweet festival error"
			);

		const didDocument = await identityConnector.createDocument("test-node-identity");
		testNodeIdentity = didDocument.id;

		await identityConnector.addVerificationMethod(
			"test-node-identity",
			didDocument.id,
			"assertionMethod",
			"synchronised-storage-assertion"
		);
	});

	test("can create an instance of the service as a trusted node", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
	});

	test("can create an instance of the service as a non trusted node", async () => {
		const connectorTusted = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		ComponentFactory.register("trusted", () => connectorTusted);

		const connector = new SynchronisedStorageService({
			trustedSynchronisedStorageComponentType: "trusted",
			config: { synchronisedStorageKey, isTrustedNode: false }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
	});

	test("can register a type before the service has been started", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await connector.start(testNodeIdentity, "node-logging");

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerType",
			"activateType",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);
	});

	test("can register a type after the service has started", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await connector.start(testNodeIdentity, "node-logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerType",
			"activateType",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);
	});

	test("can process a local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "node-logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			id: "test-id-1",
			storageKey: "test-type",
			operation: "set"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
				storageKey: "test-type",
				dateCreated: expect.any(String),
				changeSetStorageIds: [],
				isLocalSnapshot: true,
				changes: [
					{
						operation: "set",
						id: "test-id-1"
					}
				]
			}
		]);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerType",
			"activateType",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"updateFromLocalSyncStateNoChanges",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"setLocalChangeSnapshot"
		]);
	});

	test("can process subsequent local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			config: {
				synchronisedStorageKey,
				isTrustedNode: true,
				entityUpdateIntervalMinutes: 0.01,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "node-logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			operation: "set"
		});

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			operation: "delete"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
				storageKey: "test-type",
				dateCreated: expect.any(String),
				changeSetStorageIds: [],
				isLocalSnapshot: true,
				changes: [
					{
						operation: "delete",
						id: "test-id-1"
					}
				]
			}
		]);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerType",
			"activateType",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"updateFromLocalSyncStateNoChanges",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"setLocalChangeSnapshot",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotExists",
			"setLocalChangeSnapshot"
		]);
	});

	test("can process update and perform sync", async () => {
		const connector = new SynchronisedStorageService({
			config: {
				synchronisedStorageKey,
				isTrustedNode: true,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await verifiableStorage.set({
			id: synchronisedStorageKey.split(":")[2],
			creator:
				"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
			data: Converter.bytesToBase64(ObjectHelper.toBytes({ syncPointers: {} })),
			allowList: [
				"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
			],
			maxAllowListSize: 100
		});

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			operation: "set"
		});

		await eventBusConnector.subscribe<ISyncItemRequest>(
			SynchronisedStorageTopics.LocalItemRequest,
			async request => {
				await eventBusConnector.publish<ISyncItemResponse<TestType>>(
					SynchronisedStorageTopics.LocalItemResponse,
					{
						storageKey: "test-type",
						id: "test-id-1",
						entity: {
							id: "test-id-1",
							nodeIdentity: testNodeIdentity,
							dateModified: new Date().toISOString()
						}
					}
				);
			}
		);

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2",
				storageKey: "test-type",
				dateCreated: expect.any(String),
				changeSetStorageIds: [],
				isLocalSnapshot: true,
				changes: [
					{
						operation: "set",
						id: "test-id-1"
					}
				]
			}
		]);

		await connector.start(testNodeIdentity, "node-logging");

		await new Promise(resolve => setTimeout(resolve, 1000));

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerType",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"setLocalChangeSnapshot",
			"activateType",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotExists",
			"createAndStoreChangeSet",
			"createChangeSetRequestingItem",
			"createChangeSetRespondingItem",
			"finalisingSyncChanges",
			"createdChangeSetProof",
			"changeSetStoring",
			"createdStorageChangeSet",
			"addChangeSetToSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"remoteSyncStateStoring",
			"verifiableSyncPointerStoreStoring",
			"removeLocalChangeSnapshot"
		]);

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				id: synchronisedStorageKey.split(":")[2],
				creator:
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
				data: expect.any(String),
				allowList: [
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
				],
				maxAllowListSize: 100
			}
		]);

		const verifiable = ObjectHelper.fromBytes(Converter.base64ToBytes(verifiableStore[0].data));
		expect(verifiable).toEqual({
			syncPointers: {
				"test-type": expect.any(String)
			}
		});

		const localSnapshots2 = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots2).toEqual([]);

		const blobStorageStore = blobEntryEntityStorage.getStore();
		expect(blobStorageStore).toEqual([
			{
				id: expect.any(String),
				dateCreated: expect.any(String),
				blobSize: 795,
				blobHash: expect.any(String),
				encodingFormat: "application/json",
				fileExtension: "json",
				metadata: undefined,
				isEncrypted: false,
				compression: "gzip"
			},
			{
				id: expect.any(String),
				dateCreated: expect.any(String),
				blobSize: 233,
				blobHash: expect.any(String),
				encodingFormat: "application/json",
				fileExtension: "json",
				metadata: undefined,
				isEncrypted: false,
				compression: "gzip"
			}
		]);
	});

	// test("can receive the updates from a remote sync state", async () => {
	// 	const connector = new SynchronisedStorageService({
	// 		config: {
	// 			synchronisedStorageKey,
	// 			isTrustedNode: true,
	// 			consolidationIntervalMinutes: 0
	// 		}
	// 	});
	// 	expect(connector).toBeInstanceOf(SynchronisedStorageService);

	// 	await eventBusConnector.publish<ISyncRegisterStorageKey>(
	// 		SynchronisedStorageTopics.RegisterStorageKey,
	// 		{
	// 			storageKey: "test-type"
	// 		}
	// 	);

	// 	let remoteData;

	// 	await eventBusConnector.subscribe<ISyncItemSet>(
	// 		SynchronisedStorageTopics.RemoteItemSet,
	// 		async e => {
	// 			remoteData = e;
	// 		}
	// 	);

	// 	await blobEntryEntityStorage.set({
	// 		id: "blob:memory:cc8d2a42b6cc199f1a1f13c21bfbefb7d8cffe1cd1b6945236bed2be9700bba1",
	// 		dateCreated: "2025-05-29T07:00:00.048Z",
	// 		blobSize: 795,
	// 		blobHash: "sha256:HWdeydX8NC+3HBjB4GPJW0X0UGL9ZA0FTR9+pHJX0IM=",
	// 		encodingFormat: "application/json",
	// 		fileExtension: "json",
	// 		metadata: undefined,
	// 		isEncrypted: false,
	// 		compression: "gzip"
	// 	});

	// 	await blobEntryEntityStorage.set({
	// 		id: "blob:memory:db40a0242be8028b8b1b45aaf11501ca24645c988566a2d311495c6fe6fb532e",
	// 		dateCreated: "2025-05-29T07:00:00.060Z",
	// 		blobSize: 233,
	// 		blobHash: "sha256:+Z8dZaYL0NzScJi/xMNNmMdaFPOdoXSIa6/RlwgPDFo=",
	// 		encodingFormat: "application/json",
	// 		fileExtension: "json",
	// 		metadata: undefined,
	// 		isEncrypted: false,
	// 		compression: "gzip"
	// 	});

	// 	const verifiableSyncPointerStore: ISyncPointerStore = {
	// 		syncPointers: {
	// 			"test-type": "blob:memory:db40a0242be8028b8b1b45aaf11501ca24645c988566a2d311495c6fe6fb532e"
	// 		}
	// 	};

	// 	await verifiableStorage.set({
	// 		id: synchronisedStorageKey.split(":")[2],
	// 		creator:
	// 			"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
	// 		data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
	// 		allowList: [
	// 			"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
	// 		],
	// 		maxAllowListSize: 100
	// 	});

	// 	await connector.start(testNodeIdentity, "node-logging");

	// 	const logStore = loggingMemoryEntityStorage.getStore();
	// 	expect(logStore.map(e => e.message)).toEqual([
	// 		"registerType",
	// 		"activateType",
	// 		"startEntitySync",
	// 		"updateFromRemoteSyncState",
	// 		"verifiableSyncPointerStoreRetrieving",
	// 		"verifiableSyncPointerStoreRetrieved",
	// 		"remoteSyncStateRetrieving"
	// 	]);

	// 	expect(remoteData).toEqual({});
	// });
});
