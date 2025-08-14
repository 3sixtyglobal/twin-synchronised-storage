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
	RandomHelper
} from "@twin.org/core";
import { Bip39, RSA } from "@twin.org/crypto";
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
	SynchronisedStorageTopics
} from "@twin.org/synchronised-storage-models";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultEncryptionType, VaultKeyType } from "@twin.org/vault-models";
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

// Mock RSA class
vi.mock("@twin.org/crypto", async () => {
	const actual = await vi.importActual("@twin.org/crypto");
	return {
		...actual,
		RSA: vi.fn()
	};
});

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

const mockPrivateRsaKey = Converter.base64ToBytes(
	"MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDgUQ5bM0VTxi3wXJHnHeUmfaYw4bCuHKsscfQls2zlrmx6Axf7K8WLKPElYqOC6HcRSXEvOlqJZggHBmYOXoZnOzujRiL6UuInRxDC9BfI/hK4sauL3BrrM7ateIXNtG/UXle605QQP4I2z79lDRacnhCpr7vzF5jBWW0kIZQ98HV3RE1tSuIUGNO23B4RofWe7TCrVnTCxSY02fDLYxkwfUpZ0UdH2MgukdROm32L9/bAdf7fPM7K71RqevmpDF9eZTCVizWuFXKYRwlzpkNIJJ0ewqph+/JQMNFL7IEHYY5bM6GUEHSG+n+rCp+JkO5/icIBVXVrXJq6+tdEEoftAgMBAAECggEADObsnfdFeguQkd4pMDNqfjvE5tPcXy9b8xr80XxP+6f8KkpqQzKh0p7AvAc/42QukQp53Z8MHRIGzSyjixkJvv9Lr1j14xMIWfz+7E+w3Iksl330oX8/9x5K2BByFcJWmk7w2diYkBSvDysE1bGahtiamb/3XgSR7zEPE4Bw79z8umFsh01gzEa+MPwYDiRuO0b0QUpi28/i+pL8OLQfC/QI/4JRePaDcF2uq06/OfTTf7W3bLBVoTBkaMj9gpviSjerTkkigWdZX6AVfdZsrrfdetxD+JhLmZj9/UPzqUsQiqN4kuUNfBgN182vKvm2XyRONXrWz6TXsn6BFGAiEQKBgQD0GJ+XehU/dSyov6ResSD5DG9fjW2GH8xEvKfAESUbVOXY/NfRKUkZL5afUk/fUEFFrwJq4wpF48VYPAFzI1dWJd8Z9SkG/5ZXaNb9bUlKjxKe8m8hakC0m8XZfw66D2dOvgj72HKIDuR4x/j35PbBqZ/s2poQlLXj3fSZl+lmlQKBgQDrQX+Ixa4KAjWVpHId1CCo7DFPYqmpHRkWANcqiNiDB/et+RYN4xHqFsbX4HTfjWBGVvJC+IMxxLJH5KAl8UoUP/aNNOFmB02ldX5NBf7O4OX4sNfGKtF4L4E82c7OqQNCHOk7dRSCRr6GTWtwP6gs+zhIakTMEXQyi4O0xFt9+QKBgQCJw4vu9hwf4IYAB4lBWD7/0KDbEPsLg87JzJ/wqryCnHvM54b2qZJ0AIPGD7K8mpL8PTXkFZeqsk6i6dr3nK6iFGXCRLePF5lGZAlSpueCiRU9WB6YgVtbk78qbadmI2Nu8ZooaZTabW1NLa+6WSNbUdzM1OO3D/dIT/DI7w/vsQKBgQCvtPe/+4UFTKkg3vWseab7A43AsPvupyD5Yh9SUWsEUosWkRd7v8C9ic1xpt8jqL/jSUUf5+R042gUchl6vUCK50sKJBjEz2ea0KpIdNXfRfH9UHeYNprEnRZ1kGf5yhn44wb/tW5f7t6WCHTaHXFKR0e+LkC7+b1DkxgHhzCeYQKBgQCGdQUsjBlQWghft7EK6fu9CQm8T4m+VsNSCd4JEG+Q5Gxa7K2uTv8I2OlMBOKUELtAV36y65B0+kRn6g9/8sU4uKXRXQYQfCcGHksBI2NbbvnoH4ynTg6r8nbNvF4B+J7Hl4SarwVJ8k8oqKrEnfiMVwVOPgRGdWTPK7hbBhvasA=="
);
const mockPublicRsaKey = Converter.base64ToBytes(
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4FEOWzNFU8Yt8FyR5x3lJn2mMOGwrhyrLHH0JbNs5a5segMX+yvFiyjxJWKjguh3EUlxLzpaiWYIBwZmDl6GZzs7o0Yi+lLiJ0cQwvQXyP4SuLGri9wa6zO2rXiFzbRv1F5XutOUED+CNs+/ZQ0WnJ4Qqa+78xeYwVltJCGUPfB1d0RNbUriFBjTttweEaH1nu0wq1Z0wsUmNNnwy2MZMH1KWdFHR9jILpHUTpt9i/f2wHX+3zzOyu9Uanr5qQxfXmUwlYs1rhVymEcJc6ZDSCSdHsKqYfvyUDDRS+yBB2GOWzOhlBB0hvp/qwqfiZDuf4nCAVV1a1yauvrXRBKH7QIDAQAB"
);

