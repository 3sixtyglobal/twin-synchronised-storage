// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Register a type with synchronised storage so that it can perform consolidations.
 */
export interface ISyncRegisterSchemaType {
	/**
	 * The type of the schema being registered.
	 */
	schemaType: string;
}
