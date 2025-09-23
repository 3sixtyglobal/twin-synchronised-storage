// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	AuthenticationGeneratorFactory,
	type IAuthenticationGenerator
} from "@twin.org/api-models";
import { SynchronisedStorageClient } from "../src/synchronisedStorageClient";

describe("SynchronisedStorageClient", () => {
	test("Can create an instance", async () => {
		AuthenticationGeneratorFactory.register(
			"verifiable-credential",
			() => ({}) as IAuthenticationGenerator
		);

		const client = new SynchronisedStorageClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});
