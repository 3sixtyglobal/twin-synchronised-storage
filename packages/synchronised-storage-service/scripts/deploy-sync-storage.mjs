// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * This script will generate the verifiable storage entries used as the root for the synchronised storage.
 * If they already exist it will make sure they are up to date with the current set of trusted identities.
 *
 * Usage:
 * npm run deploy-sync-storage
 *
 * The following env variables are used to configure the process.
 * DEPLOY_MNEMONIC     - 24 word mnemonic e.g. word1 word2...word24
 * DEPLOY_NETWORK      - network the deployment is happening on e.g. mainnet/testnet/devnet
 * DEPLOY_NODE_URL     - the node to make network requests e.g. https://api.testnet.iota.cafe
 * DEPLOY_CONTROLLER   - the identity which controls the deployment address e.g. did:iota:aaaa.....bbbbb
 * DEPLOY_ALLOW_LIST   - comma separated addresses to allow access e.g. 0xcccc...ddddd, 0xeeee...fffff
 * DEPLOY_WALLET_INDEX - address index of the wallet to use, defaults to 0 e.g. 5
 *
 * This script assumes the identities are already created, an identity can be created with the following scripts.
 *
 * // Create a new wallet
 * npx "@twin.org/identity-cli@next" mnemonic --env wallet.env
 *
 * // Generate some addresses
 * npx "@twin.org/identity-cli@next" address --load-env wallet.env --seed !SEED --count 1 --env wallet.env --merge-env
 *
 * // Create config.env
 * NODE_URL="https://api.testnet.iota.cafe"
 * FAUCET_URL="https://faucet.testnet.iota.cafe"
 * COIN_TYPE="4218"
 * NETWORK="testnet"
 * EXPLORER_URL="https://explorer.iota.org/"
 *
 * // Fund the wallet address from the faucet loading the config and wallet env files
 * // If this is mainnet your will not have access to a faucet, you need real tokens
 * npx "@twin.org/identity-cli@next" faucet --load-env config.env wallet.env --address !ADDRESS_0 --network !NETWORK
 *
 * // Create an identity
 * npx "@twin.org/identity-cli@next" identity-create --load-env config.env wallet.env --seed !SEED --env identity.env
 */
import { Coerce, Is, ObjectHelper } from '@twin.org/core';
import { MemoryEntityStorageConnector } from '@twin.org/entity-storage-connector-memory';
import { EntityStorageConnectorFactory } from '@twin.org/entity-storage-models';
import { EntityStorageVaultConnector, initSchema } from '@twin.org/vault-connector-entity-storage';
import { VaultConnectorFactory } from '@twin.org/vault-models';
import { IotaVerifiableStorageConnector } from '@twin.org/verifiable-storage-connector-iota';
import { loadJson, saveJson } from '../../../scripts/common.mjs';

const KEY_FILE = './src/data/verifiableStorageKeys.json';

/**
 * Execute the process.
 */
