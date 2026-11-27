<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CalendarOutlined, NotificationOutlined, SearchOutlined, ShopOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue';
import { searchRecords, type SearchCategory, type SearchHit } from '@/api/globalSearch';
import { useAppStore } from '@/stores/app';

const categories = [
  { key: 'merchant', path: '/merchant/list', icon: ShopOutlined },
  { key: 'booking', path: '/order/all', icon: CalendarOutlined },
  { key: 'affiliate', path: '/affiliate/partners', icon: TeamOutlined },
  { key: 'campaign', path: '/marketing/campaign', icon: NotificationOutlined },
  { key: 'user', path: '/system/admin', icon: UserOutlined },
] as const;
const router = useRouter();
const route = useRoute();
const app = useAppStore();
const { t } = useI18n();
// Only pages installed from this account's menu have an exact path match.
const available = computed(() => categories.filter(c => router.resolve(c.path).matched.some(r => r.path === c.path)));
const chosen = ref<SearchCategory>(route.path === '/order/all' ? 'booking' : 'merchant');
const category = computed(() => available.value.find(c => c.key === chosen.value) ?? available.value[0]);
const wrap = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const keyword = ref('');
const open = ref(false);
const picking = ref(false);
const choosing = computed(() => picking.value || !keyword.value.trim());
const hits = ref<SearchHit[]>([]);
const loading = ref(false);
const failed = ref(false);
const active = ref(0);
const record = ref<SearchHit | null>(null);
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

watch([open, choosing, keyword, category, () => app.siteId], ([visible, menu, value, source, site], _, cleanup) => {
  hits.value = [];
  active.value = 0;
  failed.value = false;
  loading.value = false;
  if (!visible || menu || !source) return;
  let current = true;
  loading.value = true;
  const timer = window.setTimeout(async () => {
    try {
      const data = await searchRecords(source.key, value.trim(), site);
      if (current) hits.value = data;
    } catch {
      if (current) failed.value = true;
    } finally {
      if (current) loading.value = false;
    }
  }, 220);
  cleanup(() => { current = false; clearTimeout(timer); });
}, { flush: 'sync' });

function close() {
  open.value = false;
  picking.value = false;
}

function pick(key: SearchCategory) {
  chosen.value = key;
  picking.value = false;
  input.value?.focus();
  open.value = true;
}

function select(hit: SearchHit) {
  const source = category.value;
  if (!source) return;
  close();
  input.value?.blur();
  if (source.key === 'merchant' || source.key === 'booking') {
    void router.push({ path: source.path, query: { searchId: hit.id } });
  } else {
    record.value = hit;
  }
}

function keys(e: KeyboardEvent) {
  if (e.isComposing) return;
  if (e.key === 'Escape') { close(); return; }
  const length = choosing.value ? available.value.length : hits.value.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    open.value = true;
    if (length) active.value = (active.value + (e.key === 'ArrowDown' ? 1 : length - 1)) % length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!open.value) { open.value = true; return; }
    if (choosing.value && available.value[active.value]) pick(available.value[active.value].key);
    else if (hits.value[active.value]) select(hits.value[active.value]);
  }
}

function hotkey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k' || !input.value || record.value) return;
  e.preventDefault();
  input.value.focus();
  input.value.select();
  open.value = true;
}

function outside(e: MouseEvent | FocusEvent) {
  if (!wrap.value?.contains(e.target as Node)) close();
}

function showCategories() {
  input.value?.focus();
  open.value = true;
  picking.value = true;
  active.value = available.value.findIndex(c => c.key === category.value?.key);
}

watch([() => route.path, () => app.siteId], () => { close(); record.value = null; });
onMounted(() => {
  document.addEventListener('keydown', hotkey);
  document.addEventListener('mousedown', outside);
  document.addEventListener('focusin', outside);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', hotkey);
  document.removeEventListener('mousedown', outside);
  document.removeEventListener('focusin', outside);
});
</script>

