// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	AuthenticationGeneratorFactory,
	type IAuthenticationGenerator
} from "@twin.org/api-models";
import { SynchronisedStorageRestClient } from "../src/synchronisedStorageRestClient";

describe("SynchronisedStorageRestClient", () => {
	test("Can create an instance", async () => {
		AuthenticationGeneratorFactory.register(
			"verifiable-credential",
			() => ({}) as IAuthenticationGenerator
		);

		const client = new SynchronisedStorageRestClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});
