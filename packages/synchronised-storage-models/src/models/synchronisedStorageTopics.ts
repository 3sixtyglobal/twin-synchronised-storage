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
	 * An item was changed in the storage by the local node.
	 */
	LocalItemChange: "synchronised-storage:local-item-change",

	/**
	 * A request has been made for a local item.
	 */
	LocalItemRequest: "synchronised-storage:local-item-request",

	/**
	 * A response to a local item request.
	 */
	LocalItemResponse: "synchronised-storage:local-item-response",

	/**
	 * A request has been made for a batch.
	 */
	BatchRequest: "synchronised-storage:batch-request",

	/**
	 * A response to a batch.
	 */
	BatchResponse: "synchronised-storage:batch-response",

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
