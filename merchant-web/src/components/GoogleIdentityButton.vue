<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsApi {
  id: {
    initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
    renderButton(element: HTMLElement, options: Record<string, unknown>): void;
    cancel(): void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccountsApi };
  }
}

const props = withDefaults(defineProps<{
  clientId?: string;
  disabled?: boolean;
}>(), {
  clientId: '',
  disabled: false,
});

const emit = defineEmits<{
  credential: [token: string];
  error: [];
}>();

const button = ref<HTMLElement | null>(null);
let disposed = false;

function renderButton(): void {
  if (disposed || !button.value || !props.clientId || !window.google || props.disabled) return;
  button.value.replaceChildren();
  window.google.accounts.id.initialize({
    client_id: props.clientId,
    callback: (response) => {
      if (response.credential) emit('credential', response.credential);
      else emit('error');
    },
  });
  window.google.accounts.id.renderButton(button.value, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: Math.min(button.value.clientWidth || 320, 360),
  });
}

function loadGoogleScript(): void {
  if (window.google) {
    renderButton();
    return;
  }
  const existing = document.querySelector<HTMLScriptElement>('script[data-mtrip-google-identity]');
  if (existing) {
    existing.addEventListener('load', renderButton, { once: true });
    existing.addEventListener('error', () => emit('error'), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.dataset.mtripGoogleIdentity = 'true';
  script.addEventListener('load', renderButton, { once: true });
  script.addEventListener('error', () => emit('error'), { once: true });
  document.head.appendChild(script);
}

watch(() => [props.clientId, props.disabled], () => {
  if (props.clientId && !props.disabled) loadGoogleScript();
  else button.value?.replaceChildren();
});

onMounted(() => {
  if (props.clientId && !props.disabled) loadGoogleScript();
});

onBeforeUnmount(() => {
  disposed = true;
  window.google?.accounts.id.cancel();
});
</script>

<template>
  <div ref="button" class="google-identity-button" :aria-disabled="disabled" />
</template>

<style scoped>
.google-identity-button {
  display: flex;
  min-height: 44px;
  justify-content: center;
  overflow: hidden;
}
</style>
