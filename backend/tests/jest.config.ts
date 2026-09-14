import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const presetConfig = createDefaultEsmPreset();

export default {
    ...presetConfig,
    testMatch: ['**/*.test.ts'],
    verbose: true,
} satisfies Config;
