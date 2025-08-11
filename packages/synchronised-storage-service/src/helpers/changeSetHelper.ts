// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, Converter, Guards, Is, ObjectHelper, RandomHelper } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import type { ILoggingConnector } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import { type IProof, ProofTypes } from "@twin.org/standards-w3c-did";
import {
	type ISyncChangeSet,
	type ISynchronisedEntity,
	type ISyncItemRemove,
	type ISyncItemSet,
	type ISyncReset,
	type SyncNodeIdentityMode,
	SyncChangeOperation,
	SynchronisedStorageTopics
} from "@twin.org/synchronised-storage-models";
import type { BlobStorageHelper } from "./blobStorageHelper";

/**
 * Class for performing change set operations.
 */
export class ChangeSetHelper<T extends ISynchronisedEntity = ISynchronisedEntity> {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<ChangeSetHelper>();

	/**
	 * The logging connector to use for logging.
	 * @internal
	 */
	private readonly _logging: ILoggingConnector | undefined;

	/**
	 * The event bus component.
	 * @internal
	 */
	private readonly _eventBusComponent: IEventBusComponent;

	/**
	 * The blob storage helper to use for remote sync states.
	 * @internal
	 */
	private readonly _blobStorageHelper: BlobStorageHelper;

	/**
	 * The identity connector to use for signing/verifying changesets.
	 * @internal
	 */
	private readonly _identityConnector: IIdentityConnector;

	/**
	 * The id of the identity method to use when signing/verifying changesets.
	 * @internal
	 */
	private readonly _decentralisedStorageMethodId: string;

	/**
	 * The identity of the node that is performing the update.
	 * @internal
	 */
	private _nodeIdentity?: string;

	/**
	 * Create a new instance of ChangeSetHelper.
	 * @param logging The logging connector to use for logging.
	 * @param eventBusComponent The event bus component to use for events.
	 * @param identityConnector The identity connector to use for signing/verifying changesets.
	 * @param blobStorageHelper The blob storage component to use for remote sync states.
	 * @param decentralisedStorageMethodId The id of the identity method to use when signing/verifying changesets.
	 */
	constructor(
		logging: ILoggingConnector | undefined,
		eventBusComponent: IEventBusComponent,
		identityConnector: IIdentityConnector,
		blobStorageHelper: BlobStorageHelper,
		decentralisedStorageMethodId: string
	) {
		this._logging = logging;
		this._eventBusComponent = eventBusComponent;
		this._decentralisedStorageMethodId = decentralisedStorageMethodId;
		this._blobStorageHelper = blobStorageHelper;
		this._identityConnector = identityConnector;
	}

	/**
	 * Set the node identity to use for signing changesets.
	 * @param nodeIdentity The identity of the node that is performing the update.
	 */
	public setNodeIdentity(nodeIdentity: string): void {
		this._nodeIdentity = nodeIdentity;
	}

