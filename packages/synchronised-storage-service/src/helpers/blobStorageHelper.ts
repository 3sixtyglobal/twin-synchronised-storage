// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IBlobStorageConnector } from "@twin.org/blob-storage-models";
import {
	BaseError,
	Compression,
	CompressionType,
	GeneralError,
	Is,
	ObjectHelper
} from "@twin.org/core";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import { type IVaultConnector, VaultEncryptionType } from "@twin.org/vault-models";

/**
 * Class for performing blob storage operations.
 */
export class BlobStorageHelper {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<BlobStorageHelper>();

	/**
	 * The logging component to use for logging.
	 * @internal
	 */
	private readonly _logging?: ILoggingComponent;

	/**
	 * The vault connector.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The blob storage connector to use.
	 * @internal
	 */
	private readonly _blobStorageConnector: IBlobStorageConnector;

	/**
	 * The id of the vault key to use for encrypting/decrypting blobs.
	 * @internal
	 */
	private readonly _blobStorageEncryptionKeyId: string;

	/**
	 * Is this a trusted node.
	 * @internal
	 */
	private readonly _isTrustedNode: boolean;

	/**
	 * Create a new instance of BlobStorageHelper.
	 * @param logging The logging component to use for logging.
	 * @param vaultConnector The vault connector to use for for the encryption key.
	 * @param blobStorageConnector The blob storage component to use.
	 * @param blobStorageEncryptionKeyId The id of the vault key to use for encrypting/decrypting blobs.
	 * @param isTrustedNode Is this a trusted node.
	 */
	constructor(
		logging: ILoggingComponent | undefined,
		vaultConnector: IVaultConnector,
		blobStorageConnector: IBlobStorageConnector,
		blobStorageEncryptionKeyId: string,
		isTrustedNode: boolean
	) {
		this._logging = logging;
		this._vaultConnector = vaultConnector;
		this._blobStorageConnector = blobStorageConnector;
		this._blobStorageEncryptionKeyId = blobStorageEncryptionKeyId;
		this._isTrustedNode = isTrustedNode;
	}

	/**
	 * Load a blob from storage.
	 * @param blobId The id of the blob to apply.
	 * @returns The blob.
	 */
	public async loadBlob<T>(blobId: string): Promise<T | undefined> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "loadBlob",
			data: {
				blobId
			}
		});

		try {
			const encryptedBlob = await this._blobStorageConnector.get(blobId);

			if (Is.uint8Array(encryptedBlob)) {
				const compressedBlob = await this._vaultConnector.decrypt(
					this._blobStorageEncryptionKeyId,
					VaultEncryptionType.ChaCha20Poly1305,
					encryptedBlob
				);

				const decompressedBlob = await Compression.decompress(compressedBlob, CompressionType.Gzip);
				await this._logging?.log({
					level: "info",
					source: this.CLASS_NAME,
					message: "loadedBlob",
					data: {
						blobId
					}
				});

				return ObjectHelper.fromBytes<T>(decompressedBlob);
			}
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "loadBlobFailed",
				data: {
					blobId
				},
				error: BaseError.fromError(error)
			});
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "loadBlobEmpty",
			data: {
				blobId
			}
		});
	}

	/**
	 * Save a blob.
	 * @param blob The blob to save.
	 * @returns The id of the blob.
	 */
	public async saveBlob<T>(blob: T): Promise<string> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "saveBlob"
		});

		if (!this._isTrustedNode) {
			throw new GeneralError(this.CLASS_NAME, "notTrustedNode");
		}

		const compressedBlob = await Compression.compress(
			ObjectHelper.toBytes(blob),
			CompressionType.Gzip
		);

		const encryptedBlob = await this._vaultConnector.encrypt(
			this._blobStorageEncryptionKeyId,
			VaultEncryptionType.ChaCha20Poly1305,
			compressedBlob
		);

		try {
			const blobId = await this._blobStorageConnector.set(encryptedBlob);

			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "savedBlob",
				data: {
					blobId
				}
			});
			return blobId;
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "saveBlobFailed",
				error: BaseError.fromError(error)
			});
			throw error;
		}
	}

	/**
	 * Remove a blob from storage.
	 * @param blobId The id of the blob to remove.
	 * @returns Nothing.
	 */
	public async removeBlob(blobId: string): Promise<void> {
		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "removeBlob",
			data: {
				blobId
			}
		});

		try {
			await this._blobStorageConnector.remove(blobId);

			await this._logging?.log({
				level: "info",
				source: this.CLASS_NAME,
				message: "removedBlob",
				data: {
					blobId
				}
			});
		} catch (error) {
			await this._logging?.log({
				level: "error",
				source: this.CLASS_NAME,
				message: "removeBlobFailed",
				data: {
					blobId
				},
				error: BaseError.fromError(error)
			});
		}

		await this._logging?.log({
			level: "info",
			source: this.CLASS_NAME,
			message: "removeBlobEmpty",
			data: {
				blobId
			}
		});
	}
}
