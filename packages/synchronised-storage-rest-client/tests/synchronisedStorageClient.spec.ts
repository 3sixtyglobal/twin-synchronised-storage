// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { SynchronisedStorageClient } from "../src/synchronisedStorageClient";

describe("SynchronisedStorageClient", () => {
	test("Can create an instance", async () => {
		const client = new SynchronisedStorageClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});
