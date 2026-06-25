// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { SynchronisedStorageRestClient } from "../src/synchronisedStorageRestClient.js";

describe("SynchronisedStorageRestClient", () => {
	test("Can create an instance", async () => {
		const client = new SynchronisedStorageRestClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});
