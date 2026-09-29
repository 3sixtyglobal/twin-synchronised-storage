// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
export function extendConfig(allRules, config) {
	if (Array.isArray(config[0].ignores)) {
		// Validators compiled from the schemas by ts-to-schema.
		config[0].ignores.push('./packages/*/src/compiled/**/*');
	}
}
