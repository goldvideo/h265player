// https://eslint.org/docs/user-guide/configuring
module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true
	},
	extends: 'eslint:recommended',
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly'
	},
	parser: 'babel-eslint',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		allowImportExportEverywhere: true
	},
	// https://eslint.org/docs/rules/
	rules: {
		'no-unused-vars': [
			'warn',
			{
				vars: 'all',
				args: 'after-used',
				ignoreRestSiblings: false,
				caughtErrors: 'none'
			}
		],
		'no-empty': 0,
		'no-prototype-builtins': 1,
		"no-undef": 0,
		"no-constant-condition": [
			"error", 
			{ 
				"checkLoops": false 
			}
		]
	}
};
