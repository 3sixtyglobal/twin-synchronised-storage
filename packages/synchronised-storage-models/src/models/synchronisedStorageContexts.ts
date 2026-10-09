// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The Contexts concerning Synchronised Storage.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SynchronisedStorageContexts = {
	/**
	 * The canonical RDF namespace URI for Synchronised Storage.
	 */
	Namespace: "https://schema.3sixty.global/synchronised-storage/",

	/**
	 * The value to use in context for Synchronised Storage.
	 */
	Context: "https://schema.3sixty.global/synchronised-storage/",

	/**
	 * The JSON-LD Context URL for Synchronised Storage.
	 */
	JsonLdContext: "https://schema.3sixty.global/synchronised-storage/types.jsonld"
} as const;

/**
 * The Contexts concerning Synchronised Storage.
 */
export type SynchronisedStorageContexts =
	(typeof SynchronisedStorageContexts)[keyof typeof SynchronisedStorageContexts];
