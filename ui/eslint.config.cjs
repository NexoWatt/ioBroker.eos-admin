/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Echte ESLint-/TypeScript-/Security-Prüfung der maßgeblichen Produktquellen.
 * Wirkung: Nur Entwicklungsprüfung. Kein Laden von Regeln oder Konfiguration im Adapter.
 * Grenze: Syntaktische Scannerhinweise ersetzen weder Typprüfung noch Datenflussanalyse.
 * Altbefunde werden separat und sichtbar inventarisiert; Inline-Abschaltungen wirken nicht.
 */
const parser = require('@typescript-eslint/parser');
const typescript = require('@typescript-eslint/eslint-plugin');
const security = require('eslint-plugin-security');

module.exports = [
  {
    name: 'nexowatt/product-sources',
    files: [
      'src-ts/runtime-executables/**/*.{ts,tsx}',
      'src-admin-tab/src/**/*.{ts,tsx}',
      'src-admin-tab/vite.config.ts',
    ],
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    plugins: { '@typescript-eslint': typescript, security },
    rules: {
      ...Object.fromEntries(Object.keys(security.configs.recommended.rules).map(name => [name, 'error'])),
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': true, 'ts-check': false,
      }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-proto': 'error',
      'no-script-url': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
    },
  },
];
