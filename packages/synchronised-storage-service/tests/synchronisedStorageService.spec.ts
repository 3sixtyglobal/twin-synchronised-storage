// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	type ScheduledTask,
	TaskSchedulerService,
	initSchema as initSchemaScheduler
} from "@twin.org/background-task-scheduler";
import { MemoryBlobStorageConnector } from "@twin.org/blob-storage-connector-memory";
import { BlobStorageConnectorFactory } from "@twin.org/blob-storage-models";
import { initSchema as initSchemaBlobStorage } from "@twin.org/blob-storage-service";
import { ContextIdStore } from "@twin.org/context";
import {
	ComponentFactory,
	Compression,
	CompressionType,
	Converter,
	ObjectHelper,
	RandomHelper,
	Uint8ArrayHelper
} from "@twin.org/core";
import { Bip39, ChaCha20Poly1305 } from "@twin.org/crypto";
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
import { LoggingService } from "@twin.org/logging-service";
import { nameof } from "@twin.org/nameof";
import {
	type ISyncChangeSet,
	type ISyncItemChange,
	type ISyncItemRequest,
	type ISyncItemResponse,
	type ISyncItemSet,
	type ISyncRegisterStorageKey,
	SynchronisedStorageContexts,
	SynchronisedStorageTopics,
	SynchronisedStorageTypes
} from "@twin.org/synchronised-storage-models";
import type { ITrustComponent } from "@twin.org/trust-models";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import {
	EntityStorageVerifiableStorageConnector,
	type VerifiableItem,
	initSchema as initSchemaVerifiableStorage
} from "@twin.org/verifiable-storage-connector-entity-storage";
import { VerifiableStorageConnectorFactory } from "@twin.org/verifiable-storage-models";
import type { SyncSnapshotEntry } from "../src/entities/syncSnapshotEntry.js";
import type { ISyncPointerStore } from "../src/models/ISyncPointerStore.js";
import type { ISyncState } from "../src/models/ISyncState.js";
import { initSchema } from "../src/schema.js";
import { SynchronisedStorageService } from "../src/synchronisedStorageService.js";

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
	public nodeId!: string;

	/**
	 * Date Modified.
	 */
	@property({ type: "string", isSecondary: true })
	public dateModified!: string;
}

const verifiableStorageKeyId = "verifiable:entity-storage:11111111111111111111111111111111";
let eventBusConnector: IEventBusConnector;
let eventBusService: IEventBusComponent;
let eventBusUntrustedConnector: IEventBusConnector;
let eventBusUntrustedService: IEventBusComponent;
let verifiableStorage: MemoryEntityStorageConnector<VerifiableItem>;
let blobStorageConnector: MemoryBlobStorageConnector;
let syncSnapshotStorageConnector: MemoryEntityStorageConnector<SyncSnapshotEntry>;
let loggingMemoryEntityStorage: MemoryEntityStorageConnector<LogEntry>;
let loggingUntrustedMemoryEntityStorage: MemoryEntityStorageConnector<LogEntry>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let secretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;
let keyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
let nodeId: string;
let testNodeId: string;
let testNodeIdUntrusted: string;
let mockTrustComponent: ITrustComponent;

const mockChaCha20Poly1305Key = new Uint8Array(32).fill(0x01);

/**
 * Decompress a compressed string into an object.
 * @param compacted The compressed string to decompress in base64.
 * @returns The decompressed object.
 */
async function expandObject<T>(compacted: string): Promise<T> {
	const bytes = Converter.base64ToBytes(compacted);
	const nonce = bytes.slice(0, 12);
	const encrypted = bytes.slice(12);

	const chaCha = new ChaCha20Poly1305(mockChaCha20Poly1305Key, nonce);

	const compressedBlob = chaCha.decrypt(encrypted);

	const decompressedBlob = await Compression.decompress(compressedBlob, CompressionType.Gzip);

	return ObjectHelper.fromBytes<T>(decompressedBlob);
}

/**
 * Compress an object into a  string.
 * @param obj The object to compress.
 * @returns The compressed string in base64.
 */
async function compressObject<T>(obj: T): Promise<Uint8Array> {
	const json = ObjectHelper.toBytes(obj);
	const compressedBlob = await Compression.compress(json, CompressionType.Gzip);
	const nonce = RandomHelper.generate(12);
	const chaCha = new ChaCha20Poly1305(mockChaCha20Poly1305Key, nonce);
	const encrypted = chaCha.encrypt(compressedBlob);
	return Uint8ArrayHelper.concat([nonce, encrypted]);
}

/**
 * Wait for a specific number of log entries to be present.
 * @param store The MemoryEntityStorageConnector to check for log entries.
 * @param count The number of log entries to wait for.
 */
