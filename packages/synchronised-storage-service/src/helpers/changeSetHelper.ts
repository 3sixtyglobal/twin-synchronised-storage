// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BlobStorageCompressionType,
	type IBlobStorageComponent
} from "@twin.org/blob-storage-models";
import { Converter, Is, ObjectHelper } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IEventBusComponent } from "@twin.org/event-bus-models";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import type { ILoggingConnector } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import { type IProof, ProofTypes } from "@twin.org/standards-w3c-did";
import {
	type ISyncItemSet,
	SynchronisedStorageTopics,
	type ISynchronisedEntity,
	type ISyncItemRemove,
	SyncChangeOperation
} from "@twin.org/synchronised-storage-models";
import type { ISyncChangeSet } from "../models/ISyncChangeSet";

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
	 * The blob storage component to use for remote sync states.
	 * @internal
	 */
	private readonly _blobStorageComponent: IBlobStorageComponent;

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
	 * Create a new instance of ChangeSetHelper.
	 * @param logging The logging connector to use for logging.
	 * @param eventBusComponent The event bus component to use for events.
	 * @param blobStorageComponent The blob storage component to use for remote sync states.
	 * @param identityConnector The identity connector to use for signing/verifying changesets.
	 * @param decentralisedStorageMethodId The id of the identity method to use when signing/verifying changesets.
	 */
	constructor(
		logging: ILoggingConnector | undefined,
		eventBusComponent: IEventBusComponent,
		blobStorageComponent: IBlobStorageComponent,
		identityConnector: IIdentityConnector,
		decentralisedStorageMethodId: string
	) {
		this._logging = logging;
		this._eventBusComponent = eventBusComponent;
		this._decentralisedStorageMethodId = decentralisedStorageMethodId;
		this._blobStorageComponent = blobStorageComponent;
		this._identityConnector = identityConnector;
	}

	/**
	 * Get and verify a changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns The changeset if it was verified.
	 */
	public async getAndVerifyChangeset(
		changeSetStorageId: string
	): Promise<ISyncChangeSet<T> | undefined> {
		// Changesets are not encrypted as they are signed with the node identity
		// and they are publicly accessible so that other nodes can retrieve them.
		const blobEntry = await this._blobStorageComponent.get(changeSetStorageId, {
			includeContent: true
		});
		if (Is.stringBase64(blobEntry.blob)) {
			const syncChangeset = ObjectHelper.fromBytes<ISyncChangeSet<T>>(
				Converter.base64ToBytes(blobEntry.blob)
			);

			const verified = await this.verifyChangesetProof(syncChangeset);
			return verified ? syncChangeset : undefined;
		}
	}

	/**
	 * Apply a sync changeset.
	 * @param changeSetStorageId The id of the sync changeset to apply.
	 * @returns True if the change was applied.
	 */
	public async getAndApplyChangeset(changeSetStorageId: string): Promise<boolean> {
		const syncChangeset = await this.getAndVerifyChangeset(changeSetStorageId);

		if (!Is.empty(syncChangeset)) {
			await this.applyChangeset(syncChangeset);
			return true;
		}

		return false;
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
							// The node identity was stripped when stored in the changeset
							// as the changeset is signed with the node identity.
							// so we need to restore it here.
							change.entity.nodeIdentity = syncChangeset.nodeIdentity;
							await this._eventBusComponent.publish<ISyncItemSet>(
								SynchronisedStorageTopics.RemoteItemSet,
								{
									schemaType: syncChangeset.schemaType,
									entity: change.entity
								}
							);
						}
						break;
					case SyncChangeOperation.Delete:
						if (!Is.empty(change.id)) {
							await this._eventBusComponent.publish<ISyncItemRemove>(
								SynchronisedStorageTopics.RemoteItemRemove,
								{
									schemaType: syncChangeset.schemaType,
									id: change.id
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

		// We don't want to encrypt the sync state as no other nodes would be able to read it
		// the blob storage also needs to be publicly accessible so that other nodes can retrieve it
		return this._blobStorageComponent.create(
			Converter.bytesToBase64(ObjectHelper.toBytes<ISyncChangeSet>(syncChangeSet)),
			undefined,
			undefined,
			undefined,
			{
				disableEncryption: true,
				compress: BlobStorageCompressionType.Gzip
			}
		);
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
		const changeSetWithoutProof = ObjectHelper.clone(syncChangeset);
		delete changeSetWithoutProof.proof;

		const proof = await this._identityConnector.createProof(
			syncChangeset.nodeIdentity,
			DocumentHelper.joinId(syncChangeset.nodeIdentity, this._decentralisedStorageMethodId),
			ProofTypes.DataIntegrityProof,
			changeSetWithoutProof as unknown as IJsonLdNodeObject
		);

		await this._logging?.log({
			level: "error",
			source: this.CLASS_NAME,
			message: "createdChangeSetProof",
			data: {
				id: syncChangeset.id,
				...proof
			}
		});

		return proof;
	}
}