<template>
  <div v-if="category" ref="wrap" class="header-search-wrap">
    <div :class="['header-search', { focused: open }]">
      <SearchOutlined class="search-icon" />
      <button class="search-cat" :aria-label="t('globalSearch.categories')" @click="showCategories">
        <component :is="category.icon" />{{ t('globalSearch.' + category.key) }}
      </button>
      <input ref="input" v-model="keyword" class="search-input" role="combobox" autocomplete="off"
        maxlength="100" :placeholder="t('globalSearch.hints.' + category.key)" :aria-label="t('globalSearch.label')"
        aria-controls="global-search-options" aria-autocomplete="list" :aria-expanded="open"
        :aria-activedescendant="open && (choosing || hits.length) ? 'gs-option-' + active : undefined"
        @focus="open = true" @click="open = true" @input="picking = false; open = true" @keydown="keys" />
      <kbd class="search-kbd">{{ shortcut }}</kbd>
    </div>
    <div v-if="open" class="search-dropdown">
      <div class="search-dropdown-title" role="status">
        {{ choosing ? t('globalSearch.categories') : loading ? t('globalSearch.loading') : failed ? t('globalSearch.failed') : hits.length ? t('globalSearch.results') : t('globalSearch.empty') }}
      </div>
      <div id="global-search-options" role="listbox" :aria-label="t('globalSearch.label')">
        <template v-if="choosing">
          <button v-for="(cat, i) in available" :id="'gs-option-' + i" :key="cat.key" role="option" tabindex="-1"
            :aria-selected="active === i" :class="['search-dropdown-item', { active: active === i }]"
            @mouseenter="active = i" @mousedown.prevent @click="pick(cat.key)">
            <component :is="cat.icon" />{{ t('globalSearch.' + cat.key) }}
          </button>
        </template>
        <template v-else>
          <button v-for="(hit, i) in hits" :id="'gs-option-' + i" :key="hit.id" role="option" tabindex="-1"
            :aria-selected="active === i" :class="['search-dropdown-item', { active: active === i }]"
            @mouseenter="active = i" @mousedown.prevent @click="select(hit)">
            <span class="hit-text"><strong>{{ hit.title }}</strong><small>{{ [hit.subtitle, '#' + hit.id].filter(Boolean).join(' · ') }}</small></span>
          </button>
        </template>
      </div>
    </div>
    <a-modal :open="!!record" :title="record?.title" :footer="null" @cancel="record = null">
      <a-descriptions v-if="record" :column="1" bordered size="small">
        <a-descriptions-item :label="t('common.id')">{{ record.id }}</a-descriptions-item>
        <a-descriptions-item v-if="record.subtitle" :label="t('globalSearch.secondary.' + category.key)">{{ record.subtitle }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.site')">{{ record.siteId || t('app.allSites') }}</a-descriptions-item>
        <a-descriptions-item v-for="(value, field) in record.details" :key="field" :label="t('globalSearch.fields.' + field)">
          {{ value === null || value === '' ? '—' : value }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.header-search-wrap {
  position: relative;
  width: 300px;
  flex-shrink: 0;
}

.header-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--mtrip-bg-page);
  border: 1px solid var(--mtrip-border);
  transition: all 0.15s ease;

  &.focused {
    background: var(--mtrip-bg-card);
    border-color: var(--sap-brand);
    box-shadow: 0 0 0 3px rgba(22, 100, 255, 0.08);
  }

  .search-icon {
    font-size: 13px;
    color: var(--mtrip-text-aux);
    flex-shrink: 0;
  }

  .search-cat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: #eef4ff;
    color: #1664ff;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--mtrip-text-main);
  }

  .search-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 18px;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid var(--mtrip-border);
    background: var(--mtrip-bg-page);
    color: var(--mtrip-text-aux);
    font-size: 10px;
    flex-shrink: 0;
  }
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  border-radius: 8px;
  background: var(--mtrip-bg-card);
  border: 1px solid var(--mtrip-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 50;
  max-height: min(450px, 70vh);
  overflow-y: auto;
  line-height: 1.5;

  .search-dropdown-title {
    padding: 8px 12px 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--mtrip-text-aux);
    border-bottom: 1px solid var(--mtrip-bg-page);
  }

  .search-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 12px;
    border: none;
    background: transparent;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    color: var(--mtrip-text-main);

    &.active {
      background: #eef4ff;
      color: #1664ff;
    }

    &:hover {
      background: var(--mtrip-bg-page);
    }

    .hit-text {
      display: grid;
      min-width: 0;
      line-height: 1.5;
      strong, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      small { color: var(--mtrip-text-aux); }
    }
  }
}

</style>
