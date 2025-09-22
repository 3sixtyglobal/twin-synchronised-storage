// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The LD Contexts concerning SynchronisedStorage.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SynchronisedStorageContexts = {
	/**
	 * The SynchronisedStorage LD Context.
	 */
	ContextRoot: "https://schema.twindev.org/synchronised-storage"
} as const;

/**
 * The LD Contexts concerning SynchronisedStorage.
 */
export type SynchronisedStorageContexts =
	(typeof SynchronisedStorageContexts)[keyof typeof SynchronisedStorageContexts];
