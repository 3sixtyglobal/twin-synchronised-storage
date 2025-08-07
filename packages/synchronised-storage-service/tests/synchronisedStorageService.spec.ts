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
import { nameof } from "@twin.org/nameof";
import {
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

const synchronisedStorageKey = "verifiable:entity-storage:11111111111111111111111111111111";
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
	let logEntries: LogEntry[] = [];
	do {
		logEntries = store.getStore();
		await new Promise(resolve => setTimeout(resolve, 100));
	} while (logEntries.length < count);
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

	test("RSA mock should be called through vault connector", async () => {
		// Test that the vault connector uses our mocked RSA implementation
		const vaultConnector = VaultConnectorFactory.get("vault");

		// Create a key for testing
		await vaultConnector.createKey("test-encryption-key", VaultKeyType.Rsa2048);

		// Test data to encrypt
		const testData = new Uint8Array([1, 2, 3, 4, 5]);

		// Encrypt using vault connector (should use our mocked RSA)
		const encrypted = await vaultConnector.encrypt(
			"test-encryption-key",
			VaultEncryptionType.Rsa2048,
			testData
		);

		// Decrypt using vault connector (should use our mocked RSA)
		const decrypted = await vaultConnector.decrypt(
			"test-encryption-key",
			VaultEncryptionType.Rsa2048,
			encrypted
		);

		// Verify the data round-trip works
		expect(decrypted).toEqual(testData);

		// Verify our vault mocks were called
		expect(vaultConnector.encrypt).toHaveBeenCalledWith(
			"test-encryption-key",
			VaultEncryptionType.Rsa2048,
			testData
		);
		expect(vaultConnector.decrypt).toHaveBeenCalledWith(
			"test-encryption-key",
			VaultEncryptionType.Rsa2048,
			encrypted
		);

		// Verify the RSA constructor was called by our vault mock
		expect(vi.mocked(RSA)).toHaveBeenCalled();
	});

	test("can create an instance of the service as a trusted node", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);
	});

	test("can create an instance of the service as a non trusted node", async () => {
		const connectorTrusted = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		ComponentFactory.register("trusted", () => connectorTrusted);

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
			"registerStorageKey",
			"activateStorageKey",
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
			"registerStorageKey",
			"activateStorageKey",
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
				id: "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
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
			"registerStorageKey",
			"activateStorageKey",
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
				id: "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0",
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
			"registerStorageKey",
			"activateStorageKey",
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
							dateModified: new Date("2025-01-01T00:00:00Z").toISOString()
						}
					}
				);
			}
		);

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4",
				storageKey: "test-type",
				dateCreated: "2025-05-29T01:00:00.000Z",
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

		await waitForLogEntries(loggingMemoryEntityStorage, 20);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"setLocalChangeSnapshot",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotExists",
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
			"remoteSyncStateStoring",
			"saveBlob",
			"savedBlob",
			"verifiableSyncPointerStoreStoring",
			"removeLocalChangeSnapshot"
		]);

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				id: synchronisedStorageKey.split(":")[2],
				creator:
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
				data: "eyJzeW5jUG9pbnRlcnMiOnsidGVzdC10eXBlIjoiYmxvYjptZW1vcnk6ZjQ1MjU4ODMzOWE3Zjg4OGQzZDExN2JkOTM5ZDYyMmI2YWRiMTY0YTEyNDM4ZTgyNjIxYWE5NmNiZWM5OTA5MCJ9fQ==",
				allowList: [
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
				],
				maxAllowListSize: 100
			}
		]);

		const verifiable = ObjectHelper.fromBytes(Converter.base64ToBytes(verifiableStore[0].data));
		expect(verifiable).toEqual({
			syncPointers: {
				"test-type": "blob:memory:f452588339a7f888d3d117bd939d622b6adb164a12438e82621aa96cbec99090"
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
			"95756e5e2263b7784e139ba4cb28230787d19684c40eae9a34521fc3feee26db":
				"7u7u7u7u7u4fiwgAAAAAAAADtVHLbtswEPyX7ZWyKKoOWp76SNOmqQMHEGQjQQ+suJLopiRNrmPThv+9kOIEPRYIgj0RM5yZnT2A0SChVS8bYKAV4eeAinAQFFxMMz7NxPuKF5JzyfmEc34LDCK5oDq8wgQSCCNllDwCg6ZXtsMI8u4AzmNQZJwFCREJ2GPOkW50VgADtGQogTyM1jOnTWv+8S4yXlSj8bP38fiTgXUaL/XTZ9BGy8dHdgom+U7zlw0w8MG5dgj3oXGWcEcgoSfyUeb5drudbMuJC11uY94EHOOo+5g/CGAw1iHhXJG6tIRdMJTmoxyDJiRPLm4MDRTUOqps1cRMcCFG+D8O8IDBtKYZ650h9U6/Vg9vYrJNH5w1EfWTbqZixDDe9lTTfBO8i8NCz9Ap14lQq/vNAO/LP+8WX34sqdAXZwvfxJVPDhe7unbiwlz9orpM5fXZ12snKtrvq5lFsbyZ/u7LTnzzn4q6rNZ1t0lv5+16+bG8na92hfm+NudwPP4Fk4z19goDAAA=",
			f452588339a7f888d3d117bd939d622b6adb164a12438e82621aa96cbec99090:
				"7u7u7u7u7u4fiwgAAAAAAAADpc69DoIwFEDhd7kzmNvblv6sTs44aRhaegEToQa6GMK7G57BnP3L2WFbwmebctnAP3d4JfCA8r+gghQKX1cOhU+QkHSNuiZ3R+ERPeIFER9QQT+FZeSWS1vyGka+pXME4jtHP/Oc16932uiGNRM1MhpjFQvpYlB9JEsSjTVJuMaqXiEHdkEqTWLo5cDM1KQI3dEdP3Gx2HzpAAAA"
		});

		expect(
			await expandObject(blobs["95756e5e2263b7784e139ba4cb28230787d19684c40eae9a34521fc3feee26db"])
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
			id: "fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa",
			nodeIdentity:
				"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
			proof: {
				"@context": "https://www.w3.org/ns/credentials/v2",
				created: "2025-05-29T01:00:00.000Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z3m8WELXt1dF6WpcsjpyoeWxVVo2FiKbtV3y3N6GNo2TtzzTMne2XQ5kh3g2HpB1V3TqVguy4PfqXA3ZPjx1iJqiD",
				type: "DataIntegrityProof",
				verificationMethod:
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0#synchronised-storage-assertion"
			},
			storageKey: "test-type"
		});

		expect(
			await expandObject(blobs.f452588339a7f888d3d117bd939d622b6adb164a12438e82621aa96cbec99090)
		).toEqual({
			snapshots: [
				{
					changeSetStorageIds: [
						"blob:memory:95756e5e2263b7784e139ba4cb28230787d19684c40eae9a34521fc3feee26db"
					],
					dateCreated: "2025-05-29T01:00:00.000Z",
					id: "0303030303030303030303030303030303030303030303030303030303030303"
				}
			]
		});
	});

	test("can receive the updates from a remote sync state", async () => {
		const connector = new SynchronisedStorageService({
			config: {
				synchronisedStorageKey,
				isTrustedNode: true,
				consolidationIntervalMinutes: 0
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await eventBusConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		let remoteData;

		await eventBusConnector.subscribe<ISyncItemSet>(
			SynchronisedStorageTopics.RemoteItemSet,
			async e => {
				remoteData = e;
			}
		);

		await blobStorageConnector.set(
			await Compression.compress(
				ObjectHelper.toBytes({
					id: "f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8",
					dateCreated: "2025-05-29T07:00:00.000Z",
					storageKey: "test-type",
					changes: [
						{
							operation: "set",
							id: "test-id-1",
							entity: { id: "test-id-1", dateModified: "2025-01-01T00:00:00.000Z" }
						}
					],
					nodeIdentity:
						"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
					proof: {
						"@context": "https://www.w3.org/ns/credentials/v2",
						type: "DataIntegrityProof",
						cryptosuite: "eddsa-jcs-2022",
						created: "2025-05-29T07:00:00.000Z",
						verificationMethod:
							"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0#synchronised-storage-assertion",
						proofPurpose: "assertionMethod",
						proofValue:
							"z4f3Knb6vVTjyL4tiWzVnc3KxAnDpJZjKFED9r7MA2r4RHh2dboZGQtbT4adMARiwNPCk2PqrzS2AA3RajZ6pWZXX"
					}
				}),
				"gzip"
			)
		);

		await blobStorageConnector.set(
			await Compression.compress(
				ObjectHelper.toBytes({
					snapshots: [
						{
							id: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
							dateCreated: "2025-05-29T07:00:00.000Z",
							changeSetStorageIds: [
								"blob:memory:6cd9c358696f5885e37542955d68b7bf71f0ef53e46a65b3c1873ca0e7dcc3f4"
							]
						}
					]
				}),
				"gzip"
			)
		);

		const verifiableSyncPointerStore: ISyncPointerStore = {
			syncPointers: {
				"test-type": "blob:memory:2c3b0902f988e9d1805a28e901b1bbc132d9b5c83eeed1199bf416a13c211fc2"
			}
		};

		await verifiableStorage.set({
			id: synchronisedStorageKey.split(":")[2],
			creator:
				"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
			data: Converter.bytesToBase64(ObjectHelper.toBytes(verifiableSyncPointerStore)),
			allowList: [
				"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
			],
			maxAllowListSize: 100
		});

		await connector.start(testNodeIdentity, "node-logging");

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore.map(e => e.message)).toEqual([
			"registerStorageKey",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"remoteSyncStateRetrieving",
			"loadBlob",
			"loadedBlob",
			"remoteSyncStateRetrieved",
			"remoteSyncSynchronisation",
			"remoteSyncSnapshotProcessing",
			"remoteSyncSnapshotNew",
			"getChangeSet",
			"loadBlob",
			"loadedBlob",
			"verifyChangeSetProofValid",
			"changeSetApplyingChange",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"updateFromLocalSyncStateNoChanges"
		]);

		expect(remoteData).toEqual({
			data: {
				entity: {
					dateModified: "2025-01-01T00:00:00.000Z",
					id: "test-id-1",
					nodeIdentity:
						"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
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
				changeSetStorageIds: [
					"blob:memory:6cd9c358696f5885e37542955d68b7bf71f0ef53e46a65b3c1873ca0e7dcc3f4"
				],
				dateCreated: "2025-05-29T07:00:00.000Z",
				id: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
				storageKey: "test-type"
			}
		]);
	});

	test("can use a trusted node to synchronise with a non trusted node", async () => {
		const connectorTrusted = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		ComponentFactory.register("trusted", () => connectorTrusted);

		const connector = new SynchronisedStorageService({
			trustedSynchronisedStorageComponentType: "trusted",
			eventBusComponentType: "event-bus-untrusted",
			loggingConnectorType: "logging-untrusted",
			config: {
				synchronisedStorageKey,
				isTrustedNode: false,
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

		await eventBusUntrustedConnector.publish<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			{
				storageKey: "test-type"
			}
		);

		await eventBusUntrustedConnector.publish<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			{
				storageKey: "test-type",
				id: "test-id-1",
				operation: "set"
			}
		);

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

		await connector.start(testNodeIdentityUntrusted, "node-logging");
		await connectorTrusted.start(testNodeIdentity, "node-logging");

		await waitForLogEntries(loggingUntrustedMemoryEntityStorage, 20);

		const logStoreUntrusted = loggingUntrustedMemoryEntityStorage.getStore();
		expect(logStoreUntrusted.map(e => e.message)).toEqual([
			"registerStorageKey",
			"addLocalChange",
			"getLocalChangeSnapshot",
			"localChangeSnapshotDoesNotExist",
			"setLocalChangeSnapshot",
			"activateStorageKey",
			"startEntitySync",
			"updateFromRemoteSyncState",
			"verifiableSyncPointerStoreRetrieving",
			"verifiableSyncPointerStoreRetrieved",
			"updateFromLocalSyncState",
			"getLocalChangeSnapshot",
			"localChangeSnapshotExists",
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
			"remoteSyncStateStoring",
			"saveBlob",
			"savedBlob",
			"verifiableSyncPointerStoreStoring"
		]);

		expect(verifiableStorage.getStore()).toEqual([
			{
				id: "11111111111111111111111111111111",
				creator:
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0",
				data: "eyJzeW5jUG9pbnRlcnMiOnsidGVzdC10eXBlIjoiYmxvYjptZW1vcnk6YTJkNTQwOWUyNzU5ZTExZjUwYTQ1MWI2NGNjYTBlYTY5YjlmZjdiZmU0M2RmYTI5YzNhYzI1NzU1MTk4Mzg2NCJ9fQ==",
				allowList: [
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0"
				],
				maxAllowListSize: 100
			}
		]);

		const blobStorageStore = blobStorageConnector.getStore();
		const blobs: { [id: string]: string } = {};
		for (const blobKey in blobStorageStore) {
			blobs[blobKey] = Converter.bytesToBase64(blobStorageStore[blobKey]);
		}
		expect(blobs).toEqual({
			"06850545808262cbab3d614d9ac4adaf624aede0beb0531f8bec15dd14813fcb":
				"7u7u7u7u7u4fiwgAAAAAAAADpVFBbtswEPzL9ipZFAWhEE+NnbYJXBdxJNRxih4Ici3TTUiBXFtSDP+9kOIEvRQoYMyJ2NmZ4ewRjAYBrLgMEIGWhDOPknAQ5IznMctjXlQsFYwJxiaMsUeIIJDzssY59iCAMFBMfYMQgdpKW2MA8fMIrkEvyTgLAgISRK85R7rRcQoRoCVDPYjjaL1w2mzMX95pzNJqNH73Pp1+RWCdxlv9tgzaaPH6iM/BBOs0vwwQQeOd2wzhPilnCTsCAVuiJogkadt20mYT5+vEhkR5HOPIp5AchtWxDgHXkuStJay9of5ulItA+b4hF/aGBgpqHWS8UyHmjPNx/B8HOKA3G6PGehdIW6f/2QO7DB9Cb9XWO2sC6jfdWIaAfrztuaa7vW9cGD70PjrnOhN+yKf9MH7JcTP97JchW0+/Pbqbj7t6vljKe1Wsd1fdVf5QrufPq+zLczW9bouVcbbi30vepeXioO776aHNM1WWTs6qtFveFPR7Zeuvs4cMTqc/PzuG7goDAAA=",
			a2d5409e2759e11f50a451b64cca0ea69b9ff7bfe43dfa29c3ac257551983864:
				"7u7u7u7u7u4fiwgAAAAAAAADpc6xDoIwEIDhd7kZzLW0Tenq5IyThuHaO8BEqIEuhvDuhmcw//7l32Fb6LNNuWwQnju8GAIo819QAVOR6ypU5AQ1alujrXV7RxUQA+IFER9QQZpoGaWT0pW80ig3PkcgvnMMs8x5/QZ03qI11qPXTqdIsWGnDLeUDDENThsSFowS0TZq8FGSsszKeNUMKUJ/9McPKpjsp+kAAAA="
		});

		expect(
			await expandObject(blobs.a2d5409e2759e11f50a451b64cca0ea69b9ff7bfe43dfa29c3ac257551983864)
		).toEqual({
			snapshots: [
				{
					changeSetStorageIds: [
						"blob:memory:06850545808262cbab3d614d9ac4adaf624aede0beb0531f8bec15dd14813fcb"
					],
					dateCreated: "2025-05-29T01:00:00.000Z",
					id: "1414141414141414141414141414141414141414141414141414141414141414"
				}
			]
		});

		expect(
			await expandObject(blobs["06850545808262cbab3d614d9ac4adaf624aede0beb0531f8bec15dd14813fcb"])
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
			id: "0909090909090909090909090909090909090909090909090909090909090909",
			nodeIdentity:
				"did:entity-storage:0xd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
			proof: {
				"@context": "https://www.w3.org/ns/credentials/v2",
				created: "2025-05-29T01:00:00.000Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z5efBErQs3YBLZoH7jgKMQaRc9YjAxA5XSYKmW3FmTBDw9WionT2NS2x1SMvcRyBvw53cSSoaCT1xQH9tkWngGCX3",
				type: "DataIntegrityProof",
				verificationMethod:
					"did:entity-storage:0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0#synchronised-storage-assertion"
			},
			storageKey: "test-type"
		});
	});
});