async function waitForLogEntries(
	store: MemoryEntityStorageConnector<LogEntry>,
	count: number
): Promise<void> {
	let retries = 0;
	let logEntries = await store.getStore();
	while (logEntries.length < count && retries < 50) {
		await new Promise(resolve => setTimeout(resolve, 100));
		logEntries = await store.getStore();
		retries++;
	}

	if (logEntries.length >= count) {
		return;
	}

	console.log(JSON.stringify(await store.getStore(), null, 2));
	throw new Error(
		`Failed while waiting for log entries, expected ${count}, got ${logEntries.length}`
	);
}

describe("synchronisedStorageService", () => {
	beforeEach(async () => {
		initSchema();
		initSchemaVerifiableStorage();
		initSchemaBlobStorage();
		initSchemaIdentity();
		initSchemaVault();
		initSchemaLogging();
		initSchemaScheduler();

		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));

		verifiableStorage = new MemoryEntityStorageConnector<VerifiableItem>({
			entitySchema: nameof<VerifiableItem>(),
			config: { storageKey: "verifiable-item" }
		});
		EntityStorageConnectorFactory.register("verifiable-item", () => verifiableStorage);

		VerifiableStorageConnectorFactory.register(
			"verifiable-storage",
			() => new EntityStorageVerifiableStorageConnector()
		);

		syncSnapshotStorageConnector = new MemoryEntityStorageConnector<SyncSnapshotEntry>({
			entitySchema: nameof<SyncSnapshotEntry>(),
			config: { storageKey: "sync-snapshot-entry" }
		});
		EntityStorageConnectorFactory.register(
			"sync-snapshot-entry",
			() => syncSnapshotStorageConnector
		);

		blobStorageConnector = new MemoryBlobStorageConnector();
		BlobStorageConnectorFactory.register("blob-storage", () => blobStorageConnector);

		keyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-key" }
		});
		EntityStorageConnectorFactory.register("vault-key", () => keyEntityStorage);
		secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secret" }
		});
		EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

		identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>(),
			config: { storageKey: "identity-document" }
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

		eventBusUntrustedConnector = new LocalEventBusConnector();
		EventBusConnectorFactory.register("local-untrusted", () => eventBusUntrustedConnector);

		eventBusUntrustedService = new EventBusService({
			eventBusConnectorType: "local-untrusted"
		});
		ComponentFactory.register("event-bus-untrusted", () => eventBusUntrustedService);

		EntityStorageConnectorFactory.register(
			"scheduled-task",
			() =>
				new MemoryEntityStorageConnector<ScheduledTask>({
					entitySchema: nameof<ScheduledTask>(),
					config: { storageKey: "scheduled-task" }
				})
		);

		const taskSchedulerComponent = new TaskSchedulerService({ config: { intervalMs: 0.5 } });
		ComponentFactory.register("task-scheduler", () => taskSchedulerComponent);

		ComponentFactory.register("platform", () => ({
			className: () => "platform",
			isMultiTenant: () => false,
			execute: async (method: () => Promise<void>) => method(),
			getLocalOriginContext: async () => undefined
		}));

		loggingMemoryEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>(),
			config: { storageKey: "log-entry" }
		});
		EntityStorageConnectorFactory.register("log-entry", () => loggingMemoryEntityStorage);
		LoggingConnectorFactory.register(
			"logging",
			() =>
				new EntityStorageLoggingConnector({
					config: {
						batchSize: 1
					}
				})
		);

		loggingUntrustedMemoryEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>(),
			config: { storageKey: "log-entry-untrusted" }
		});
		EntityStorageConnectorFactory.register(
			"log-entry-untrusted",
			() => loggingUntrustedMemoryEntityStorage
		);
		LoggingConnectorFactory.register(
			"logging-untrusted",
			() =>
				new EntityStorageLoggingConnector({
					logEntryStorageConnectorType: "log-entry-untrusted",
					config: { batchSize: 1 }
				})
		);

		const loggingService = new LoggingService({ loggingConnectorType: "logging" });
		ComponentFactory.register("logging", () => loggingService);

		const loggingUntrustedService = new LoggingService({
			loggingConnectorType: "logging-untrusted"
		});
		ComponentFactory.register("logging-untrusted", () => loggingUntrustedService);

		Date.now = vi.fn().mockImplementation(() => 1748480400000);

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
		testNodeId = didDocument.id;
		nodeId = didDocument.id;

		await identityConnector.addVerificationMethod(
			"test-node-identity",
			didDocument.id,
			"assertionMethod",
			"node-authentication-assertion"
		);

		const didDocumentUntrusted = await identityConnector.createDocument(
			"test-node-identity-untrusted"
		);
		testNodeIdUntrusted = didDocumentUntrusted.id;

		await identityConnector.addVerificationMethod(
			"test-node-identity-untrusted",
			didDocumentUntrusted.id,
			"assertionMethod",
			"node-authentication-assertion"
		);

		await vaultConnector.addKey(
			`${testNodeId}/synchronised-storage-blob-encryption-key`,
			VaultKeyType.ChaCha20Poly1305,
			mockChaCha20Poly1305Key
		);

		await vaultConnector.addKey(
			`${testNodeIdUntrusted}/synchronised-storage-blob-encryption-key`,
			VaultKeyType.ChaCha20Poly1305,
			mockChaCha20Poly1305Key
		);

		mockTrustComponent = {
			className: () => "MockTrustComponent",
			generate: vi.fn(
				async (identity: string, generatorType?: string, info?: { [key: string]: unknown }) =>
					`token:${identity}`
			),
			verify: vi.fn(async (payload: unknown, overrideVerifiers?: string[]) => ({
				verified: true,
				info: { identity: (payload as string).slice(6) }
			}))
		};

		ComponentFactory.register("trust", () => mockTrustComponent);

		ContextIdStore.getContextIds = vi
			.fn()
			.mockImplementation(() => ({ node: nodeId, org: "org", user: "user" }));
	});

	afterEach(async () => {
		await verifiableStorage.teardown();
		await syncSnapshotStorageConnector.teardown();
		await loggingMemoryEntityStorage.teardown();
		await loggingUntrustedMemoryEntityStorage.teardown();
		await identityDocumentEntityStorage.teardown();
		await keyEntityStorage.teardown();
		await secretEntityStorage.teardown();
	});

	test("can create an instance of the service as a trusted node", async () => {
		const connector = new SynchronisedStorageService({
			config: { verifiableStorageKeyId }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
	});

	test("can create an instance of the service as a non trusted node", async () => {
		const connectorTrusted = new SynchronisedStorageService({
			config: { verifiableStorageKeyId }
		});
		ComponentFactory.register("trusted", () => connectorTrusted);

		const connector = new SynchronisedStorageService({
			trustedSynchronisedStorageComponentType: "trusted",
			config: { verifiableStorageKeyId }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
	});

	test("can register a type before the service has been started", async () => {
		const connector = new SynchronisedStorageService({
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 },
			loggingComponentType: "logging"
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await connector.start("logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await waitForLogEntries(loggingMemoryEntityStorage, 10);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);
	});

	test("can register a type after the service has started", async () => {
		const connector = new SynchronisedStorageService({
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 },
			loggingComponentType: "logging"
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await connector.start("logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await waitForLogEntries(loggingMemoryEntityStorage, 10);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);
	});

	test("can process a local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			loggingComponentType: "logging",
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start("logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			id: "test-id-1",
			storageKey: "test-type",
			nodeId: testNodeId,
			operation: "set"
		});

		const localSnapshots = await syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: expect.stringMatching(/^[\da-f]{64}$/),
				storageKey: "test-type",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				changeSetStorageIds: [],
				isLocal: true,
				isConsolidated: false,
				epoch: 0,
				changes: [
					{
						operation: "set",
						id: "test-id-1"
					}
				]
			}
		]);

		await waitForLogEntries(loggingMemoryEntityStorage, 14);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"updateFromLocalSyncStateNoChanges",
			"addLocalChange",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"setLocalChangeSnapshot"
		]);
	});

	test("can process subsequent local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			loggingComponentType: "logging",
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start("logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeId: testNodeId,
			operation: "set"
		});

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeId: testNodeId,
			operation: "delete"
		});

		const localSnapshots = await syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: expect.stringMatching(/^[\da-f]{64}$/),
				storageKey: "test-type",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				changeSetStorageIds: [],
				isLocal: true,
				isConsolidated: false,
				epoch: 0,
				changes: [
					{
						operation: "delete",
						id: "test-id-1"
					}
				]
			}
		]);

		await waitForLogEntries(loggingMemoryEntityStorage, 18);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreNotFound",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"updateFromLocalSyncStateNoChanges",
			"addLocalChange",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"setLocalChangeSnapshot",
			"addLocalChange",
			"getSnapshots",
			"getSnapshotsExists",
			"setLocalChangeSnapshot"
		]);
	});

	test("can process update and perform sync", async () => {
		const connector = new SynchronisedStorageService({
			loggingComponentType: "logging",
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start("logging");

		await verifiableStorage.set({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeId,
			data: Converter.bytesToBase64(
				ObjectHelper.toBytes({ version: "1", storageKey: "test-type", syncPointers: {} })
			),
			allowList: [testNodeId],
			maxAllowListSize: 100
		});

		await eventBusConnector.subscribe<ISyncItemRequest>(
			SynchronisedStorageTopics.LocalItemRequest,
			async request => {
				await eventBusConnector.publish<ISyncItemResponse>(
					SynchronisedStorageTopics.LocalItemResponse,
					{
						storageKey: "test-type",
						id: "test-id-1",
						entity: {
							id: "test-id-1",
							nodeIdentity: testNodeId,
							dateModified: new Date("2025-01-01T00:00:00Z").toISOString()
						}
					}
				);
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeId: testNodeId,
			operation: "set"
		});

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await waitForLogEntries(loggingMemoryEntityStorage, 29);

		// Should be no local snapshot remaining as they will have been synced to remote storage
		const localSnapshots = await syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([]);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"addLocalChange",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"setLocalChangeSnapshot",
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsExists",
			"buildingChangeSet",
			"createChangeSetRequestingItem",
			"createChangeSetRespondingItem",
			"finalisingSyncChanges",
			"changeSetStoring",
			"saveBlob",
			"savedBlob",
			"builtStorageChangeSet",
			"addChangeSetToSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"syncStateStoring",
			"saveBlob",
			"savedBlob",
			"verifiableSyncPointerStoreStoring",
			"removeLocalChangeSnapshot"
		]);

		const verifiableStore = await verifiableStorage.getStore();
		expect(verifiableStore).toHaveLength(1);
		expect(verifiableStore[0]).toMatchObject({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeId,
			allowList: [testNodeId],
			maxAllowListSize: 100
		});

		const verifiable = ObjectHelper.fromBytes<ISyncPointerStore>(
			Converter.base64ToBytes(verifiableStore[0].data)
		);
		expect(verifiable).toEqual({
			version: "1",
			storageKey: "test-type",
			syncPointers: {
				"test-type": expect.stringMatching(/^blob:memory:[\da-f]{64}$/)
			}
		});

		const syncStateBlobId = verifiable.syncPointers["test-type"];

		const localSnapshots2 = await syncSnapshotStorageConnector.getStore();
		expect(localSnapshots2).toEqual([]);

		const blobStorageStore = await blobStorageConnector.getStore();
		const blobs: { [id: string]: string } = {};
		for (const blobKey in blobStorageStore) {
			blobs[blobKey] = Converter.bytesToBase64(blobStorageStore[blobKey]);
		}
		expect(Object.keys(blobs)).toHaveLength(2);

		const syncStateBlobKey = `root/${syncStateBlobId.split(":")[2]}`;
		expect(blobs[syncStateBlobKey]).toEqual(expect.any(String));

		expect(await expandObject(blobs[syncStateBlobKey])).toEqual({
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: expect.stringMatching(/^[\da-f]{64}$/),
					dateCreated: "2025-05-29T01:00:00.000Z",
					dateModified: "2025-05-29T01:00:00.000Z",
					isConsolidated: false,
					epoch: 1,
					changeSetStorageIds: [expect.stringMatching(/^blob:memory:[\da-f]{64}$/)]
				}
			]
		});

		const syncState = await expandObject<ISyncState>(blobs[syncStateBlobKey]);
		const changeSetBlobId = syncState.snapshots[0].changeSetStorageIds[0];
		const changeSetBlobKey = `root/${changeSetBlobId.split(":")[2]}`;
		expect(blobs[changeSetBlobKey]).toEqual(expect.any(String));

		expect(await expandObject(blobs[changeSetBlobKey])).toEqual({
			"@context": SynchronisedStorageContexts.Namespace,
			type: SynchronisedStorageTypes.ChangeSet,
			id: expect.stringMatching(/^[\da-f]{64}$/),
			dateCreated: "2025-05-29T01:00:00.000Z",
			dateModified: "2025-05-29T01:00:00.000Z",
			storageKey: "test-type",
			nodeIdentity: testNodeId,
			changes: [
				{
					entity: {
						dateModified: "2025-01-01T00:00:00.000Z"
					},
					id: "test-id-1",
					operation: "set"
				}
			]
		});
	});

	test("can receive the updates from a remote sync state", async () => {
		const connector = new SynchronisedStorageService({
			loggingComponentType: "logging",
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start("logging");

		let remoteData;

		await eventBusConnector.subscribe<ISyncItemSet>(
			SynchronisedStorageTopics.RemoteItemSet,
			async e => {
				remoteData = e;
			}
		);

		const changeSet: ISyncChangeSet = {
			"@context": SynchronisedStorageContexts.Namespace,
			type: SynchronisedStorageTypes.ChangeSet,
			id: "fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa",
			dateCreated: "2025-05-29T01:00:00.000Z",
			dateModified: "2025-05-29T01:00:00.000Z",
			storageKey: "test-type",
			nodeIdentity: testNodeIdUntrusted,
			changes: [
				{
					entity: {
						dateModified: "2025-01-01T00:00:00.000Z"
					},
					id: "test-id-1",
					operation: "set"
				}
			]
		};

		const blobChangeSetId = await blobStorageConnector.set(await compressObject(changeSet));

		const syncState: ISyncState = {
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
					dateCreated: "2025-05-29T07:00:00.000Z",
					dateModified: "2025-05-29T07:00:00.000Z",
					isConsolidated: true,
					epoch: 0,
					changeSetStorageIds: [blobChangeSetId]
				}
			]
		};

		const blobSnapshotId = await blobStorageConnector.set(await compressObject(syncState));

		const verifiableSyncPointerStore: ISyncPointerStore = {
			version: "1",
			syncPointers: {
				"test-type": blobSnapshotId
			}
		};

		await verifiableStorage.set({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeId,
			data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
			allowList: [testNodeId],
			maxAllowListSize: 100
		});

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await waitForLogEntries(loggingMemoryEntityStorage, 24);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"syncStateRetrieving",
			"loadBlob",
			"loadedBlob",
			"syncStateRetrieved",
			"applySyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"applySnapshotNoExisting",
			"applySnapshotFoundConsolidated",
			"storageReset",
			"processNewSnapshot",
			"getChangeSet",
			"loadBlob",
			"loadedBlob",
			"changeSetApplyingChange",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);

		expect(remoteData).toEqual({
			data: {
				entity: {
					dateModified: "2025-01-01T00:00:00.000Z",
					id: "test-id-1",
					nodeIdentity: testNodeIdUntrusted
				},
				storageKey: "test-type"
			},
			id: expect.any(String),
			topic: "synchronised-storage:remote-item-set",
			ts: expect.any(Number)
		});

		const localSnapshots = await syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
				dateCreated: "2025-05-29T07:00:00.000Z",
				dateModified: "2025-05-29T07:00:00.000Z",
				storageKey: "test-type",
				isLocal: false,
				isConsolidated: true,
				epoch: 0,
				changeSetStorageIds: [blobChangeSetId]
			}
		]);
	});

	test("can use a trusted node to synchronise a non trusted node", async () => {
		const connectorTrusted = new SynchronisedStorageService({
			loggingComponentType: "logging",
			config: { verifiableStorageKeyId }
		});
		ComponentFactory.register("trusted", () => connectorTrusted);

		const connector = new SynchronisedStorageService({
			trustedSynchronisedStorageComponentType: "trusted",
			eventBusComponentType: "event-bus-untrusted",
			loggingComponentType: "logging-untrusted",
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		nodeId = testNodeId;
		await connectorTrusted.start("logging");

		nodeId = testNodeIdUntrusted;
		await connector.start("logging-untrusted");

		await verifiableStorage.set({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeId,
			data: Converter.bytesToBase64(
				ObjectHelper.toBytes({ version: "1", storageKey: "test-type", syncPointers: {} })
			),
			allowList: [testNodeId],
			maxAllowListSize: 100
		});

		await eventBusUntrustedConnector.subscribe<ISyncItemRequest>(
			SynchronisedStorageTopics.LocalItemRequest,
			async request => {
				await eventBusUntrustedConnector.publish<ISyncItemResponse>(
					SynchronisedStorageTopics.LocalItemResponse,
					{
						storageKey: "test-type",
						id: "test-id-1",
						entity: {
							id: "test-id-1",
							nodeIdentity: testNodeId,
							dateModified: new Date("2025-01-01T00:00:00Z").toISOString()
						}
					}
				);
			}
		);

		await eventBusUntrustedConnector.publish<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			{
				storageKey: "test-type",
				id: "test-id-1",
				nodeId: testNodeIdUntrusted,
				operation: "set"
			}
		);

		await eventBusUntrustedConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await waitForLogEntries(loggingUntrustedMemoryEntityStorage, 20);
		await waitForLogEntries(loggingMemoryEntityStorage, 14);

		const logStoreUntrusted = await loggingUntrustedMemoryEntityStorage.getStore();
		expect(logStoreUntrusted.map(e => e.message)).toEqual([
			"addLocalChange",
			"getSnapshots",
			"getSnapshotsDoesNotExist",
			"setLocalChangeSnapshot",
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"updateFromLocalSyncState",
			"getSnapshots",
			"getSnapshotsExists",
			"buildingChangeSet",
			"createChangeSetRequestingItem",
			"createChangeSetRespondingItem",
			"finalisingSyncChanges",
			"builtStorageChangeSet",
			"sendingChangeSetToTrustedNode",
			"removeLocalChangeSnapshot"
		]);

		const logStore = await loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"decryptionKeyRequest",
			"syncChangeSetForRemoteNode",
			"copyChangeSet",
			"changeSetStoring",
			"saveBlob",
			"savedBlob",
			"changeSetApplyingChange",
			"addChangeSetToSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"syncStateStoring",
			"saveBlob",
			"savedBlob",
			"verifiableSyncPointerStoreStoring"
		]);

		const verifiableStore = await verifiableStorage.getStore();
		expect(verifiableStore).toHaveLength(1);
		expect(verifiableStore[0]).toMatchObject({
			id: "11111111111111111111111111111111",
			creator: testNodeId,
			allowList: [testNodeId],
			maxAllowListSize: 100
		});

		const verifiable = ObjectHelper.fromBytes<ISyncPointerStore>(
			Converter.base64ToBytes(verifiableStore[0].data)
		);
		expect(verifiable).toEqual({
			version: "1",
			storageKey: "test-type",
			syncPointers: {
				"test-type": expect.stringMatching(/^blob:memory:[\da-f]{64}$/)
			}
		});

		const syncStateBlobId = verifiable.syncPointers["test-type"];

		const blobStorageStore = await blobStorageConnector.getStore();
		const blobs: { [id: string]: string } = {};
		for (const blobKey in blobStorageStore) {
			blobs[blobKey] = Converter.bytesToBase64(blobStorageStore[blobKey]);
		}
		expect(Object.keys(blobs)).toHaveLength(2);

		const syncStateBlobKey = `root/${syncStateBlobId.split(":")[2]}`;
		expect(blobs[syncStateBlobKey]).toEqual(expect.any(String));

		expect(await expandObject(blobs[syncStateBlobKey])).toEqual({
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: expect.stringMatching(/^[\da-f]{64}$/),
					dateCreated: "2025-05-29T01:00:00.000Z",
					dateModified: "2025-05-29T01:00:00.000Z",
					isConsolidated: false,
					epoch: 1,
					changeSetStorageIds: [expect.stringMatching(/^blob:memory:[\da-f]{64}$/)]
				}
			]
		});

		const syncState = await expandObject<ISyncState>(blobs[syncStateBlobKey]);
		const changeSetBlobId = syncState.snapshots[0].changeSetStorageIds[0];
		const changeSetBlobKey = `root/${changeSetBlobId.split(":")[2]}`;
		expect(blobs[changeSetBlobKey]).toEqual(expect.any(String));

		expect(await expandObject(blobs[changeSetBlobKey])).toEqual({
			"@context": SynchronisedStorageContexts.Namespace,
			type: SynchronisedStorageTypes.ChangeSet,
			changes: [
				{
					entity: {
						dateModified: "2025-01-01T00:00:00.000Z"
					},
					id: "test-id-1",
					operation: "set"
				}
			],
			dateCreated: "2025-05-29T01:00:00.000Z",
			dateModified: "2025-05-29T01:00:00.000Z",
			id: expect.stringMatching(/^[\da-f]{64}$/),
			nodeIdentity: testNodeIdUntrusted,
			storageKey: "test-type"
		});
	});

	describe("consolidation behavior", () => {
		test("can handle multiple snapshots with consolidation present", async () => {
			const connector = new SynchronisedStorageService({
				loggingComponentType: "logging",
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start("logging");

			// Create multiple changesets - some before consolidation, some after
			const changeSet1: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "1111111111111111111111111111111111111111111111111111111111111111",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-01T00:00:00.000Z" },
						id: "test-id-1",
						operation: "set"
					}
				]
			};

			const changeSet2: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "2222222222222222222222222222222222222222222222222222222222222222",
				dateCreated: "2025-05-29T02:00:00.000Z",
				dateModified: "2025-05-29T02:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-02T00:00:00.000Z" },
						id: "test-id-2",
						operation: "set"
					}
				]
			};

			const changeSet3: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "3333333333333333333333333333333333333333333333333333333333333333",
				dateCreated: "2025-05-29T04:00:00.000Z",
				dateModified: "2025-05-29T04:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-03T00:00:00.000Z" },
						id: "test-id-3",
						operation: "set"
					}
				]
			};

			// Store changesets
			const blobChangeSetId1 = await blobStorageConnector.set(await compressObject(changeSet1));
			const blobChangeSetId2 = await blobStorageConnector.set(await compressObject(changeSet2));
			const blobChangeSetId3 = await blobStorageConnector.set(await compressObject(changeSet3));

			// Create sync state with consolidation in the middle
			const syncState: ISyncState = {
				version: "1",
				storageKey: "test-type",
				snapshots: [
					// Latest snapshot (post-consolidation)
					{
						version: "1",
						id: "snapshot-3",
						dateCreated: "2025-05-29T04:00:00.000Z",
						dateModified: "2025-05-29T04:00:00.000Z",
						isConsolidated: false,
						epoch: 2,
						changeSetStorageIds: [blobChangeSetId3]
					},
					// Consolidation snapshot
					{
						version: "1",
						id: "snapshot-consolidated",
						dateCreated: "2025-05-29T03:00:00.000Z",
						dateModified: "2025-05-29T03:00:00.000Z",
						isConsolidated: true,
						epoch: 1,
						changeSetStorageIds: [blobChangeSetId1, blobChangeSetId2]
					},
					// Older snapshot (should be ignored due to consolidation)
					{
						version: "1",
						id: "snapshot-1",
						dateCreated: "2025-05-29T01:00:00.000Z",
						dateModified: "2025-05-29T01:00:00.000Z",
						isConsolidated: false,
						epoch: 0,
						changeSetStorageIds: [blobChangeSetId1]
					}
				]
			};

			const blobSnapshotId = await blobStorageConnector.set(await compressObject(syncState));

			const verifiableSyncPointerStore: ISyncPointerStore = {
				version: "1",
				syncPointers: {
					"test-type": blobSnapshotId
				}
			};

			await verifiableStorage.set({
				id: verifiableStorageKeyId.split(":")[2],
				creator: testNodeId,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeId],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 25);

			const logStore = await loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should trigger full sync and process consolidation
			expect(logMessages).toContain("applySnapshotNoExisting");
			expect(logMessages).toContain("applySnapshotFoundConsolidated");
			expect(logMessages).toContain("storageReset");

			// Verify all three changesets were processed (consolidation contains first two, plus the third)
			const processNewSnapshotCount = logMessages.filter(
				msg => msg === "processNewSnapshot"
			).length;
			expect(processNewSnapshotCount).toBe(2); // Consolidation + post-consolidation snapshot

			// Verify local snapshots contain only processed ones (consolidation + post-consolidation)
			const localSnapshots = await syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(2);
			expect(localSnapshots.some(s => s.id === "snapshot-consolidated")).toBe(true);
			expect(localSnapshots.some(s => s.id === "snapshot-3")).toBe(true);
			expect(localSnapshots.some(s => s.id === "snapshot-1")).toBe(false); // Should not be stored (pre-consolidation)
		});

		test("can handle sync with no consolidation available", async () => {
			const connector = new SynchronisedStorageService({
				loggingComponentType: "logging",
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start("logging");

			const changeSet: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-01T00:00:00.000Z" },
						id: "test-id-1",
						operation: "set"
					}
				]
			};

			const blobChangeSetId = await blobStorageConnector.set(await compressObject(changeSet));

			// Create sync state with NO consolidation
			const syncState: ISyncState = {
				version: "1",
				storageKey: "test-type",
				snapshots: [
					{
						version: "1",
						id: "snapshot-no-consolidation",
						dateCreated: "2025-05-29T01:00:00.000Z",
						dateModified: "2025-05-29T01:00:00.000Z",
						isConsolidated: false,
						epoch: 0,
						changeSetStorageIds: [blobChangeSetId]
					}
				]
			};

			const blobSnapshotId = await blobStorageConnector.set(await compressObject(syncState));

			const verifiableSyncPointerStore: ISyncPointerStore = {
				version: "1",
				syncPointers: {
					"test-type": blobSnapshotId
				}
			};

			await verifiableStorage.set({
				id: verifiableStorageKeyId.split(":")[2],
				creator: testNodeId,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeId],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 15);

			const logStore = await loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should trigger full sync attempt but find no consolidation
			expect(logMessages).toContain("applySnapshotNoExisting");
			expect(logMessages).toContain("applySnapshotNoConsolidated");
			expect(logMessages).not.toContain("applySnapshotFoundConsolidated");
			expect(logMessages).not.toContain("processNewSnapshot");

			// No snapshots should be stored locally since no consolidation was available
			const localSnapshots = await syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(0);
		});

		test("can handle incremental sync with consolidation already present", async () => {
			const connector = new SynchronisedStorageService({
				loggingComponentType: "logging",
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start("logging");

			// Pre-populate local storage with a consolidated snapshot
			const existingConsolidation: SyncSnapshotEntry = {
				version: "1",
				id: "existing-consolidation",
				storageKey: "test-type",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				isLocal: false,
				isConsolidated: true,
				epoch: 0,
				changeSetStorageIds: []
			};
			await syncSnapshotStorageConnector.set(existingConsolidation);

			// Create a new changeset for incremental sync
			const changeSet: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
				dateCreated: "2025-05-29T02:00:00.000Z",
				dateModified: "2025-05-29T02:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-02T00:00:00.000Z" },
						id: "test-id-2",
						operation: "set"
					}
				]
			};

			const blobChangeSetId = await blobStorageConnector.set(await compressObject(changeSet));

			// Sync state with incremental change (no gap from existing consolidation)
			const syncState: ISyncState = {
				version: "1",
				storageKey: "test-type",
				snapshots: [
					// New incremental snapshot
					{
						version: "1",
						id: "incremental-snapshot",
						dateCreated: "2025-05-29T02:00:00.000Z",
						dateModified: "2025-05-29T02:00:00.000Z",
						isConsolidated: false,
						epoch: 1, // Consecutive to existing epoch 0
						changeSetStorageIds: [blobChangeSetId]
					},
					// Existing consolidation (unchanged, same as local)
					{
						version: "1",
						id: "existing-consolidation",
						dateCreated: "2025-05-29T01:00:00.000Z",
						dateModified: "2025-05-29T01:00:00.000Z",
						isConsolidated: true,
						epoch: 0,
						changeSetStorageIds: []
					}
				]
			};

			const blobSnapshotId = await blobStorageConnector.set(await compressObject(syncState));

			const verifiableSyncPointerStore: ISyncPointerStore = {
				version: "1",
				syncPointers: {
					"test-type": blobSnapshotId
				}
			};

			await verifiableStorage.set({
				id: verifiableStorageKeyId.split(":")[2],
				creator: testNodeId,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeId],
				maxAllowListSize: 100
			});

			// Trigger sync
			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 20);

			const logStore = await loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should NOT trigger full sync (no "applySnapshotNoExisting")
			expect(logMessages).not.toContain("applySnapshotNoExisting");
			expect(logMessages).not.toContain("applySnapshotFoundConsolidated");
			expect(logMessages).not.toContain("storageReset");

			// Should use incremental sync path
			expect(logMessages).toContain("applySyncState");
			expect(logMessages).toContain("applySnapshot");
			expect(logMessages).toContain("processNewSnapshot");

			// Should have both snapshots stored locally
			const localSnapshots = await syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(2);
			expect(localSnapshots.some(s => s.id === "existing-consolidation")).toBe(true);
			expect(localSnapshots.some(s => s.id === "incremental-snapshot")).toBe(true);
		});

		test("can handle epoch gap requiring full sync", async () => {
			const connector = new SynchronisedStorageService({
				loggingComponentType: "logging",
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start("logging");

			// Simulate existing local state at epoch 5
			const existingSnapshot: SyncSnapshotEntry = {
				version: "1",
				id: "existing-local",
				storageKey: "test-type",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				isLocal: false,
				isConsolidated: true,
				epoch: 5,
				changeSetStorageIds: []
			};
			await syncSnapshotStorageConnector.set(existingSnapshot);

			const changeSet: ISyncChangeSet = {
				"@context": SynchronisedStorageContexts.Namespace,
				type: SynchronisedStorageTypes.ChangeSet,
				id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
				dateCreated: "2025-05-29T03:00:00.000Z",
				dateModified: "2025-05-29T03:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-01T00:00:00.000Z" },
						id: "test-id-gap",
						operation: "set"
					}
				]
			};

			const blobChangeSetId = await blobStorageConnector.set(await compressObject(changeSet));

			// Remote sync state starting at epoch 10 (gap from local epoch 5)
			const syncState: ISyncState = {
				version: "1",
				storageKey: "test-type",
				snapshots: [
					{
						version: "1",
						id: "gap-consolidation",
						dateCreated: "2025-05-29T03:00:00.000Z",
						dateModified: "2025-05-29T03:00:00.000Z",
						isConsolidated: true,
						epoch: 10, // Gap: local has epoch 5, remote starts at 10
						changeSetStorageIds: [blobChangeSetId]
					}
				]
			};

			const blobSnapshotId = await blobStorageConnector.set(await compressObject(syncState));

			const verifiableSyncPointerStore: ISyncPointerStore = {
				version: "1",
				syncPointers: {
					"test-type": blobSnapshotId
				}
			};

			await verifiableStorage.set({
				id: verifiableStorageKeyId.split(":")[2],
				creator: testNodeId,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeId],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 25);

			const logStore = await loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should detect epoch gap and trigger full sync
			expect(logMessages).toContain("applySnapshotNoExisting");
			expect(logMessages).toContain("applySnapshotFoundConsolidated");
			expect(logMessages).toContain("storageReset");

			// Should have the new consolidation snapshot
			const localSnapshots = await syncSnapshotStorageConnector.getStore();
			expect(localSnapshots.length).toBeGreaterThan(0);
			expect(localSnapshots.some(s => s.id === "gap-consolidation")).toBe(true);
			const gapConsolidation = localSnapshots.find(s => s.id === "gap-consolidation");
			expect(gapConsolidation?.epoch).toBe(10);
		});
	});
});
