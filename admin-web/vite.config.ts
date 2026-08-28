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
    port: 5173,
    proxy: {
      // 开发环境转发到本地网关(OpenResty,deploy/docker-compose 默认 8081)
      '/api': {
        target: process.env.MTRIP_DEV_GATEWAY || 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      // 上传文件静态访问同样经网关(否则相对 /uploads 预览在 5173 会 404)
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