async function run() {
	process.stdout.write('Deploy Synchronised Storage\n');
	process.stdout.write('===========================\n');
	process.stdout.write('\n');
	process.stdout.write(`Platform: ${process.platform}\n`);
	process.stdout.write('\n');

	const mnemonic = process.env.DEPLOY_MNEMONIC;
	if (!Is.stringValue(mnemonic)) {
		throw new Error('Missing env property: DEPLOY_MNEMONIC');
	}
	const nodeUrl = process.env.DEPLOY_NODE_URL;
	if (!Is.stringValue(nodeUrl)) {
		throw new Error('Missing config property: DEPLOY_NODE_URL');
	}
	const network = process.env.DEPLOY_NETWORK;
	if (!Is.stringValue(network)) {
		throw new Error('Missing config property: DEPLOY_NETWORK');
	}
	const controller = process.env.DEPLOY_CONTROLLER;
	if (!Is.stringValue(controller)) {
		throw new Error('Missing config property: DEPLOY_CONTROLLER');
	}

	const addressIndex = Coerce.integer(process.env.DEPLOY_WALLET_INDEX) ?? 0;
	const allowListString = (process.env.DEPLOY_ALLOW_LIST ?? '').trim();

	if (allowListString.length > 0) {
		const allowList = allowListString.split(',');
		for (const allow of allowList) {
			if (!Is.stringHex(allow, true)) {
				throw new Error(`The allow entry should be an address in hex form, it is '${allow}'`);
			}
		}
	}

	process.stdout.write(`Network: ${network}\n`);
	process.stdout.write(`Node Url: ${nodeUrl}\n`);
	process.stdout.write(`Controller: ${controller}\n`);
	process.stdout.write(`Allow List: ${allowList.join(', ')}\n`);
	process.stdout.write(`Address Index: ${addressIndex}\n`);
	process.stdout.write('\n');

	await setupVaultConnector();

	const vaultMnemonicId = 'mnemonic';

	const vaultConnector = VaultConnectorFactory.get('vault');
	await vaultConnector.setSecret(`${controller}/${vaultMnemonicId}`, mnemonic);

	const verifiableStorageConnector = await setupVerifiableStorageConnector(
		nodeUrl,
		network,
		vaultMnemonicId,
		addressIndex
	);

	const keys = await loadJson(KEY_FILE);
	const key = keys[network];

	if (!Is.stringValue(key)) {
		throw new Error('There is no existing key for the network');
	}

	let existingData;
	try {
		process.stdout.write(`Looking for existing storage entry: ${key}\n`);

		existingData = await verifiableStorageConnector.get(key);
	} catch {}

	if (existingData) {
		process.stdout.write(`Storage entry already exists: ${key}\n`);
		process.stdout.write(`${JSON.stringify(ObjectHelper.fromBytes(existingData.data), null, 2)}\n`);

		process.stdout.write(`Checking allow list matches...\n`);
		const existingAllowList = existingData.allowList ?? [];
		let updateAllowList = false;
		for (const identity of allowList) {
			if (!existingAllowList.includes(identity)) {
				updateAllowList = true;
				break;
			}
		}
		if (updateAllowList) {
			process.stdout.write(`Allow list does not match, updating...\n`);
			await verifiableStorageConnector.update(controller, key, existingData.data, allowList);
		} else {
			process.stdout.write(`Allow list matches, no update required.\n`);
		}
	} else {
		process.stdout.write(`Storage entry does not exist, creating new one...\n`);
		const data = ObjectHelper.toBytes({ version: '1', syncPointers: {} });
		const newKey = await verifiableStorageConnector.create(controller, data, allowList);
		process.stdout.write(`Created new storage entry: ${newKey.id}\n`);

		key = newKey.id;
		keys[network] = key;
		process.stdout.write(`Saving key file\n`);
		await saveJson(KEY_FILE, keys);
	}

	const idParts = key.split(':');

	process.stdout.write(`\n`);
	process.stdout.write(`https://explorer.iota.org/object/${idParts[3]}?network=${network}\n`);
	process.stdout.write(`\n`);

	process.stdout.write(`Done.\n`);
}

/**
 * Setup the vault for using local in memory storage.
 */
async function setupVaultConnector() {
	initSchema();

	EntityStorageConnectorFactory.register(
		'vault-key',
		() =>
			new MemoryEntityStorageConnector({
				entitySchema: 'VaultKey'
			})
	);
	EntityStorageConnectorFactory.register(
		'vault-secret',
		() =>
			new MemoryEntityStorageConnector({
				entitySchema: 'VaultSecret'
			})
	);

	const vaultConnector = new EntityStorageVaultConnector();
	VaultConnectorFactory.register('vault', () => vaultConnector);
}

/**
 * Setup the verifiable storage connector.
 * @param nodeUrl The url pointing to a node hosting the IOTA API.
 * @param network The network to connect to.
 * @param vaultSeedId The vault seed id.
 * @param addressIndex The address index.
 * @returns The verifiable storage connector.
 */
async function setupVerifiableStorageConnector(nodeUrl, network, vaultSeedId, addressIndex) {
	const connector = new IotaVerifiableStorageConnector({
		config: {
			clientOptions: {
				url: nodeUrl
			},
			network,
			vaultSeedId,
			walletAddressIndex: addressIndex ?? 0
		}
	});

	await connector.start();

	return connector;
}

run().catch(err => {
	process.stderr.write(`\n${err.stack ?? err}\n`);
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(1);
});
