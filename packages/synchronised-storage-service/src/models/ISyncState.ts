// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISyncSnapshot } from "./ISyncSnapshot";

/**
 * The object definition for a sync state.
 */
export interface ISyncState {
	/**
	 * The version of the sync state.
	 */
	version: string;

	/**
	 * The snapshots.
	 */
	snapshots: ISyncSnapshot[];
}
