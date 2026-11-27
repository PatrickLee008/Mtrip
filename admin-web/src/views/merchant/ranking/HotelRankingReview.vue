<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { readHistory, readPreview, writeMarket, type MarketScope, type MarketState } from '@/api/marketplace';
import type { TableRow } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';
import { formatMoney, formatAmount } from '@/utils/format';
import { messages } from './hotelRankingReviewMessages';

const props = defineProps<{
  scope: MarketScope; market: MarketState; rows: TableRow[]; publishedConfig: TableRow[]; cityLabel: string; busy: boolean;
}>();
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'busy-change', value: boolean): void }>();
const { t, te } = useI18n({ useScope: 'local', messages });
const user = useUserStore();
const scopeKey = computed(() => JSON.stringify(props.scope));
const hotels = computed(() => new Map(props.rows.map(row => [String(row.property_id), row])));
const hotelName = (row: TableRow) => row.property_name || hotels.value.get(String(row.property_id))?.property_name || t('property', { id: row.property_id });
const group = (row: TableRow) => Number(row.pinned) === 1 ? 0 : Number(row.featured) === 1 ? 1 : 2;

// Both snapshots are already in the consumer's priority/group order. Equal order can have different stored rank gaps.
function positions(rows: TableRow[], currentEligibility: boolean) {
  const groupCounts = [0, 0, 0];
  let cityRank = 0;
  return new Map(rows.map(row => {
    const key = String(row.property_id);
    const visible = currentEligibility && Number(row.status) === 1 && hotels.value.get(key)?.eligible;
    return [key, { row, cityRank: visible ? ++cityRank : null, groupRank: ++groupCounts[group(row)] }];
  }));
}
function differences(before: TableRow[], after: TableRow[], currentEligibility: boolean) {
  const previous = positions(before, currentEligibility);
  const next = positions(after, currentEligibility);
  const changes: { key: string; name: string; description: string }[] = [];
  for (const key of new Set([...next.keys(), ...previous.keys()])) {
    const from = previous.get(key), to = next.get(key);
    const fields: string[] = [];
    if (!from || !to) fields.push(t(to ? 'added' : 'removed'));
    if (currentEligibility && from?.cityRank !== to?.cityRank && (from?.cityRank || to?.cityRank)) {
      fields.push(t('cityRank') + ' ' + (from?.cityRank ?? '—') + ' → ' + (to?.cityRank ?? '—'));
    } else if (from && to && from.groupRank !== to.groupRank) {
      fields.push(t('groupRank') + ' ' + from.groupRank + ' → ' + to.groupRank);
    }
    for (const flag of ['pinned', 'featured', 'status']) {
      if (Number(from?.row[flag] ?? 0) === Number(to?.row[flag] ?? 0)) continue;
      const label = (row?: TableRow) => !row ? '—' : flag === 'status'
        ? t(Number(row.status) === 1 ? 'listed' : 'unlisted') : t(Number(row[flag]) === 1 ? 'on' : 'off');
      fields.push(t(flag === 'status' ? 'visibility' : flag) + ' ' + label(from?.row) + ' → ' + label(to?.row));
    }
    if (fields.length) changes.push({ key, name: hotelName((to || from)!.row), description: fields.join(' · ') });
  }
  return changes;
}
const changes = computed(() => differences(props.publishedConfig, props.rows, true));
const blockers = computed(() => props.rows.filter(row => Number(row.status) === 1 && !row.eligible).map(hotelName));
const publishLabel = computed(() => t('publish', { city: props.cityLabel }));
const publishOpen = ref(false);
const saving = ref(false);
const note = ref('');
const canPublish = computed(() => !saving.value && !props.busy && user.isSuper && user.hasPerm('merchant:ranking:publish')
  && changes.value.length > 0 && blockers.value.length === 0);
let reviewed: { key: string; scope: MarketScope; version: number } | undefined;
function openPublish() {
  if (!canPublish.value) return;
  reviewed = { key: scopeKey.value, scope: { ...props.scope }, version: Number(props.market.version) };
  note.value = '';
  publishOpen.value = true;
}
async function publish() {
  if (!publishOpen.value || !canPublish.value || !note.value.trim() || !reviewed
    || reviewed.key !== scopeKey.value || reviewed.version !== Number(props.market.version)) return;
  saving.value = true;
  emit('busy-change', true);
  try {
    await writeMarket('publish', reviewed.scope, reviewed.version, note.value.trim());
    message.success(t('success'));
  } catch {
    // The HTTP interceptor shows the server's explanation; reload the version and eligibility before retrying.
  } finally {
    publishOpen.value = false;
    if (reviewed.key === scopeKey.value) emit('refresh');
    saving.value = false;
    emit('busy-change', false);
  }
}

