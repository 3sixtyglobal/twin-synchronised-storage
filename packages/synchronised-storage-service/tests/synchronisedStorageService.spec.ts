// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { MemoryBlobStorageConnector } from "@twin.org/blob-storage-connector-memory";
import { BlobStorageConnectorFactory } from "@twin.org/blob-storage-models";
import {
	type BlobStorageEntry,
	BlobStorageService,
	initSchema as initSchemaBlobStorage
} from "@twin.org/blob-storage-service";
import { ComponentFactory, RandomHelper } from "@twin.org/core";
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
	type ISyncRegisterSchemaType,
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
let testTypeStorageConnector: MemoryEntityStorageConnector<TestType>;
let verifiableStorage: MemoryEntityStorageConnector<VerifiableItem>;
let blobEntryEntityStorage: MemoryEntityStorageConnector<BlobStorageEntry>;
let blobStorageConnector: MemoryBlobStorageConnector;
let blobStorageComponent: BlobStorageService;
let syncSnapshotStorageConnector: MemoryEntityStorageConnector<SyncSnapshotEntry>;
let loggingMemoryEntityStorage: MemoryEntityStorageConnector<LogEntry>;

describe("synchronisedStorageService", () => {
	beforeEach(() => {
		initSchema();
		initSchemaVerifiableStorage();
		initSchemaBlobStorage();
		initSchemaIdentity();
		initSchemaVault();
		initSchemaLogging();

		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));

		testTypeStorageConnector = new MemoryEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>()
		});
		EntityStorageConnectorFactory.register("test-type", () => testTypeStorageConnector);

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

	test("can register a type with no existing verifiable sync pointer", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await eventBusConnector.publish<ISyncRegisterSchemaType>(
			SynchronisedStorageTopics.RegisterSchemaType,
			{
				schemaType: "test-type"
			}
		);

		const logStore = loggingMemoryEntityStorage.getStore();
		expect(logStore).toEqual([
			{
				id: "dadadadadadadadadadadadadadadadadadadadadadadadadadadadadadadada",
				level: "info",
				source: "SynchronisedStorageService",
				ts: expect.any(Number),
				message: "registerType",
				data: { schemaType: "test-type" }
			},
			{
				id: "dbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdb",
				level: "info",
				source: "RemoteSyncStateHelper",
				ts: expect.any(Number),
				message: "verifiableSyncPointerRetrieving",
				data: {
					key: "verifiable:entity-storage:11111111111111111111111111111111"
				}
			},
			{
				id: "dcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdc",
				level: "info",
				source: "RemoteSyncStateHelper",
				ts: expect.any(Number),
				message: "verifiableSyncPointerNotFound",
				data: {
					key: "verifiable:entity-storage:11111111111111111111111111111111"
				}
			}
		]);
	});

	test("can process a local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await eventBusConnector.publish<ISyncRegisterSchemaType>(
			SynchronisedStorageTopics.RegisterSchemaType,
			{
				schemaType: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			id: "test-id-1",
			schemaType: "test-type",
			operation: "set"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0",
				schemaType: "test-type",
				dateCreated: expect.any(String),
				changeSetStorageIds: [],
				isLocalSnapshot: true,
				localChanges: [
					{
						operation: "set",
						id: "test-id-1"
					}
				]
			}
		]);
	});

	test("can process subsequent local update to entity storage", async () => {
		const connector = new SynchronisedStorageService({
			config: { synchronisedStorageKey, isTrustedNode: true }
		});
		expect(connector).toBeInstanceOf(SynchronisedStorageService);

		await eventBusConnector.publish<ISyncRegisterSchemaType>(
			SynchronisedStorageTopics.RegisterSchemaType,
			{
				schemaType: "test-type"
			}
		);

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			schemaType: "test-type",
			id: "test-id-1",
			operation: "set"
		});

		await eventBusConnector.publish<ISyncItemChange>(SynchronisedStorageTopics.LocalItemChange, {
			schemaType: "test-type",
			id: "test-id-1",
			operation: "delete"
		});

		const localSnapshots = syncSnapshotStorageConnector.getStore();
		expect(localSnapshots).toEqual([
			{
				id: "e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0",
				schemaType: "test-type",
				dateCreated: expect.any(String),
				changeSetStorageIds: [],
				isLocalSnapshot: true,
				localChanges: [
					{
						operation: "delete",
						id: "test-id-1"
					}
				]
			}
		]);
	});
});