/**
 * Decompress a compressed string into an ISyncPointerStore object.
 * @param compacted The compressed string to decompress in base64.
 * @returns The decompressed object.
 */
async function expandObject<T>(compacted: string): Promise<T> {
	// Otherwise we need the public key stored as a secret in the vault
	const rsa = new RSA(mockPublicRsaKey);
	const compressedBlob = rsa.decrypt(Converter.base64ToBytes(compacted));

	const decompressedBlob = await Compression.decompress(compressedBlob, CompressionType.Gzip);

	return ObjectHelper.fromBytes<T>(decompressedBlob);
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

	// eslint-disable-next-line no-restricted-syntax
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

		// Store original methods
		const originalEncrypt = vaultConnector.encrypt.bind(vaultConnector);
		const originalDecrypt = vaultConnector.decrypt.bind(vaultConnector);

		// Mock the vault connector methods to use our mocked RSA
		vaultConnector.encrypt = vi
			.fn()
			.mockImplementation(
				async (keyName: string, encryptionType: VaultEncryptionType, data: Uint8Array) => {
					if (encryptionType === VaultEncryptionType.Rsa2048) {
						const rsa = new RSA(mockPublicRsaKey, mockPrivateRsaKey);
						return rsa.encrypt(data);
					}
					// Fallback to original implementation for other encryption types
					return originalEncrypt(keyName, encryptionType, data);
				}
			);

		vaultConnector.decrypt = vi
			.fn()
			.mockImplementation(
				async (keyName: string, encryptionType: VaultEncryptionType, encryptedData: Uint8Array) => {
					if (encryptionType === VaultEncryptionType.Rsa2048) {
						const rsa = new RSA(mockPublicRsaKey, mockPrivateRsaKey);
						return rsa.decrypt(encryptedData);
					}
					// Fallback to original implementation for other encryption types
					return originalDecrypt(keyName, encryptionType, encryptedData);
				}
			);

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

		// Mock RSA constructor and instance methods
		const mockRSAInstance = {
			encrypt: vi.fn().mockImplementation((data: Uint8Array) => {
				// Return mock encrypted data (just add prefix for testing)
				const mockEncrypted = new Uint8Array(data.length + 8);
				mockEncrypted.set([0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee], 0); // Mock prefix
				mockEncrypted.set(data, 8);
				return mockEncrypted;
			}),
			decrypt: vi.fn().mockImplementation((encryptedData: Uint8Array) => {
				// Return mock decrypted data (remove prefix for testing)
				if (encryptedData.length > 8 && encryptedData[0] === 0xee && encryptedData[1] === 0xee) {
					return encryptedData.slice(8);
				}
				return encryptedData;
			}),
			generateKeyPair: vi.fn().mockImplementation(() => ({
				privateKey: mockPrivateRsaKey,
				publicKey: mockPublicRsaKey
			}))
		};

		// Mock the RSA constructor
		vi.mocked(RSA).mockImplementation(() => mockRSAInstance);

		await vaultConnector.createKey(
			"synchronised-storage-blob-encryption-key",
			VaultKeyType.Rsa2048
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

		await connector.start(testNodeIdentity, "node-logging");

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

		await connector.start(testNodeIdentity, "node-logging");

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
		await connector.start(testNodeIdentity, "node-logging");

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
						id: "test-id-1",
						entity: {
							dateModified: "2025-01-01T00:00:00.000Z"
						}
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
			"createdChangeSetProof",
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
								"blob:memory:ad378fe48ccbc2e341996c9427773f8f2d6721b8c14c8005b95edcac80d38345"
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
				"test-type": "blob:memory:ad378fe48ccbc2e341996c9427773f8f2d6721b8c14c8005b95edcac80d38345"
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
			fdf51549a05883e7b868d84f7cfb23e5f2c4fb0cb9e6dd5b64f9d9c2c3f8235e:
				"7u7u7u7u7u4fiwgAAAAAAAADtVFdTxsxEPwvy+s55zhHIH4iUBUoRErV0PChPrjnvTunxDb2huOI8t+rOw6ekFoJoX2yZjwzO7sFo0FCoT42kIBWhCcBFWErKLjYZ3yficmCDyXnkvMB5/y2J86cNoX5FzOSC6rEC2xAAmEkRo1HSCCvlC0xgrzbgvMYFBlnQUJEguRlo45uNBtCAmjJUANy+773kPHhojN+897tfiVgncZz/foZtNHy5cH6YJI/af6xgQR8cK5owx3lzhI+EUioiHyUaVrX9aAeDVwoUxvTPGAXR93H9FFAAl0dEr4oUueWsAyGmnknl0AeGk8ubgy1FNQ6KrbKIxNciA7+j1M9YjCFybt6Z0iV05/Vw15sbF4FZ01E/arLVIwYutv2Nc03wbvYLvQG9bl6wk91v2nh56vpBOssu1T2bP07PODBphDZ9Wg5PfQHk2pclWY9vcTixv/B5en1WF9Novq+/mqK8egk+1ad3j7czEWmf2TzTD0vR7OVWxz64xXsdn8BDyXZhzMDAAA=",
			ad378fe48ccbc2e341996c9427773f8f2d6721b8c14c8005b95edcac80d38345:
				"7u7u7u7u7u4fiwgAAAAAAAADpY+xasMwFEX/5c12eZYsR9KaKZRO6dSSQdJ7igWOZSxRMCH/Xkw6delQ7njvPXDu8MVrSXkGCx00UGpe3ZVfeQMLlUtt67bwXsxuKWOuBezn/dcpEVhA+b9AA+QqH1d2lXegQKFaVK0w79hZRIv4gogfP8O3TCmmv5apHPNc8pToSY1uKtwALzmMYLsGwujmK5+5np/mJ9oNwU/Z2xvf8rrZSFF1qjcOldaSD14PmnQfDyF6IVlFEfroMXjDA5HyQx8NmSCCjFpIxXB5XB7f1T6XdGkBAAA="
		});

		expect(
			await expandObject(blobs.fdf51549a05883e7b868d84f7cfb23e5f2c4fb0cb9e6dd5b64f9d9c2c3f8235e)
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
			],
			proof: {
				"@context": "https://www.w3.org/ns/credentials/v2",
				created: "2025-05-29T01:00:00.000Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"zUA9ew44LanHmbrqe7uf24X3WA8p79h6hgimALefYpkeWGX6dU9saQmFif63C4JhGZqYP24dS4P4azW3MjoT8pBj",
				type: "DataIntegrityProof",
				verificationMethod: `${testNodeIdentity}#synchronised-storage-assertion`
			}
		});

		expect(
			await expandObject(blobs.ad378fe48ccbc2e341996c9427773f8f2d6721b8c14c8005b95edcac80d38345)
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
						"blob:memory:fdf51549a05883e7b868d84f7cfb23e5f2c4fb0cb9e6dd5b64f9d9c2c3f8235e"
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
		await connector.start(testNodeIdentity, "node-logging");

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
			],
			proof: {
				"@context": "https://www.w3.org/ns/credentials/v2",
				created: "2025-05-29T01:00:00.000Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
				type: "DataIntegrityProof",
				verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
			}
		};

		const blobChangeSetId = await blobStorageConnector.set(
			await Compression.compress(ObjectHelper.toBytes(changeSet), "gzip")
		);

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

		const blobSnapshotId = await blobStorageConnector.set(
			await Compression.compress(ObjectHelper.toBytes(syncState), "gzip")
		);

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
			"verifyChangeSetProofValid",
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
					"blob:memory:88a32fb95e67da4ef8b28091ce85c127e465873717dc4727839391707e704ed8"
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

		await connector.start(testNodeIdentityUntrusted, "node-logging");
		await connectorTrusted.start(testNodeIdentity, "node-logging");

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
			"createdChangeSetProof",
			"builtStorageChangeSet",
			"sendingChangeSetToTrustedNode",
			"removeLocalChangeSnapshot"
		]);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"syncChangeSetForRemoteNode",
			"verifyChangeSetProofValid",
			"copyChangeSet",
			"createdChangeSetProof",
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
								"blob:memory:96d8f39e59ee0502fefd25a22aad9739d63b26fd2ec8633944b2cc2b2e64efe8"
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
			"2f6b5996f09977f01c30a8c601cf6f86078d0491a9a65d5aafbb1b3055a23497":
				"7u7u7u7u7u4fiwgAAAAAAAADpVHBbtpAEP2X6dXG6yWJwp6qlkZNUhAlAVyqHlbeMWwTdt2dAeMg/r2y4+TUKJXQnEbvzbw3bw5gDSgQg9MKIjCa8XNAzdgslEKex+I8loN7kSohlBA9IcSyI468sYV9j0nsg17hLdaggJE45rpEiCBfa7dCAvXzAL7EoNl6BwoIGaLni1q6NXEKEaBjyzWow7+101ik963wq/bx+CsC5w1em5dhMNao5ybujCmxN/K0ggjK4H3RmPuYe8e4Z1CwZi5JJUlVVb2q3/NhlThK8oCtHf1Iya4ZbeNQMNSsrx3jKliuJ+26CPJQl+xpa7mhoDGk4985xVJI2cL/8aodBlvYvI13hLz25s0cxGn1gWqXr4N3ltC87I01EYb2t11Mk20oPTUHvUKdr44w14/bBn7qj2fZcF4V6Vdfh/1iO9t9L24GdHY12+tLeTX+dnYjzXg+X2TZp4flYuLuON+MlsvL0XR8sflCt87+uRjeTbNMT6n/I2Qbb574geF4/AtctcMcNAMAAA==",
			"96d8f39e59ee0502fefd25a22aad9739d63b26fd2ec8633944b2cc2b2e64efe8":
				"7u7u7u7u7u4fiwgAAAAAAAADpY8xa8MwFIT/y5vt8GRbsqU1Uyid0qklw5P0FAscy1giYEL+ezHp1KVDueXgvju4B9x5zTHNYEBABbmkla78xhsYKJxLXbaF92CmJY+pZDBfj1+l6HfT/U9QgafCx5Wp8D7YYCNrlHWjP1AYRIN4QMTPH/A9+RjiX2TMxzTnNEX/Wg00Za6Al+RGMKICN9J85TOX8+v5ye8PwU7Jmhvf0rqZJigrtVYBte77gMK1SINTKFxQYVDYDx47LUiTkl4SBWuFbVFKatpO93B5Xp7fdkTYzmkBAAA="
		});

		expect(
			await expandObject(blobs["96d8f39e59ee0502fefd25a22aad9739d63b26fd2ec8633944b2cc2b2e64efe8"])
		).toEqual({
			version: "1",
			storageKey: "test-type",
			snapshots: [
				{
					version: "1",
					id: "1414141414141414141414141414141414141414141414141414141414141414",
					dateCreated: "2025-05-29T01:00:00.000Z",
					dateModified: "2025-05-29T01:00:00.000Z",
					isConsolidated: false,
					epoch: 1,
					changeSetStorageIds: [
						"blob:memory:2f6b5996f09977f01c30a8c601cf6f86078d0491a9a65d5aafbb1b3055a23497"
					]
				}
			]
		});

		expect(
			await expandObject(blobs["2f6b5996f09977f01c30a8c601cf6f86078d0491a9a65d5aafbb1b3055a23497"])
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
			id: "0909090909090909090909090909090909090909090909090909090909090909",
			nodeIdentity:
				"did:entity-storage:0xd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
			proof: {
				"@context": "https://www.w3.org/ns/credentials/v2",
				created: "2025-05-29T01:00:00.000Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z3NUXDVwf1HoyrxWuUvQfJ9s4FUxa82FNL4J2dNVVWXXBkZWPnStcmMZZ8MRN6mEsKniq6DSRXXaRs3YrXmodztkt",
				type: "DataIntegrityProof",
				verificationMethod: `${testNodeIdentity}#synchronised-storage-assertion`
			},
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
			await connector.start(testNodeIdentity, "node-logging");

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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T01:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T02:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T04:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
			};

			// Store changesets
			const blobChangeSetId1 = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet1), "gzip")
			);
			const blobChangeSetId2 = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet2), "gzip")
			);
			const blobChangeSetId3 = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet3), "gzip")
			);

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

			const blobSnapshotId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(syncState), "gzip")
			);

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
			await connector.start(testNodeIdentity, "node-logging");

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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T01:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
			};

			const blobChangeSetId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet), "gzip")
			);

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

			const blobSnapshotId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(syncState), "gzip")
			);

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
			await connector.start(testNodeIdentity, "node-logging");

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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T02:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
			};

			const blobChangeSetId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet), "gzip")
			);

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

			const blobSnapshotId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(syncState), "gzip")
			);

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
			await connector.start(testNodeIdentity, "node-logging");

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
				],
				proof: {
					"@context": "https://www.w3.org/ns/credentials/v2",
					created: "2025-05-29T03:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z3MzHDwnYUqZqTnYzxbzxkkWgy54oyXn4EpxCV7CtMgn7LMpxccX3im83Yz6isyvo9YpT7jmS9JqNMVZUw58C3cb8",
					type: "DataIntegrityProof",
					verificationMethod: `${testNodeIdentityUntrusted}#synchronised-storage-assertion`
				}
			};

			const blobChangeSetId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(changeSet), "gzip")
			);

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

			const blobSnapshotId = await blobStorageConnector.set(
				await Compression.compress(ObjectHelper.toBytes(syncState), "gzip")
			);

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