	/**
	 * Get and verify a changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns The changeset if it was verified.
	 */
	public async getAndVerifyChangeset(
		changeSetStorageId: string
	): Promise<ISyncChangeSet<T> | undefined> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getChangeSet",
			data: {
				changeSetStorageId
			}
		});

		try {
			const syncChangeSet = await this._blobStorageHelper.loadBlob(changeSetStorageId);

			if (Is.object<ISyncChangeSet<T>>(syncChangeSet)) {
				const verified = await this.verifyChangesetProof(syncChangeSet);
				return verified ? syncChangeSet : undefined;
			}
		} catch (error) {
			await this._logging?.log({
				level: "warn",
				source: this.CLASS_NAME,
				message: "getChangeSetError",
				data: {
					changeSetStorageId
				},
				error: BaseError.fromError(error)
			});
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "getChangeSetEmpty",
			data: {
				changeSetStorageId
			}
		});
	}

	/**
	 * Apply a sync changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns The changeset if it existed.
	 */
	public async getAndApplyChangeset(
		changeSetStorageId: string
	): Promise<ISyncChangeSet<T> | undefined> {
		const syncChangeset = await this.getAndVerifyChangeset(changeSetStorageId);

		// Only apply changesets from other nodes, we don't want to overwrite
		// any changes we have made to local entity storage
		if (!Is.empty(syncChangeset) && syncChangeset.nodeIdentity !== this._nodeIdentity) {
			await this.applyChangeset(syncChangeset);
		}

		return syncChangeset;
	}

	/**
	 * Apply a sync changeset.
	 * @param syncChangeset The sync changeset to apply.
	 * @returns Nothing.
	 */
	public async applyChangeset(syncChangeset: ISyncChangeSet<T>): Promise<void> {
		if (Is.arrayValue(syncChangeset.changes)) {
			for (const change of syncChangeset.changes) {
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "changeSetApplyingChange",
					data: {
						operation: change.operation,
						id: change.id
					}
				});

				switch (change.operation) {
					case SyncChangeOperation.Set:
						if (!Is.empty(change.entity)) {
							// The id was stripped from the entity as it is part of the operation
							// we make sure we reinstate it in the publish
							// Also the node identity was stripped when stored in the changeset
							// as the changeset is signed with the node identity.
							// so we need to restore it here.
							await this._eventBusComponent.publish<ISyncItemSet>(
								SynchronisedStorageTopics.RemoteItemSet,
								{
									storageKey: syncChangeset.storageKey,
									entity: {
										...change.entity,
										id: change.id,
										nodeIdentity: syncChangeset.nodeIdentity
									}
								}
							);
						}
						break;
					case SyncChangeOperation.Delete:
						if (!Is.empty(change.id)) {
							await this._eventBusComponent.publish<ISyncItemRemove>(
								SynchronisedStorageTopics.RemoteItemRemove,
								{
									storageKey: syncChangeset.storageKey,
									id: change.id,
									nodeIdentity: syncChangeset.nodeIdentity
								}
							);
						}
						break;
				}
			}
		}
	}

	/**
	 * Store the changeset.
	 * @param syncChangeSet The sync change set to store.
	 * @returns The id of the change set.
	 */
	public async storeChangeSet(syncChangeSet: ISyncChangeSet): Promise<string> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "changeSetStoring",
			data: {
				id: syncChangeSet.id
			}
		});

		return this._blobStorageHelper.saveBlob(syncChangeSet);
	}

	/**
	 * Verify the proof of a sync changeset.
	 * @param syncChangeset The sync changeset to verify.
	 * @returns True if the proof is valid, false otherwise.
	 */
	public async verifyChangesetProof(syncChangeset: ISyncChangeSet): Promise<boolean> {
		if (Is.empty(syncChangeset.proof)) {
			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "verifyChangeSetProofMissing",
				data: {
					snapshotId: syncChangeset.id
				}
			});
			return false;
		}

		// If the proof or verification method is missing, the proof is invalid
		const verificationMethod = syncChangeset.proof?.verificationMethod;
		if (!Is.stringValue(verificationMethod)) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "verifyChangeSetProofMissing",
				data: {
					id: syncChangeset.id
				}
			});
		}

		// Parse the verification method and extract the node identity
		// this should match the node identity of the changeset
		// otherwise you could sign a changeset for another node
		const changeSetNodeIdentity = DocumentHelper.parseId(verificationMethod ?? "");
		if (changeSetNodeIdentity.id !== syncChangeset.nodeIdentity) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "verifyChangeSetProofNodeIdentityMismatch",
				data: {
					id: syncChangeset.id
				}
			});
		}

		const changeSetWithoutProof = ObjectHelper.clone(syncChangeset);
		delete changeSetWithoutProof.proof;

		const isValid = await this._identityConnector.verifyProof(
			changeSetWithoutProof as unknown as IJsonLdNodeObject,
			syncChangeset.proof
		);

		if (!isValid) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "verifyChangeSetProofInvalid",
				data: {
					id: syncChangeset.id
				}
			});
		} else {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "verifyChangeSetProofValid",
				data: {
					id: syncChangeset.id
				}
			});
		}

		return isValid;
	}

	/**
	 * Create the proof of a sync change set.
	 * @param syncChangeset The sync changeset to create the proof for.
	 * @returns The proof.
	 */
	public async createChangeSetProof(syncChangeset: ISyncChangeSet): Promise<IProof> {
		Guards.stringValue(this.CLASS_NAME, "nodeIdentity", this._nodeIdentity);

		const changeSetWithoutProof = ObjectHelper.clone(syncChangeset);
		delete changeSetWithoutProof.proof;

		const proof = await this._identityConnector.createProof(
			this._nodeIdentity,
			DocumentHelper.joinId(this._nodeIdentity, this._decentralisedStorageMethodId),
			ProofTypes.DataIntegrityProof,
			changeSetWithoutProof as unknown as IJsonLdNodeObject
		);

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "createdChangeSetProof",
			data: {
				id: syncChangeset.id,
				...proof
			}
		});

		return proof;
	}

	/**
	 * Copy a change set.
	 * @param syncChangeSet The sync changeset to copy.
	 * @returns The id of the updated change set.
	 */
	public async copyChangeset(syncChangeSet: ISyncChangeSet<T>): Promise<
		| {
				syncChangeSet: ISyncChangeSet<T>;
				changeSetStorageId: string;
		  }
		| undefined
	> {
		if (Is.stringValue(this._nodeIdentity)) {
			const verified = await this.verifyChangesetProof(syncChangeSet);

			if (verified) {
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "copyChangeSet",
					data: {
						changeSetStorageId: syncChangeSet.id
					}
				});

				// Allocate a new id to the changeset copy and re-create a proof using this nodes identity
				const copy = ObjectHelper.clone(syncChangeSet);
				copy.id = Converter.bytesToHex(RandomHelper.generate(32));
				copy.proof = await this.createChangeSetProof(copy);

				// Store the copy
				return {
					syncChangeSet: copy,
					changeSetStorageId: await this.storeChangeSet(copy)
				};
			}
		}
	}

	/**
	 * Reset the storage for a given storage key.
	 * @param storageKey The key of the storage to reset.
	 * @param resetMode The reset mode, this will use the nodeIdentity in the entities to determine which are local/remote.
	 * @returns Nothing.
	 */
	public async reset(storageKey: string, resetMode: SyncNodeIdentityMode): Promise<void> {
		// If we are applying a consolidation we need to reset the local db
		// but keep any entries from the local node, as they might have been updated
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "storageReset",
			data: {
				storageKey
			}
		});
		await this._eventBusComponent.publish<ISyncReset>(SynchronisedStorageTopics.Reset, {
			storageKey,
			resetMode
		});
	}
}
