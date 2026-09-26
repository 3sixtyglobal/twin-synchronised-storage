// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is } from "@twin.org/core";
import { DataTypeHandlerFactory } from "@twin.org/data-core";
import { SynchronisedStorageDataTypes } from "../../src/dataTypes/synchronisedStorageDataTypes.js";

describe("Compiled validators", () => {
	beforeAll(() => {
		SynchronisedStorageDataTypes.registerTypes();
	});

	test("should register a compiled validator for every data type with a schema", async () => {
		const withSchema = DataTypeHandlerFactory.names().filter(name =>
			Is.function(DataTypeHandlerFactory.get(name).jsonSchema)
		);

		const missing: string[] = [];
		for (const name of withSchema) {
			const compiledValidator = await DataTypeHandlerFactory.get(name).compiledValidator?.();
			if (!Is.function(compiledValidator)) {
				missing.push(name);
			}
		}

		expect(withSchema.length).toBeGreaterThan(0);
		expect(missing).toEqual([]);
	});
});
