import { defineStore } from 'pinia';
import { ref } from 'vue';

/** 商户代入会话(整改 B2):全局横幅数据源 */
export interface ImpersonationSession {
  sessionId: number;
  sessionKey: string;
  merchantId: number;
  merchantName: string;
  reason: string;
}

export const useImpersonationStore = defineStore('impersonation', () => {
  const active = ref<ImpersonationSession | null>(null);

  function start(session: ImpersonationSession): void {
    active.value = session;
  }

  function end(): void {
    active.value = null;
  }

  return { active, start, end };
});
