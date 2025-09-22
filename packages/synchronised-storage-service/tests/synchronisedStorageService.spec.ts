// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { TaskSchedulerService } from "@twin.org/background-task-scheduler";
import { MemoryBlobStorageConnector } from "@twin.org/blob-storage-connector-memory";
import { BlobStorageConnectorFactory } from "@twin.org/blob-storage-models";
import { initSchema as initSchemaBlobStorage } from "@twin.org/blob-storage-service";
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
import type { IPolicyEnforcementPointComponent } from "@twin.org/rights-management-models";
import {
	type ISyncChangeSet,
	type ISyncItemChange,
	type ISyncItemRequest,
	type ISyncItemResponse,
	type ISyncItemSet,
	type ISyncRegisterStorageKey,
	SynchronisedStorageTopics
} from "@twin.org/synchronised-storage-models";
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
import type { SyncSnapshotEntry } from "../src/entities/syncSnapshotEntry";
import type { ISyncPointerStore } from "../src/models/ISyncPointerStore";
import type { ISyncState } from "../src/models/ISyncState";
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
let testNodeIdentity: string;
let testNodeIdentityUntrusted: string;

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
	let logEntries: LogEntry[] = [];
	do {
		logEntries = store.getStore();
		await new Promise(resolve => setTimeout(resolve, 100));
		if (logEntries.length >= count) {
			return;
		}
		retries++;
	} while (retries < 100);

	throw new Error("Failed while waiting for log entries");
}

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

		blobStorageConnector = new MemoryBlobStorageConnector();
		BlobStorageConnectorFactory.register("blob-storage", () => blobStorageConnector);

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

		eventBusUntrustedConnector = new LocalEventBusConnector();
		EventBusConnectorFactory.register("local-untrusted", () => eventBusUntrustedConnector);

		eventBusUntrustedService = new EventBusService({
			eventBusConnectorType: "local-untrusted"
		});
		ComponentFactory.register("event-bus-untrusted", () => eventBusUntrustedService);

		const taskSchedulerComponent = new TaskSchedulerService({ config: { overrideInterval: 0.5 } });
		ComponentFactory.register("task-scheduler", () => taskSchedulerComponent);

		loggingMemoryEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>()
		});
		EntityStorageConnectorFactory.register("log-entry", () => loggingMemoryEntityStorage);
		LoggingConnectorFactory.register("logging", () => new EntityStorageLoggingConnector());

		loggingUntrustedMemoryEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>()
		});
		EntityStorageConnectorFactory.register(
			"log-entry-untrusted",
			() => loggingUntrustedMemoryEntityStorage
		);
		LoggingConnectorFactory.register(
			"logging-untrusted",
			() =>
				new EntityStorageLoggingConnector({ logEntryStorageConnectorType: "log-entry-untrusted" })
		);

		const loggingService = new LoggingService({ loggingConnectorType: "logging" });
		ComponentFactory.register("logging", () => loggingService);

		const loggingUntrustedService = new LoggingService({
			loggingConnectorType: "logging-untrusted"
		});
		ComponentFactory.register("logging-untrusted", () => loggingUntrustedService);

		const policyEnforcementPointComponent = {} as IPolicyEnforcementPointComponent;
		policyEnforcementPointComponent.intercept = vi.fn().mockImplementation(async () => true);
		ComponentFactory.register("policy-enforcement-point", () => policyEnforcementPointComponent);

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

		await vaultConnector.addKey(
			"synchronised-storage-blob-encryption-key",
			VaultKeyType.ChaCha20Poly1305,
			mockChaCha20Poly1305Key
		);

		const didDocument = await identityConnector.createDocument("test-node-identity");
		testNodeIdentity = didDocument.id;

		await identityConnector.addVerificationMethod(
			"test-node-identity",
			didDocument.id,
			"assertionMethod",
			"synchronised-storage-assertion"
		);

		const didDocumentUntrusted = await identityConnector.createDocument(
			"test-node-identity-untrusted"
		);
		testNodeIdentityUntrusted = didDocumentUntrusted.id;

		await identityConnector.addVerificationMethod(
			"test-node-identity-untrusted",
			didDocumentUntrusted.id,
			"assertionMethod",
			"synchronised-storage-assertion"
		);
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
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await connector.start(testNodeIdentity, "logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		const logStore = loggingMemoryEntityStorage.getStore();
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
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await connector.start(testNodeIdentity, "logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		const logStore = loggingMemoryEntityStorage.getStore();
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
			config: { verifiableStorageKeyId, consolidationIntervalMinutes: 0 }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			id: "test-id-1",
			storageKey: "test-type",
			nodeIdentity: testNodeIdentity,
			operation: "set"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
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

		const logStore = loggingMemoryEntityStorage.getStore();
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
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "logging");

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeIdentity: testNodeIdentity,
			operation: "set"
		});

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeIdentity: testNodeIdentity,
			operation: "delete"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
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

		const logStore = loggingMemoryEntityStorage.getStore();
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
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "logging");

		await verifiableStorage.set({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeIdentity,
			data: Converter.bytesToBase64(
				ObjectHelper.toBytes({ version: "1", storageKey: "test-type", syncPointers: {} })
			),
			allowList: [testNodeIdentity],
			maxAllowListSize: 100
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
							dateModified: new Date("2025-01-01T00:00:00Z").toISOString()
						}
					}
				);
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			storageKey: "test-type",
			id: "test-id-1",
			nodeIdentity: testNodeIdentity,
			operation: "set"
		});

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				version: "1",
				id: "e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3",
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

		await waitForLogEntries(loggingMemoryEntityStorage, 20);

		const logStore = loggingMemoryEntityStorage.getStore();
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

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				id: verifiableStorageKeyId.split(":")[2],
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(
					ObjectHelper.toBytes({
						version: "1",
						storageKey: "test-type",
						syncPointers: {
							"test-type":
								"blob:memory:a8b3e69ac565ae2bf946bca334d287551a3df9c3d463c5789dd8f48dca33b7be"
						}
					})
				),
				allowList: [testNodeIdentity],
				maxAllowListSize: 100
			}
		]);

		const verifiable = ObjectHelper.fromBytes(Converter.base64ToBytes(verifiableStore[0].data));
		expect(verifiable).toEqual({
			version: "1",
			storageKey: "test-type",
			syncPointers: {
				"test-type": "blob:memory:a8b3e69ac565ae2bf946bca334d287551a3df9c3d463c5789dd8f48dca33b7be"
			}
		});

		const localSnapshots2 = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots2).toEqual([]);

		const blobStorageStore = blobStorageConnector.getStore();
		const blobs: { [id: string]: string } = {};
		for (const blobKey in blobStorageStore) {
			blobs[blobKey] = Converter.bytesToBase64(blobStorageStore[blobKey]);
		}
		expect(blobs).toEqual({
			"24c18fa74b897bff3010f1265494f2bc6213d4461284be0a4c364a8354248d1b":
				"/f39/f39/f39/f39uWjCVJIFMADDLRdUownwv4wB7Dlo/5W/R9ysXE6c0sxavjNXQ6qgvNYHLHuFYenWiYV4aNswyhFiIzSDbjDVVVpx1q07aB50SKt9lZEJcdomRl5wfBknQ+LWpUzFNS5j1f7xPchR0o9ptCO+aObOdE/6ygaaNkdn13JaOV/ShyeJA4aYuDh/3fIOs9Rd4GqLBfKGAg9CP1jVPrqWVXVH4afmY4un+axZ5JCf7JtOGh2g4RL7Gnhj3S1bON9uUmewYQ==",
			a8b3e69ac565ae2bf946bca334d287551a3df9c3d463c5789dd8f48dca33b7be:
				"BgYGBgYGBgYGBgYGLJGq0yTxbedRsJj86OTT/oa8GlFBm5GaaCeujPqn4br/MJ3CRyJECxWAxmNYlIbO8IYtSFmtTi1idIW005yh1fsovXzpTtrCa/WP7xpbcJMm+h16ruBFw2Z/Ez7LT/x5daa/O1LgSExlfL9rgZTih39uB0I8Q5NkBb9DVOAhrL6C8QW5EFn2lHuhkt5khzIOC3LEoACnGICcPnXGCvN+r69q1h6yEeGGgWmPOaNohZw6IdcnlIf+t7Yx+Atq6gqc6BpcHoBLAgq01GL8kFpmeM8O+s0SV3b4DcEwGrRymvTss3bSB1uz0JpWJ9a7l14D5+I="
		});

		expect(
			await expandObject(blobs["24c18fa74b897bff3010f1265494f2bc6213d4461284be0a4c364a8354248d1b"])
		).toEqual({
			id: "fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa",
			dateCreated: "2025-05-29T01:00:00.000Z",
			dateModified: "2025-05-29T01:00:00.000Z",
			storageKey: "test-type",
			nodeIdentity: testNodeIdentity,
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

		expect(
			await expandObject(blobs.a8b3e69ac565ae2bf946bca334d287551a3df9c3d463c5789dd8f48dca33b7be)
		).toEqual({
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: "0303030303030303030303030303030303030303030303030303030303030303",
					dateCreated: "2025-05-29T01:00:00.000Z",
					dateModified: "2025-05-29T01:00:00.000Z",
					isConsolidated: false,
					epoch: 1,
					changeSetStorageIds: [
						"blob:memory:24c18fa74b897bff3010f1265494f2bc6213d4461284be0a4c364a8354248d1b"
					]
				}
			]
		});
	});

	test("can receive the updates from a remote sync state", async () => {
		const connector = new SynchronisedStorageService({
			config: {
				verifiableStorageKeyId,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
		await connector.start(testNodeIdentity, "logging");

		let remoteData;

		await eventBusConnector.subscribe<ISyncItemSet>(
			SynchronisedStorageTopics.RemoteItemSet,
			async e => {
				remoteData = e;
			}
		);

		const changeSet: ISyncChangeSet = {
			id: "fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa",
			dateCreated: "2025-05-29T01:00:00.000Z",
			dateModified: "2025-05-29T01:00:00.000Z",
			storageKey: "test-type",
			nodeIdentity: testNodeIdentityUntrusted,
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
			creator: testNodeIdentity,
			data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
			allowList: [testNodeIdentity],
			maxAllowListSize: 100
		});

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		const logStore = loggingMemoryEntityStorage.getStore();
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
					nodeIdentity: testNodeIdentityUntrusted
				},
				storageKey: "test-type"
			},
			id: expect.any(String),
			topic: "synchronised-storage:remote-item-set",
			ts: expect.any(Number)
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
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
				changeSetStorageIds: [
					"blob:memory:04c963537b06da8492d555eab4eeddfe0a4385620d33d2e4e683f7d3c1d04182"
				]
			}
		]);
	});

	test("can use a trusted node to synchronise a non trusted node", async () => {
		const connectorTrusted = new SynchronisedStorageService({
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

		await connector.start(testNodeIdentityUntrusted, "logging");
		await connectorTrusted.start(testNodeIdentity, "logging");

		await verifiableStorage.set({
			id: verifiableStorageKeyId.split(":")[2],
			creator: testNodeIdentity,
			data: Converter.bytesToBase64(
				ObjectHelper.toBytes({ version: "1", storageKey: "test-type", syncPointers: {} })
			),
			allowList: [testNodeIdentity],
			maxAllowListSize: 100
		});

		await eventBusUntrustedConnector.subscribe<ISyncItemRequest>(
			SynchronisedStorageTopics.LocalItemRequest,
			async request => {
				await eventBusUntrustedConnector.publish<ISyncItemResponse<TestType>>(
					SynchronisedStorageTopics.LocalItemResponse,
					{
						storageKey: "test-type",
						id: "test-id-1",
						entity: {
							id: "test-id-1",
							nodeIdentity: testNodeIdentity,
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
				nodeIdentity: testNodeIdentityUntrusted,
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

		const logStoreUntrusted = loggingUntrustedMemoryEntityStorage.getStore();
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

		const logStore = loggingMemoryEntityStorage.getStore();
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

		expect(verifiableStorage.getStore()).toEqual([
			{
				id: "11111111111111111111111111111111",
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(
					ObjectHelper.toBytes({
						version: "1",
						storageKey: "test-type",
						syncPointers: {
							"test-type":
								"blob:memory:00a0c0aa0b3b82e45649dc8d4b29078de5c849d92b356c5353a8d28995aefa26"
						}
					})
				),
				allowList: [testNodeIdentity],
				maxAllowListSize: 100
			}
		]);

		const blobStorageStore = blobStorageConnector.getStore();
		const blobs: { [id: string]: string } = {};
		for (const blobKey in blobStorageStore) {
			blobs[blobKey] = Converter.bytesToBase64(blobStorageStore[blobKey]);
		}
		expect(blobs).toEqual({
			"00a0c0aa0b3b82e45649dc8d4b29078de5c849d92b356c5353a8d28995aefa26":
				"FhYWFhYWFhYWFhYWO94qTmu3QuM52+UPLiCXOcDcPAu6P3UYkwX5R2odf6U5+RSKXbUD63AQc2X9YB4xv8M9zuwFr6+X9Ege6QFnW/ADheOgat8ZMoa63knaMUFSDkqbvlJEfpcX5VwLshNUnNx7erxz7K9Eut1yf1dTdOjtMSVWFkq94ebqeR1EYvQqNLO/vw0oS1RuN7f0hiTvX/dBmRfTQcYauGMo2LX1qDU3CTQSt0DNgmUhuDh1ohcLfuAGUFPG7bz5EvY6llQRLQ5Gksn88W7jY+DZ8Z5v8bwE7DSywSri75WytG50vuj2G/1XTlmJHiAJlC4Ort78ug==",
			d0337d36984d1b1fd4b0a586b8f26bb305cb8bbe654a59e353380558b1a15625:
				"CwsLCwsLCwsLCwsLCcnLtDtqrO6baeZO+nzd3Vg1Sar0TNO3eeipk8pnfsbUG4zQBGeMikh8E7ycjhEqM6HAPVkZexodu2DZaly/+fPQCb7NCEpvhxvzHJm9Tjb4vSln6VgqNVMshRgvdqjiKL/Hdc+Mmrg/P4BSNO+JUFam2X/gMoLr7FSdg6xILpp16mXHvF2QA1sOsrZS/S7Kjr3AEbADGZ/mJUfybJU7Gzi9fCH76ltpkN2M2ArHVKO7ScTSJQjrDd4HLvvtBjztcA=="
		});

		expect(
			await expandObject(blobs["00a0c0aa0b3b82e45649dc8d4b29078de5c849d92b356c5353a8d28995aefa26"])
		).toEqual({
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: "1313131313131313131313131313131313131313131313131313131313131313",
					dateCreated: "2025-05-29T01:00:00.000Z",
					dateModified: "2025-05-29T01:00:00.000Z",
					isConsolidated: false,
					epoch: 1,
					changeSetStorageIds: [
						"blob:memory:d0337d36984d1b1fd4b0a586b8f26bb305cb8bbe654a59e353380558b1a15625"
					]
				}
			]
		});

		expect(
			await expandObject(blobs.d0337d36984d1b1fd4b0a586b8f26bb305cb8bbe654a59e353380558b1a15625)
		).toEqual({
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
			id: "0808080808080808080808080808080808080808080808080808080808080808",
			nodeIdentity:
				"did:entity-storage:0xd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
			storageKey: "test-type"
		});
	});

	describe("consolidation behavior", () => {
		test("can handle multiple snapshots with consolidation present", async () => {
			const connector = new SynchronisedStorageService({
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start(testNodeIdentity, "logging");

			// Create multiple changesets - some before consolidation, some after
			const changeSet1: ISyncChangeSet = {
				id: "1111111111111111111111111111111111111111111111111111111111111111",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-01T00:00:00.000Z" },
						id: "test-id-1",
						operation: "set"
					}
				]
			};

			const changeSet2: ISyncChangeSet = {
				id: "2222222222222222222222222222222222222222222222222222222222222222",
				dateCreated: "2025-05-29T02:00:00.000Z",
				dateModified: "2025-05-29T02:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
				changes: [
					{
						entity: { dateModified: "2025-01-02T00:00:00.000Z" },
						id: "test-id-2",
						operation: "set"
					}
				]
			};

			const changeSet3: ISyncChangeSet = {
				id: "3333333333333333333333333333333333333333333333333333333333333333",
				dateCreated: "2025-05-29T04:00:00.000Z",
				dateModified: "2025-05-29T04:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
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
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeIdentity],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 25);

			const logStore = loggingMemoryEntityStorage.getStore();
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
			const localSnapshots = syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(2);
			expect(localSnapshots.some(s => s.id === "snapshot-consolidated")).toBe(true);
			expect(localSnapshots.some(s => s.id === "snapshot-3")).toBe(true);
			expect(localSnapshots.some(s => s.id === "snapshot-1")).toBe(false); // Should not be stored (pre-consolidation)
		});

		test("can handle sync with no consolidation available", async () => {
			const connector = new SynchronisedStorageService({
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start(testNodeIdentity, "logging");

			const changeSet: ISyncChangeSet = {
				id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				dateCreated: "2025-05-29T01:00:00.000Z",
				dateModified: "2025-05-29T01:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
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
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeIdentity],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 15);

			const logStore = loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should trigger full sync attempt but find no consolidation
			expect(logMessages).toContain("applySnapshotNoExisting");
			expect(logMessages).toContain("applySnapshotNoConsolidated");
			expect(logMessages).not.toContain("applySnapshotFoundConsolidated");
			expect(logMessages).not.toContain("processNewSnapshot");

			// No snapshots should be stored locally since no consolidation was available
			const localSnapshots = syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(0);
		});

		test("can handle incremental sync with consolidation already present", async () => {
			const connector = new SynchronisedStorageService({
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start(testNodeIdentity, "logging");

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
				id: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
				dateCreated: "2025-05-29T02:00:00.000Z",
				dateModified: "2025-05-29T02:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
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
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeIdentity],
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

			const logStore = loggingMemoryEntityStorage.getStore();
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
			const localSnapshots = syncSnapshotStorageConnector.getStore();
			expect(localSnapshots).toHaveLength(2);
			expect(localSnapshots.some(s => s.id === "existing-consolidation")).toBe(true);
			expect(localSnapshots.some(s => s.id === "incremental-snapshot")).toBe(true);
		});

		test("can handle epoch gap requiring full sync", async () => {
			const connector = new SynchronisedStorageService({
				config: {
					verifiableStorageKeyId,
					consolidationIntervalMinutes: 0
				}
			});
			await connector.start(testNodeIdentity, "logging");

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
				id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
				dateCreated: "2025-05-29T03:00:00.000Z",
				dateModified: "2025-05-29T03:00:00.000Z",
				storageKey: "test-type",
				nodeIdentity: testNodeIdentityUntrusted,
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
				creator: testNodeIdentity,
				data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
				allowList: [testNodeIdentity],
				maxAllowListSize: 100
			});

			await eventBusConnector.publish<ISyncRegisterStorageKey>(
				SynchronisedStorageTopics.RegisterStorageKey,
				{
					storageKey: "test-type"
				}
			);

			await waitForLogEntries(loggingMemoryEntityStorage, 25);

			const logStore = loggingMemoryEntityStorage.getStore();
			const logMessages = logStore.map(e => e.message);

			// Should detect epoch gap and trigger full sync
			expect(logMessages).toContain("applySnapshotNoExisting");
			expect(logMessages).toContain("applySnapshotFoundConsolidated");
			expect(logMessages).toContain("storageReset");

			// Should have the new consolidation snapshot
			const localSnapshots = syncSnapshotStorageConnector.getStore();
			expect(localSnapshots.length).toBeGreaterThan(0);
			expect(localSnapshots.some(s => s.id === "gap-consolidation")).toBe(true);
			const gapConsolidation = localSnapshots.find(s => s.id === "gap-consolidation");
			expect(gapConsolidation?.epoch).toBe(10);
		});
	});
});