const panel = ref<'preview' | 'history'>();
const previewView = ref<'draft' | 'published'>('draft');
const previewRows = ref<TableRow[]>([]);
const previewVersion = ref(0);
const rawHistory = ref<TableRow[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
const historyRows = computed<TableRow[]>(() => rawHistory.value.map(entry => {
  // Historical configurations do not capture live eligibility. Use their group positions, never today's eligibility.
  const diff = differences(entry.before_json ?? [], entry.after_json ?? [], false);
  if (!diff.length && entry.entity_name && (Number(entry.from_rank) || Number(entry.to_rank))) {
    diff.push({ key: String(entry.entity_id), name: entry.entity_name, description: t('groupRank') + ' '
      + (Number(entry.from_rank) || '—') + ' → ' + (Number(entry.to_rank) || '—') });
  }
  return { ...entry, changes: diff };
}));
const reading = ref(false);
const readError = ref(false);
let readId = 0;
async function readPanel(target: 'preview' | 'history') {
  const id = ++readId;
  panel.value = target;
  reading.value = true;
  readError.value = false;
  try {
    if (target === 'preview') {
      const result = await readPreview({ ...props.scope }, previewView.value);
      if (id !== readId) return;
      previewRows.value = result.list;
      previewVersion.value = result.version;
    } else {
      const result = await readHistory({ ...props.scope }, historyPage.value);
      if (id !== readId) return;
      rawHistory.value = result.list;
      historyTotal.value = result.total;
    }
  } catch {
    if (id === readId) readError.value = true;
  } finally {
    if (id === readId) reading.value = false;
  }
}
function showPreview(view: 'draft' | 'published' = 'draft') {
  previewView.value = view;
  return readPanel('preview');
}
function showHistory(page = 1) {
  historyPage.value = page;
  return readPanel('history');
}
function closePanel() { readId++; panel.value = undefined; }
watch(scopeKey, closePanel, { flush: 'sync' });
watch([scopeKey, () => props.market.version], () => { publishOpen.value = false; }, { flush: 'sync' });

function price(row: TableRow): string {
  if (row.minPrice == null) return '—';
  if (!row.currency) return formatAmount(row.minPrice);
  const digits = ['MMK', 'JPY', 'KRW', 'VND'].includes(row.currency) ? 0 : 2;
  return formatMoney(row.minPrice, row.currency, digits);
}
</script>

<template>
  <a-space wrap>
    <a-button :disabled="busy || saving" @click="showHistory()">{{ t('history') }}</a-button>
    <a-button :disabled="busy || saving" @click="showPreview()">{{ t('preview') }}</a-button>
    <a-button v-if="user.isSuper" v-perm="'merchant:ranking:publish'" type="primary"
      :disabled="!canPublish" @click="openPublish">{{ publishLabel }}</a-button>
  </a-space>
  <div class="market-state">
    <a-tag :color="changes.length ? 'gold' : Number(market.published_version) ? 'green' : 'default'">
      {{ t(changes.length ? 'pending' : Number(market.published_version) ? 'synced' : 'empty') }}
    </a-tag>
    <span>{{ cityLabel }} · {{ t('draft') }} v{{ market.version }} · {{ t('online') }} v{{ market.published_version }}</span>
    <span v-if="market.updated_at">{{ t('updated') }} · {{ market.updated_by || '—' }} · {{ market.updated_at }}</span>
  </div>
  <a-alert v-if="blockers.length" class="blockers" type="warning" show-icon :message="t('blocked')" :description="blockers.join(' · ')" />

  <a-modal :open="publishOpen" :title="publishLabel" :ok-text="publishLabel" :confirm-loading="saving"
    :closable="!saving" :mask-closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }"
    :ok-button-props="{ disabled: !note.trim() || !canPublish }" @cancel="publishOpen = false" @ok="publish">
    <h4>{{ t('changes') }} · {{ scope.countryCode }} / {{ cityLabel }}</h4>
    <ul class="changes publish-changes">
      <li v-for="change in changes" :key="change.key"><strong>{{ change.name }}</strong><span>{{ change.description }}</span></li>
    </ul>
    <a-form layout="vertical">
      <a-form-item :label="t('reason')" required><a-textarea v-model:value="note" :disabled="saving" :maxlength="255" show-count /></a-form-item>
    </a-form>
  </a-modal>

  <a-drawer :open="!!panel" :title="t(panel === 'preview' ? 'preview' : 'history') + ' · ' + cityLabel"
    width="min(560px, 100vw)" @close="closePanel">
    <a-radio-group v-if="panel === 'preview'" v-model:value="previewView" @change="showPreview(previewView)">
      <a-radio-button value="draft">{{ t('draft') }}</a-radio-button>
      <a-radio-button value="published">{{ t('online') }}</a-radio-button>
    </a-radio-group>
    <div v-if="reading" class="panel-status"><a-spin /></div>
    <div v-else-if="readError" class="panel-status"><a-button @click="panel && readPanel(panel)">{{ t('retry') }}</a-button></div>
    <template v-else-if="panel === 'preview'">
      <p class="preview-caption">{{ cityLabel }} · {{ t(previewView === 'draft' ? 'draft' : 'online') }} v{{ previewVersion }}</p>
      <div v-if="previewRows.length" class="cards">
        <article v-for="(item, index) in previewRows" :key="item.property_id" class="hotel-card">
          <a-image v-if="item.cover_image" :src="item.cover_image" :alt="item.property_name" :preview="false" />
          <span v-else class="no-photo">{{ t('noImage') }}</span>
          <div class="card-info">
            <strong>#{{ index + 1 }} {{ item.property_name }}</strong>
            <span v-if="item.address" class="muted">{{ item.address }}</span>
            <div class="card-details">
              <span>{{ Number(item.rating) > 0 ? t('score', { score: (Number(item.rating) * 2).toFixed(1) }) : t('unrated') }}</span>
              <b>{{ t('from', { price: price(item) }) }}</b>
            </div>
          </div>
        </article>
      </div>
      <a-empty v-else :description="t('noCards')" />
    </template>
    <template v-else-if="panel === 'history'">
      <a-timeline v-if="historyRows.length">
        <a-timeline-item v-for="entry in historyRows" :key="entry.id">
          <strong>{{ te('actions.' + entry.action) ? t('actions.' + entry.action) : entry.action }} · v{{ entry.version }}</strong>
          <p class="muted">{{ entry.operator_name || '—' }} · {{ entry.created_at }}</p>
          <p v-if="entry.note">{{ entry.note }}</p>
          <ul v-if="entry.changes.length" class="changes">
            <li v-for="change in entry.changes" :key="change.key"><strong>{{ change.name }}</strong><span>{{ change.description }}</span></li>
          </ul>
          <span v-else class="muted">{{ t('noChanges') }}</span>
        </a-timeline-item>
      </a-timeline>
      <a-empty v-else :description="t('noHistory')" />
      <a-pagination v-if="historyTotal > 20" :current="historyPage" :total="historyTotal" :page-size="20"
        :show-size-changer="false" @change="showHistory" />
    </template>
  </a-drawer>
</template>

<style scoped>
.market-state { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.market-state, .muted, .preview-caption { color: var(--sap-muted, #64748b); font-size: 12px; }
.blockers { width: 100%; }
.panel-status { margin: 24px auto; text-align: center; }
.preview-caption { margin: 16px 0 10px; }
.cards { display: grid; gap: 12px; }
.hotel-card { display: grid; grid-template-columns: minmax(90px, 29%) minmax(0, 1fr); border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.hotel-card :deep(.ant-image-img), .no-photo { width: 100%; height: 100%; min-height: 100px; object-fit: cover; }
.no-photo { display: grid; place-items: center; background: #f1f5f9; color: #64748b; font-size: 12px; }
.card-info { display: flex; flex-direction: column; gap: 6px; padding: 12px; overflow-wrap: anywhere; }
.card-details { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; margin-top: auto; }
.changes { list-style: none; padding: 0; margin: 0; }
.changes li { display: grid; gap: 2px; padding: 6px 0; border-bottom: 1px solid #eef1f5; overflow-wrap: anywhere; }
.changes span { font-size: 13px; }
.publish-changes { max-height: 38vh; overflow: auto; margin-bottom: 16px; }
</style>
