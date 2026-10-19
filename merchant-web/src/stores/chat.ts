import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatAction, chatPreferences, chatSummary, chatUrl } from '@/api/chat';
import { useUserStore } from '@/stores/user';
import { message } from 'ant-design-vue';
import { i18n } from '@/locales';
import { BizError } from '@/utils/http';

export const useChatStore = defineStore('chat', () => {
  const unread = ref(0);
  const connected = ref(false);
  const revision = ref(0);
  const activeConversation = ref(0);
  const inappEnabled = ref(true);
  const soundEnabled = ref(false);
  const event = ref<{ conversationId?: number; kind?: string; messageId?: number; senderRole?: string; recipientIds?: number[] }>({});
  const seen = new Set<number>();
  let audio: AudioContext | undefined;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let delay = 1000;
  async function refresh() {
    const g = generation;
    try { const s = await chatSummary(); if (g === generation) unread.value = s.unread; } catch (e) { stopIfDenied(e, g); }
  }
  function stop() {
    ++generation; clearTimeout(retry); clearInterval(ping);
    if (socket) { socket.onclose = null; socket.close(); socket = null; }
    connected.value = false; unread.value = 0;
  }
  function stopIfDenied(error: unknown, g: number): boolean {
    if (g !== generation) return true;
    if (error instanceof BizError && [40101, 40102, 40301, 40302].includes(error.code)) {
      stop();
      return true;
    }
    return false;
  }
  async function preferences(inapp: boolean, sound: boolean) {
    await chatAction('preferences', { inappEnabled: inapp ? 1 : 0, soundEnabled: sound ? 1 : 0 });
    inappEnabled.value = inapp; soundEnabled.value = sound;
    if (sound) { audio ??= new AudioContext(); await audio.resume(); }
  }
  function start() {
    stop();
    delay = 1000;
    const g = generation;
    const connect = async () => {
      if (g !== generation) return;
      try {
        const { ticket } = await chatAction<{ ticket: string }>('ticket', {});
        if (g !== generation) return;
        socket = new WebSocket(chatUrl('socket').replace(/^http/, 'ws') + '?ticket=' + encodeURIComponent(ticket));
        socket.onmessage = (e) => {
          if (g !== generation) return;
          const data = JSON.parse(e.data);
          if (data.kind === 'pong') return;
          if (data.kind === 'ready') { connected.value = true; delay = 1000; }
          event.value = data; ++revision.value;
          if (data.kind === 'message' && data.senderRole === 'user' && data.recipientIds?.includes(useUserStore().profile?.id) && !seen.has(data.messageId)) {
            seen.add(data.messageId);
            if (seen.size > 500) seen.delete(seen.values().next().value!);
            const reading = activeConversation.value === data.conversationId && document.visibilityState === 'visible' && document.hasFocus();
            if (inappEnabled.value && !reading) {
              message.info(i18n.global.t('chat.newMessages'));
              if (soundEnabled.value && audio?.state === 'running') {
                const tone = audio.createOscillator(); const gain = audio.createGain();
                gain.gain.value = 0.08; tone.frequency.value = 660;
                tone.connect(gain); gain.connect(audio.destination); tone.start(); tone.stop(audio.currentTime + 0.12);
              }
            }
          }
          if (data.kind !== 'receipt') void refresh();
        };
        socket.onopen = () => { clearInterval(ping); ping = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000); };
        socket.onclose = () => { connected.value = false; clearInterval(ping); if (g === generation) { retry = setTimeout(connect, delay); delay = Math.min(30000, delay * 2); } };
        socket.onerror = () => socket?.close();
      } catch (e) { if (!stopIfDenied(e, g)) retry = setTimeout(connect, Math.min(30000, delay *= 2)); }
    };
    void refresh(); void connect();
    void chatPreferences().then((p) => { if (g === generation) { inappEnabled.value = p.inapp_enabled; soundEnabled.value = p.sound_enabled; } }).catch((e) => { stopIfDenied(e, g); });
  }
  return { unread, connected, revision, event, activeConversation, inappEnabled, soundEnabled, preferences, start, stop, refresh };
});
