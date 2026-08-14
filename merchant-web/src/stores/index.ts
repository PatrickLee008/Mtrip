import { createPinia } from 'pinia';

export const pinia = createPinia();

// 导出所有 store
export * from './app';
export * from './user';
