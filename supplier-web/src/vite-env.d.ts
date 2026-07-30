/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_APP_TITLE: string;
  /** 登录传输加密密钥(与后端 MTRIP_MERCHANT_AES_KEY 同值,留空则明文) */
  readonly VITE_LOGIN_AES_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
