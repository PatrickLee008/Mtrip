<script setup lang="ts">
import './controls.less';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { BookOutlined, PlayCircleOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { supportGet } from '@/api/support';

interface Guide { id: string; title: string; description: string; category: { name: string } | null; video_url: string }
interface Result<T> { status: string; list: T[]; hasMore?: boolean; guide?: Guide }
const { t } = useI18n(); const router = useRouter();
const keyword = ref(''); const category = ref<string>(); const page = ref(1);
const categories = ref<{ id: string; name: string; slug: string }[]>([]); const guides = ref<Guide[]>([]);
const status = ref(''); const busy = ref(false); const more = ref(false); const selected = ref<Guide>();
let generation = 0;
async function load(reset = false) {
  if (reset) page.value = 1;
  const current = ++generation; busy.value = true;
  try {
    const result = await supportGet<Result<Guide>>('guides/list', { keyword: keyword.value, category: category.value, page: page.value });
    if (current !== generation) return;
    status.value = result.status; guides.value = reset || page.value === 1 ? result.list : [...guides.value, ...result.list]; more.value = !!result.hasMore;
  } catch { if (current === generation) { status.value = 'unavailable'; guides.value = []; } }
  finally { if (current === generation) busy.value = false; }
}
async function detail(id: string) {
  const current = generation;
  try { const result = await supportGet<Result<Guide>>('guides/detail', { id }); if (current === generation) { status.value = result.status; selected.value = result.guide; } }
  catch { status.value = 'unavailable'; }
}
async function next() { page.value++; await load(); }
onMounted(async () => {
  const current = generation;
  try {
    let categoryPage = 1; let hasMore = true;
    while (hasMore) {
      const result = await supportGet<Result<typeof categories.value[number]>>('guides/categories', { page: categoryPage, pageSize: 100 });
      if (current !== generation) return;
      categories.value.push(...result.list); hasMore = !!result.hasMore && result.list.length > 0; categoryPage++;
    }
  }
  catch { /* The list below provides the visible retry state. */ }
  await load(true);
});
onBeforeUnmount(() => generation++);
</script>

<template>
  <PageContainer class="support-controls">
    <a-button type="link" @click="router.push('/support')">← {{ t('support.title') }}</a-button>
    <header><BookOutlined /><div><h1>{{ t('support.guides') }}</h1><p>{{ t('support.guidesSubtitle') }}</p></div></header>
    <div class="filters"><a-input-search v-model:value="keyword" :placeholder="t('support.guideSearch')" allow-clear @search="load(true)" /><a-select v-model:value="category" :placeholder="t('support.allFaq')" allow-clear @change="load(true)"><a-select-option v-for="item in categories" :key="item.id" :value="item.slug">{{ item.name }}</a-select-option></a-select></div>
    <a-spin :spinning="busy">
      <a-alert v-if="status && status !== 'ready'" show-icon :type="status === 'not_configured' ? 'info' : 'warning'" :message="t(status === 'not_configured' ? 'support.guideUnavailable' : 'support.guideError')"><template #action><a-button @click="load(true)">{{ t('support.retry') }}</a-button></template></a-alert>
      <a-empty v-else-if="!guides.length && !busy" :description="t('support.noGuides')" />
      <div v-else class="guide-grid"><button v-for="guide in guides" :key="guide.id" class="guide-card" @click="detail(guide.id)"><PlayCircleOutlined /><small>{{ guide.category?.name }}</small><h2>{{ guide.title }}</h2><p>{{ guide.description }}</p><span>{{ t('support.watch') }} →</span></button></div>
      <a-button v-if="more" :disabled="busy" @click="next">{{ t('support.loadMore') }}</a-button>
    </a-spin>
    <a-modal :open="!!selected" :title="selected?.title" :footer="null" @cancel="selected = undefined"><p class="description">{{ selected?.description }}</p><a v-if="selected?.video_url" :href="selected.video_url" target="_blank" rel="noopener noreferrer">{{ t('support.watch') }} ↗</a><a-alert v-else type="info" :message="t('support.guideError')" /></a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
header { display:flex; gap:16px; align-items:center; margin:24px 0; }header>.anticon { font-size:30px; color:var(--mtrip-primary); }h1 { margin:0 0 8px; font-size:26px; }header p { color:#8b8c96; margin:0; }.filters { display:flex; gap:12px; margin-bottom:24px; }.filters .ant-input-search { max-width:480px; }.filters .ant-select { min-width:180px; }.guide-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; margin-bottom:24px; }.guide-card { background:white; border:1px solid #e2e8f0; padding:24px; border-radius:12px; text-align:left; cursor:pointer; }.guide-card>.anticon { display:block; font-size:36px; color:var(--mtrip-primary); margin-bottom:24px; }.guide-card small,.guide-card p { color:#8b8c96; }.guide-card h2 { font-size:18px; }.guide-card p { white-space:pre-wrap; overflow-wrap:anywhere; }.guide-card span { color:var(--mtrip-primary); }.description { white-space:pre-wrap; }
@media(max-width:1000px) { .guide-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }@media(max-width:600px) { .filters { flex-direction:column; }.guide-grid { grid-template-columns:1fr; } }
</style>
