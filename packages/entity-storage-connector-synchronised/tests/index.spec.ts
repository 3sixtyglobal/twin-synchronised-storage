// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory } from "@twin.org/core";
import { EntitySchemaFactory, EntitySchemaHelper, entity, property } from "@twin.org/entity";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { LocalEventBusConnector } from "@twin.org/event-bus-connector-local";
import {
	EventBusConnectorFactory,
	type IEvent,
	type IEventBusComponent,
	type IEventBusConnector
} from "@twin.org/event-bus-models";
import { EventBusService } from "@twin.org/event-bus-service";
import { nameof } from "@twin.org/nameof";
import {
	SyncNodeIdMode,
	SynchronisedStorageTopics,
	type ISyncBatchRequest,
	type ISyncBatchResponse,
	type ISyncItemChange,
	type ISyncItemRemove,
	type ISyncItemRequest,
	type ISyncItemResponse,
	type ISyncItemSet,
	type ISyncRegisterStorageKey,
	type ISyncReset
} from "@twin.org/synchronised-storage-models";
import { SynchronisedEntityStorageConnector } from "../src/synchronisedEntityStorageConnector.js";

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

let eventBusConnector: IEventBusConnector;
let eventBusService: IEventBusComponent;
let memoryStorageConnector: MemoryEntityStorageConnector<TestType>;
const testNodeId = "did:example:node-1111";
const testNodeId2 = "did:example:node-2222";

