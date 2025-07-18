// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The topics for synchronised storage event bus notifications.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SynchronisedStorageTopics = {
	/**
	 * Register a schema type for the synchronised storage.
	 */
	RegisterSchemaType: "synchronised-storage:register-schema-type",

	/**
	 * An item was set in the storage by the local node.
	 */
	LocalItemSet: "synchronised-storage:local-item-set",

	/**
	 * An item was removed from the storage by the local node.
	 */
	LocalItemRemove: "synchronised-storage:local-item-remove",

	/**
	 * A request has been made for a consolidation batch.
	 */
	ConsolidationBatchRequest: "synchronised-storage:consolidation-batch-request",

	/**
	 * A response to a consolidation batch.
	 */
	ConsolidationBatchResponse: "synchronised-storage:consolidation-batch-response",

	/**
	 * An item was set in the storage by the remote node.
	 */
	RemoteItemSet: "synchronised-storage:remote-item-set",

	/**
	 * An item was removed from the storage by the remote node.
	 */
	RemoteItemRemove: "synchronised-storage:remote-item-remove"
} as const;

/**
 * The topics for synchronised storage event bus notifications.
 */
export type SynchronisedStorageTopics =
	(typeof SynchronisedStorageTopics)[keyof typeof SynchronisedStorageTopics];
