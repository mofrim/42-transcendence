import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        // fix Issue #33
        chunkSizeWarningLimit: 1_500,
    },
    server: {
        proxy: {
            '/api/login': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/logout': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/user': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/protected': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/socket.io/': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        },
    },
});
