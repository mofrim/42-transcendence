// random utils...

import axios from 'axios';

/**
 * a simple convenience wrapper to axios with withCredentials set per default.
 */
export const api = axios.create({ withCredentials: true });

/**
 * Debug console-log only in dev mode - a console.log with a `[DBG]` prefix.
 */
export const logdbg = (...args: unknown[]) => {
    if (import.meta.env.MODE !== 'production') {
        console.log('[DBG]', ...args);
    }
};