describe("synchronisedEntityStorageConnector", () => {
	beforeEach(() => {
		EntitySchemaFactory.register(nameof<TestType>(), () => EntitySchemaHelper.getSchema(TestType));
		memoryStorageConnector = new MemoryEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>()
		});
		EntityStorageConnectorFactory.register("memory", () => memoryStorageConnector);

		eventBusConnector = new LocalEventBusConnector();
		EventBusConnectorFactory.register("local", () => eventBusConnector);

		eventBusService = new EventBusService({
			eventBusConnectorType: "local"
		});
		ComponentFactory.register("event-bus", () => eventBusService);

		ContextIdStore.getContextIds = vi
			.fn()
			.mockImplementation(() => ({ node: testNodeId, org: "org", user: "user" }));
	});

	test("can create an instance of the connector", async () => {
		const connector = new SynchronisedEntityStorageConnector({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		expect(connector).toBeInstanceOf(SynchronisedEntityStorageConnector);
	});

	test("can register its storage key when started", async () => {
		const connector = new SynchronisedEntityStorageConnector({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});

		let registeredEventData: IEvent<ISyncRegisterStorageKey> | undefined;

		await eventBusService.subscribe<ISyncRegisterStorageKey>(
			SynchronisedStorageTopics.RegisterStorageKey,
			async data => {
				registeredEventData = data;
			}
		);

		await connector.start();

		expect(registeredEventData).toBeDefined();
		expect(registeredEventData?.topic).toEqual("synchronised-storage:register-storage-key");
		expect(registeredEventData?.data.storageKey).toBe("test-type-100");
	});

	test("can set an item", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		let localItemChangeEventData: IEvent<ISyncItemChange> | undefined;

		await eventBusService.subscribe<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			async data => {
				localItemChangeEventData = data;
			}
		);

		await connector.set({
			id: "test-id",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});

		expect(localItemChangeEventData).toBeDefined();
		expect(localItemChangeEventData?.topic).toEqual("synchronised-storage:local-item-change");
		expect(localItemChangeEventData?.data.storageKey).toBe("test-type-100");
		expect(localItemChangeEventData?.data.operation).toBe("set");
		expect(localItemChangeEventData?.data.id).toBe("test-id");

		expect(memoryStorageConnector.getStore()).toEqual([
			{
				id: "test-id",
				nodeIdentity: testNodeId,
				dateModified: expect.any(String)
			}
		]);
	});

	test("can remove an item", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		let localItemChangeEventData: IEvent<ISyncItemChange> | undefined;

		await eventBusService.subscribe<ISyncItemChange>(
			SynchronisedStorageTopics.LocalItemChange,
			async data => {
				localItemChangeEventData = data;
			}
		);

		await connector.set({
			id: "test-id",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});

		await connector.remove("test-id");

		expect(localItemChangeEventData).toBeDefined();
		expect(localItemChangeEventData?.topic).toEqual("synchronised-storage:local-item-change");
		expect(localItemChangeEventData?.data.storageKey).toBe("test-type-100");
		expect(localItemChangeEventData?.data.id).toBe("test-id");
		expect(localItemChangeEventData?.data.operation).toEqual("delete");

		expect(memoryStorageConnector.getStore()).toEqual([]);
	});

	test("can respond to an item request", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		let itemResponseData: IEvent<ISyncItemResponse> | undefined;

		await eventBusService.subscribe<ISyncItemResponse>(
			SynchronisedStorageTopics.LocalItemResponse,
			async event => {
				itemResponseData = event;
			}
		);

		await connector.set({
			id: "test-id",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncItemRequest>(SynchronisedStorageTopics.LocalItemRequest, {
			storageKey: "test-type-100",
			id: "test-id"
		});

		expect(itemResponseData).toBeDefined();
		expect(itemResponseData?.topic).toEqual("synchronised-storage:local-item-response");
		expect(itemResponseData?.data.id).toEqual("test-id");
		expect(itemResponseData?.data.entity).toEqual({
			id: "test-id",
			nodeIdentity: testNodeId,
			dateModified: expect.any(String)
		});
	});

	test("can respond to an item request when the item does not exist", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		let itemResponseData: IEvent<ISyncItemResponse> | undefined;

		await eventBusService.subscribe<ISyncItemResponse>(
			SynchronisedStorageTopics.LocalItemResponse,
			async event => {
				itemResponseData = event;
			}
		);

		await connector.set({
			id: "test-id",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncItemRequest>(SynchronisedStorageTopics.LocalItemRequest, {
			storageKey: "test-type-100",
			id: "test-id-does-not-exist"
		});

		expect(itemResponseData).toBeDefined();
		expect(itemResponseData?.topic).toEqual("synchronised-storage:local-item-response");
		expect(itemResponseData?.data.id).toEqual("test-id-does-not-exist");
		expect(itemResponseData?.data.entity).toEqual(undefined);
	});

	test("can respond to a batch request", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		let consolidateBatchResponseData1: IEvent<ISyncBatchResponse> | undefined;
		let consolidateBatchResponseData2: IEvent<ISyncBatchResponse> | undefined;

		await eventBusService.subscribe<ISyncBatchResponse>(
			SynchronisedStorageTopics.BatchResponse,
			async event => {
				if (event.data.lastEntry) {
					consolidateBatchResponseData2 = event;
				} else {
					consolidateBatchResponseData1 = event;
				}
			}
		);

		for (let i = 0; i < 5; i++) {
			await connector.set({
				id: `test-id-${i}`,
				nodeIdentity: testNodeId,
				dateModified: new Date().toISOString()
			});
		}

		await eventBusService.publish<ISyncBatchRequest>(SynchronisedStorageTopics.BatchRequest, {
			storageKey: "test-type-100",
			batchSize: 3,
			requestMode: SyncNodeIdMode.Local
		});

		expect(consolidateBatchResponseData1).toBeDefined();
		expect(consolidateBatchResponseData1?.topic).toEqual("synchronised-storage:batch-response");
		expect(consolidateBatchResponseData1?.data.entities.length).toEqual(3);
		expect(consolidateBatchResponseData1?.data.lastEntry).toEqual(false);

		expect(consolidateBatchResponseData2).toBeDefined();
		expect(consolidateBatchResponseData2?.topic).toEqual("synchronised-storage:batch-response");
		expect(consolidateBatchResponseData2?.data.entities.length).toEqual(2);
		expect(consolidateBatchResponseData2?.data.lastEntry).toEqual(true);
	});

	test("can populate from a remote item set", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		await eventBusService.publish<ISyncItemSet>(SynchronisedStorageTopics.RemoteItemSet, {
			storageKey: "test-type-100",
			entity: {
				id: "test-id",
				nodeIdentity: testNodeId2,
				dateModified: new Date().toISOString()
			}
		});

		expect(memoryStorageConnector.getStore()).toEqual([
			{
				id: "test-id",
				nodeIdentity: testNodeId2,
				dateModified: expect.any(String)
			}
		]);
	});

	test("can remove from a remote item remove", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		await connector.set({
			id: "test-id",
			nodeIdentity: testNodeId2,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncItemRemove>(SynchronisedStorageTopics.RemoteItemRemove, {
			storageKey: "test-type-100",
			id: "test-id",
			nodeId: testNodeId2
		});

		expect(memoryStorageConnector.getStore()).toEqual([]);
	});

	test("can reset and remove local items", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		await memoryStorageConnector.set({
			id: "test-id-local",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});
		await memoryStorageConnector.set({
			id: "test-id-remote",
			nodeIdentity: testNodeId2,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncReset>(SynchronisedStorageTopics.Reset, {
			storageKey: "test-type-100",
			resetMode: SyncNodeIdMode.Local
		});

		expect(memoryStorageConnector.getStore()).toEqual([
			{
				id: "test-id-remote",
				dateModified: expect.any(String),
				nodeIdentity: testNodeId2
			}
		]);
	});

	test("can reset and remove remote items", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		await memoryStorageConnector.set({
			id: "test-id-local",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});
		await memoryStorageConnector.set({
			id: "test-id-remote",
			nodeIdentity: testNodeId2,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncReset>(SynchronisedStorageTopics.Reset, {
			storageKey: "test-type-100",
			resetMode: SyncNodeIdMode.Remote
		});

		expect(memoryStorageConnector.getStore()).toEqual([
			{
				id: "test-id-local",
				dateModified: expect.any(String),
				nodeIdentity: testNodeId
			}
		]);
	});

	test("can reset and remove all items", async () => {
		const connector = new SynchronisedEntityStorageConnector<TestType>({
			entitySchema: nameof<TestType>(),
			entityStorageConnectorType: "memory",
			eventBusComponentType: "event-bus",
			config: {
				storageKey: "test-type-100"
			}
		});
		await connector.start();

		await memoryStorageConnector.set({
			id: "test-id-local",
			nodeIdentity: testNodeId,
			dateModified: new Date().toISOString()
		});
		await memoryStorageConnector.set({
			id: "test-id-remote",
			nodeIdentity: testNodeId2,
			dateModified: new Date().toISOString()
		});

		await eventBusService.publish<ISyncReset>(SynchronisedStorageTopics.Reset, {
			storageKey: "test-type-100",
			resetMode: SyncNodeIdMode.All
		});

		expect(memoryStorageConnector.getStore()).toEqual([]);
	});
});
