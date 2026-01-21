import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                process: 'readonly',
                NodeJS: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
                Buffer: 'readonly',
                Promise: 'readonly',
                URLSearchParams: 'readonly',
                Date: 'readonly',
                JSON: 'readonly',
                Math: 'readonly',
                Object: 'readonly',
                Array: 'readonly',
                String: 'readonly',
                Number: 'readonly',
                Boolean: 'readonly',
                Error: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                WeakMap: 'readonly',
                WeakSet: 'readonly',
                Symbol: 'readonly',
                RegExp: 'readonly',
                Intl: 'readonly',
                alert: 'readonly',
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                RequestInit: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                URL: 'readonly',
                AbortController: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            react: react,
            'react-hooks': reactHooks,
        },
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-unused-vars': 'off',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        ignores: ['node_modules/', '.expo/', 'dist/', 'build/', '*.config.js'],
    },
];
