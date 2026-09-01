import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      less: { javascriptEnabled: true },
    },
  },
  server: {
    // 与 admin-web(5173)并存,商家端用 5174
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      // 开发环境转发到本地网关(OpenResty,deploy/docker-compose 默认 8081)
      '/api': {
        target: process.env.MTRIP_DEV_GATEWAY || 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.MTRIP_DEV_GATEWAY || 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ['ant-design-vue', '@ant-design/icons-vue'],
          echarts: ['echarts'],
        },
      },
    },
  },
});
