// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Odin Mühlenbein & Ellie Xiang

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["**/dist/", "**/node_modules/", "**/*.config.*"],
  },

  // Base: JS recommended + TS strict for all TS files
  eslint.configs.recommended,
  ...tseslint.configs.strict,

  // Shared rule overrides
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Server config
  {
    files: ["packages/server/src/**/*.ts"],
  },

  // Web config: add React plugins
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
