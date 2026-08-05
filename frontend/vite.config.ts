import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/login': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                // rewrite: (path) => path.replace(/^\/api\/auth/, ''),
            },
            '/api/user': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                // rewrite: (path) => path.replace(/^\/api\/users/, ''),
            },
            '/logout': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                // rewrite: (path) => path.replace(/^\/api\/users/, ''),
            },
        },
    },
});
