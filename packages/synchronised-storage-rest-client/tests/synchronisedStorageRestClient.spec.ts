// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@3sixty/core";
import type { ISyncChange, ISyncChangeSet } from "@3sixty/synchronised-storage-models";
import {
	SyncChangeOperation,
	SynchronisedStorageContexts,
	SynchronisedStorageTypes
} from "@3sixty/synchronised-storage-models";
import { HttpMethod } from "@3sixty/web";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { SynchronisedStorageRestClient } from "../src/synchronisedStorageRestClient.js";
import {
	jsonResponse,
	noContentResponse,
	setupFetchMock,
	teardownFetchMock
} from "./helpers/restClientTestHelpers.js";

// OpenAPI spec: ../../synchronised-storage-service/docs/open-api/spec.json
const ENDPOINT = "http://localhost:8080";
const PREFIX = "synchronised-storage";

const TEST_TRUST_PAYLOAD = "test-trust-token";

const TEST_SYNC_CHANGE: ISyncChange = {
	operation: SyncChangeOperation.Set,
	id: "urn:entity:test-item-1",
	entity: {
		dateModified: "2026-01-01T00:00:00Z"
	}
};

const TEST_SYNC_CHANGE_SET: ISyncChangeSet = {
	"@context": SynchronisedStorageContexts.Context,
	type: SynchronisedStorageTypes.SyncChangeSet,
	id: "urn:changeset:test-changeset-1",
	storageKey: "urn:storage:test-key",
	dateCreated: "2026-01-01T00:00:00Z",
	dateModified: "2026-01-01T00:00:00Z",
	nodeIdentity: "urn:node:test-node-1",
	changes: [TEST_SYNC_CHANGE]
};

const TEST_DECRYPTION_KEY = "dGVzdC1kZWNyeXB0aW9uLWtleQ==";

describe("SynchronisedStorageRestClient", () => {
	const fetchMock = vi.fn();

	let client: SynchronisedStorageRestClient;

	beforeEach(() => {
		setupFetchMock(fetchMock);
		client = new SynchronisedStorageRestClient({ endpoint: ENDPOINT });
	});

	afterEach(() => {
		teardownFetchMock(fetchMock);
	});

	describe("getDecryptionKey", () => {
		test("throws a guard error when trustPayload is an empty string", async () => {
			await expect(client.getDecryptionKey("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("calls the correct URL and HTTP method", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ decryptionKey: TEST_DECRYPTION_KEY }));

			await client.getDecryptionKey(TEST_TRUST_PAYLOAD);

			const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/decryption-key`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns the decryption key from the response", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ decryptionKey: TEST_DECRYPTION_KEY }));

			const result = await client.getDecryptionKey(TEST_TRUST_PAYLOAD);

			expect(result).toBe(TEST_DECRYPTION_KEY);
		});
	});

	describe("syncChangeSet", () => {
		test("throws a guard error when syncChangeSet is undefined", async () => {
			await expect(
				client.syncChangeSet(undefined as unknown as ISyncChangeSet, TEST_TRUST_PAYLOAD)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.objectUndefined"
			});
		});

		test("throws a guard error when trustPayload is an empty string", async () => {
			await expect(client.syncChangeSet(TEST_SYNC_CHANGE_SET, "")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("calls the correct URL and HTTP method", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.syncChangeSet(TEST_SYNC_CHANGE_SET, TEST_TRUST_PAYLOAD);

			const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/sync-changeset`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends the change set in the request body", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.syncChangeSet(TEST_SYNC_CHANGE_SET, TEST_TRUST_PAYLOAD);

			const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(options.body as string) as ISyncChangeSet;
			expect(body["@context"]).toBe(SynchronisedStorageContexts.Context);
			expect(body.type).toBe(SynchronisedStorageTypes.SyncChangeSet);
			expect(body.id).toBe(TEST_SYNC_CHANGE_SET.id);
			expect(body.storageKey).toBe(TEST_SYNC_CHANGE_SET.storageKey);
			expect(body.nodeIdentity).toBe(TEST_SYNC_CHANGE_SET.nodeIdentity);
			expect(body.changes).toHaveLength(1);
			expect(body.changes[0].operation).toBe(SyncChangeOperation.Set);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.syncChangeSet(TEST_SYNC_CHANGE_SET, TEST_TRUST_PAYLOAD);

			expect(result).toBeUndefined();
		});
	});
});
