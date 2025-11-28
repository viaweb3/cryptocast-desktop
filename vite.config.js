import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: 'dist/renderer',
        emptyOutDir: true,
        assetsDir: './assets',
    },
    server: {
        port: 5173,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer/src'),
        },
    },
});
