<script setup lang="ts">
import './controls.less';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { FilterOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { supportGet } from '@/api/support';

interface Category { id: string; name: string; slug: string }
interface Guide {
  id: string; title: string; description: string | null; category: Category | null;
  video_url: string; video_id: string; provider: string;
}
interface Result<T> { status: string; list: T[]; hasMore?: boolean; guide?: Guide }
interface Section { key: string; name: string; slug: string; list: Guide[]; status: string }
const { t } = useI18n(); const router = useRouter(); const route = useRoute();
const queryText = (value: unknown) => typeof value === 'string' ? value : '';
const activeCategory = computed(() => queryText(route.query.category));
const searchTerm = computed(() => queryText(route.query.q));
const showAll = computed(() => route.query.all === '1');
const isHome = computed(() => !activeCategory.value && !searchTerm.value && !showAll.value);
const categoryName = computed(() => categories.value.find(item => item.slug === activeCategory.value)?.name || activeCategory.value);
const resultTitle = computed(() => categoryName.value || t(searchTerm.value ? 'support.guideResults' : 'support.allVideos'));
const keyword = ref(''); const categories = ref<Category[]>([]); const sections = ref<Section[]>([]);
const status = ref(''); const busy = ref(false); const more = ref(false); const page = ref(1); const loadError = ref('');
const failedImages = ref(new Set<string>());
const selected = ref<Guide>(); const detailBusy = ref(false); const detailStatus = ref(''); const playerFailed = ref(false);
let categoriesReady = false; let generation = 0; let detailGeneration = 0;
let controller: AbortController | undefined; let detailController: AbortController | undefined;
const errorMessage = (value: string) => t(value === 'not_configured' ? 'support.guideUnavailable' : value === 'rate_limited' ? 'support.guideRateLimited' : 'support.guideError');
const videoId = (guide: Guide) => guide.provider === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(guide.video_id || '') ? guide.video_id : '';
const thumbnail = (guide: Guide) => videoId(guide) && !failedImages.value.has(guide.id) ? `https://i.ytimg.com/vi/${videoId(guide)}/hqdefault.jpg` : '';
const embedUrl = computed(() => selected.value && videoId(selected.value) ? `https://www.youtube-nocookie.com/embed/${videoId(selected.value)}` : '');
const watchUrl = computed(() => selected.value?.video_url?.startsWith('https://') ? selected.value.video_url : '');

function navigate(category = activeCategory.value, term = keyword.value.trim()) {
  void router.push({ path: '/support/guides', query: { ...route.query, category: category || undefined, q: term || undefined, all: undefined } });
}
function search() { navigate(); }
function clearSearch() { if (!keyword.value && searchTerm.value) navigate(activeCategory.value, ''); }
function browse(category?: string) { navigate(category || '', searchTerm.value); }
function closeDetail() {
  detailGeneration++; detailController?.abort(); selected.value = undefined; detailBusy.value = false; detailStatus.value = ''; playerFailed.value = false;
}
async function detail(guide: Guide) {
  detailController?.abort(); detailController = new AbortController();
  const current = ++detailGeneration;
  selected.value = guide; detailBusy.value = true; detailStatus.value = ''; playerFailed.value = false;
  try {
    const result = await supportGet<Result<Guide>>('guides/detail', { id: guide.id }, detailController.signal);
    if (current !== detailGeneration) return;
    detailStatus.value = result.status === 'ready' && !result.guide ? 'unavailable' : result.status;
    if (result.guide) selected.value = result.guide;
  } catch { if (current === detailGeneration) detailStatus.value = 'unavailable'; }
  finally { if (current === detailGeneration) detailBusy.value = false; }
}

async function load(reset = true) {
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal; const current = ++generation; const nextPage = reset ? 1 : page.value + 1;
  busy.value = true; loadError.value = '';
  if (reset) { closeDetail(); sections.value = []; more.value = false; status.value = ''; failedImages.value.clear(); }
  try {
    if (!categoriesReady) {
      const list: Category[] = []; let categoryPage = 1; let hasMore = true;
      while (hasMore) {
        const result = await supportGet<Result<Category>>('guides/categories', { page: categoryPage, pageSize: 100 }, signal);
        if (current !== generation) return;
        if (result.status !== 'ready') { status.value = result.status; return; }
        list.push(...result.list); hasMore = !!result.hasMore && result.list.length > 0; categoryPage++;
      }
      categories.value = list; categoriesReady = true;
    }
    if (isHome.value && categories.value.length) {
      const previews: Section[] = [];
      // Bound parallel requests while fetching two real previews for each published category.
      for (let offset = 0; offset < categories.value.length; offset += 4) {
        const batch = await Promise.all(categories.value.slice(offset, offset + 4).map(async item => {
          let result: Result<Guide>;
          try { result = await supportGet<Result<Guide>>('guides/list', { category: item.slug, page: 1, pageSize: 2 }, signal); }
          catch { result = { status: 'unavailable', list: [] }; }
          return { key: item.id, name: item.name, slug: item.slug, list: result.list, status: result.status };
        }));
        if (current !== generation) return;
        previews.push(...batch);
      }
      sections.value = previews.filter(item => item.list.length || item.status !== 'ready'); status.value = 'ready';
    } else {
      const result = await supportGet<Result<Guide>>('guides/list', { keyword: searchTerm.value, category: activeCategory.value, page: nextPage }, signal);
      if (current !== generation) return;
      if (result.status !== 'ready') {
        if (reset) status.value = result.status; else loadError.value = result.status;
        return;
      }
      const previous = reset ? [] : sections.value[0]?.list || [];
      sections.value = [{ key: 'results', name: '', slug: '', list: [...previous, ...result.list], status: 'ready' }];
      status.value = 'ready'; more.value = !!result.hasMore; page.value = nextPage;
    }
  } catch {
    if (current === generation) { if (reset) status.value = 'unavailable'; else loadError.value = 'unavailable'; }
  } finally { if (current === generation) busy.value = false; }
}
const hasContent = computed(() => sections.value.some(item => item.list.length || item.status !== 'ready'));
watch([activeCategory, searchTerm, showAll], () => { keyword.value = searchTerm.value; void load(); }, { immediate: true });
onBeforeUnmount(() => { generation++; controller?.abort(); closeDetail(); });
</script>

<template>
  <PageContainer class="support-controls guides-page">
    <header class="guide-heading"><h1>{{ t('support.guidesTitle') }}</h1><p>{{ t('support.guidesSubtitle') }}</p></header>
    <form class="guide-filters" role="search" @submit.prevent="search">
      <a-input v-model:value="keyword" class="guide-search" :aria-label="t('support.guideSearch')" :placeholder="t('support.guideSearch')" :maxlength="200" allow-clear @press-enter="search" @change="clearSearch"><template #prefix><SearchOutlined /></template></a-input>
      <div class="category-filter"><FilterOutlined /><a-select :value="activeCategory || undefined" :aria-label="t('support.allCategories')" :placeholder="t('support.allCategories')" :bordered="false" allow-clear @change="browse"><a-select-option v-for="item in categories" :key="item.id" :value="item.slug">{{ item.name }}</a-select-option></a-select></div>
    </form>
    <nav v-if="activeCategory || showAll" class="guide-breadcrumb" :aria-label="t('support.guides')"><a-button type="link" @click="navigate('', '')">{{ t('support.guides') }}</a-button><RightOutlined /><span>{{ resultTitle }}</span></nav>
    <a-spin :spinning="busy">
      <div class="guide-content" :aria-busy="busy">
        <a-alert v-if="status && status !== 'ready'" show-icon :type="status === 'not_configured' ? 'info' : 'warning'" :message="errorMessage(status)"><template #action><a-button @click="load()">{{ t('support.retry') }}</a-button></template></a-alert>
        <a-empty v-else-if="!hasContent && !busy" :description="t('support.noGuides')" />
        <section v-for="section in sections" :key="section.key" class="guide-section" :aria-label="section.key === 'results' ? resultTitle : section.name">
          <div class="section-heading"><h2>{{ section.key === 'results' ? resultTitle : section.name }}<template v-if="activeCategory && !searchTerm"><RightOutlined /><span>{{ t('support.allVideos') }}</span></template></h2><a-button v-if="isHome && section.slug" type="link" @click="browse(section.slug)">{{ t('support.viewAllVideos') }}</a-button></div>
          <a-alert v-if="section.status !== 'ready'" show-icon type="warning" :message="errorMessage(section.status)"><template #action><a-button @click="load()">{{ t('support.retry') }}</a-button></template></a-alert>
          <div v-else class="guide-grid">
            <button v-for="guide in section.list" :key="guide.id" type="button" class="guide-card" :aria-label="t('support.watchTitle', { title: guide.title })" @click="detail(guide)">
              <div class="guide-thumbnail"><img v-if="thumbnail(guide)" :src="thumbnail(guide)" alt="" loading="lazy" referrerpolicy="no-referrer" @error="failedImages.add(guide.id)" /><span class="play-button" aria-hidden="true"><span /></span></div>
              <div class="guide-card-content"><span v-if="guide.category" class="guide-tag">{{ guide.category.name }}</span><h3>{{ guide.title }}</h3></div>
            </button>
          </div>
        </section>
        <a-alert v-if="loadError" class="load-error" type="warning" show-icon :message="errorMessage(loadError)" />
        <div v-if="more" class="load-more"><a-button :loading="busy" @click="load(false)">{{ t('support.loadMore') }}</a-button></div>
      </div>
    </a-spin>
    <a-modal :open="!!selected" :title="selected?.title" :footer="null" :width="880" destroy-on-close @cancel="closeDetail">
      <a-spin :spinning="detailBusy">
        <div class="guide-detail">
          <a-alert v-if="detailStatus && detailStatus !== 'ready'" type="warning" show-icon :message="errorMessage(detailStatus)"><template #action><a-button v-if="selected" @click="detail(selected)">{{ t('support.retry') }}</a-button></template></a-alert>
          <template v-else-if="!detailBusy && selected">
            <iframe v-if="embedUrl && !playerFailed" :key="embedUrl" class="guide-player" :src="embedUrl" :title="selected.title" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" @error="playerFailed = true" />
            <a-alert v-else type="info" show-icon :message="t('support.guidePlaybackUnavailable')" />
            <p class="playback-hint">{{ t('support.guidePlaybackHint') }} <a v-if="watchUrl" :href="watchUrl" target="_blank" rel="noopener noreferrer">{{ t('support.watchExternal') }} ↗</a></p>
            <p v-if="selected.description" class="guide-description">{{ selected.description }}</p>
          </template>
        </div>
      </a-spin>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.guide-heading { margin-bottom:24px; h1 { margin:0 0 8px; color:var(--mtrip-text-main); font-size:24px; font-weight:700; line-height:1.5; } p { margin:0; color:#8b8c96; font-size:14px; line-height:1.5; } }
.guide-filters { display:flex; gap:8px; margin-bottom:24px; align-items:center; }
.guide-search.ant-input-affix-wrapper { width:320px; height:40px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; :deep(.ant-input-prefix) { margin-right:8px; color:#8b8c96; } }
.category-filter { display:flex; align-items:center; width:190px; height:40px; padding-left:12px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; > .anticon { color:#8b8c96; font-size:16px; } .ant-select { flex:1; min-width:0; } :deep(.ant-select-selector) { background:transparent !important; border:0 !important; box-shadow:none !important; } }
.guide-breadcrumb { display:flex; align-items:center; gap:8px; margin:-8px 0 16px; font-size:12px; > .anticon { color:#8b8c96; font-size:10px; } .ant-btn { padding:0; height:auto; } }
.guide-content { min-height:180px; }
.guide-section { margin-bottom:24px; }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; h2 { display:flex; align-items:center; gap:12px; min-width:0; margin:0; padding-left:16px; border-left:4px solid var(--mtrip-primary); color:var(--mtrip-text-main); font-size:14px; font-weight:600; line-height:22px; overflow-wrap:anywhere; .anticon { color:#8b8c96; font-size:10px; } span { font-weight:400; } } .ant-btn { padding:0; height:auto; color:#8b8c96; font-size:12px; text-decoration:underline; white-space:normal; text-align:right; } }
.guide-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
.guide-card { display:flex; flex-direction:column; min-width:0; padding:0; border:0; border-radius:16px; overflow:hidden; text-align:left; background:#fff; box-shadow:0 4px 10px #00000008; cursor:pointer; font:inherit; color:var(--mtrip-text-main); &:focus-visible { outline:3px solid var(--mtrip-primary); outline-offset:3px; } &:hover .play-button { transform:scale(1.08); } }
.guide-thumbnail { position:relative; display:grid; place-items:center; width:100%; aspect-ratio:610 / 268; background:linear-gradient(145deg,#eaf0ff,#d9e1fb); overflow:hidden; &::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 35%,#16243d99); } img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; } }
.play-button { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; background:#fff; z-index:1; transition:transform .15s; span { margin-left:4px; width:0; height:0; border-top:8px solid transparent; border-bottom:8px solid transparent; border-left:12px solid var(--mtrip-primary); } }
.guide-card-content { width:100%; padding:24px; h3 { margin:16px 0 0; font-size:18px; font-weight:600; line-height:1.5; overflow-wrap:anywhere; } }
.guide-tag { display:inline-block; max-width:100%; padding:6px 12px; border-radius:24px; color:var(--mtrip-primary); background:#4169ed14; font-size:12px; font-weight:600; line-height:18px; text-transform:uppercase; overflow-wrap:anywhere; }
.load-more { display:flex; justify-content:center; margin-top:24px; }.load-error { margin-top:16px; }
.guide-detail { min-height:140px; }.guide-player { display:block; width:100%; aspect-ratio:16 / 9; border:0; border-radius:8px; background:#101828; }.playback-hint { margin:12px 0; font-size:12px; color:#8b8c96; }.guide-description { white-space:pre-wrap; overflow-wrap:anywhere; margin-top:16px; }
@media(max-width:700px) { .guide-grid { grid-template-columns:1fr; gap:16px; }.guide-filters { flex-wrap:wrap; }.guide-search.ant-input-affix-wrapper { width:100%; }.category-filter { width:100%; }.guide-card-content { padding:20px; }.guide-heading h1 { font-size:22px; } }
@media(prefers-reduced-motion:reduce) { .play-button { transition:none; } }
</style>
