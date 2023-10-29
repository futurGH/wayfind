import tsEslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const plugins = {
	"@typescript-eslint": tsEslint,
	"react-hooks": reactHooks,
	"react-refresh": reactRefresh,
};

const rules = tsEslint.configs["strict-type-checked"].rules;

const linterOptions = { reportUnusedDisableDirectives: true };

/** @type { import("eslint").Linter.FlatConfig[] } */
const config = [{
	files: ["app/**/*.{ts,tsx}"],
	ignores: ["app/*.config.ts"],
	plugins,
	rules: {
		...rules,
		"@typescript-eslint/no-unnecessary-condition": "warn",
		"@typescript-eslint/no-unsafe-assignment": "off",
		"@typescript-eslint/no-unsafe-member-access": "off",
		"@typescript-eslint/no-unsafe-argument": "off",
		"@typescript-eslint/no-throw-literal": "off",
		"@typescript-eslint/no-non-null-assertion": "off",
	},
	linterOptions,
	languageOptions: {
		parser,
		parserOptions: { project: "./app/tsconfig.json" },
		globals: globals.browser,
	},
}, {
	files: ["server/**/*.ts"],
	plugins,
	rules,
	linterOptions,
	languageOptions: {
		parser,
		parserOptions: { project: "./server/tsconfig.json" },
		globals: globals.node,
	},
}, {
	files: ["scripts/**/*.ts"],
	plugins,
	rules,
	linterOptions,
	languageOptions: {
		parser,
		parserOptions: { project: "./scripts/tsconfig.json" },
		globals: globals.node,
	},
}, {
	files: ["lib/**/*.{ts,tsx}"],
	plugins,
	rules,
	linterOptions,
	languageOptions: {
		parser,
		parserOptions: { project: "./lib/tsconfig.json" },
		globals: globals.node,
	},
}];
export default config;
