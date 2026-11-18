<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftOutlined, RightOutlined, SettingOutlined, TagOutlined, TeamOutlined, DollarOutlined,
  CreditCardOutlined, SyncOutlined, CloseCircleOutlined, BellOutlined, MailOutlined, MessageOutlined,
  ThunderboltOutlined, LinkOutlined, GlobalOutlined, ApiOutlined, ToolOutlined, NotificationOutlined,
  EnvironmentOutlined, LockOutlined, MenuOutlined,
} from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import { useUserStore } from '@/stores/user';
import { sections, managementSections, type ConfigSection } from './catalog';
import type { MenuNode } from '@/api/types';
import TemplateList from './TemplateList.vue';
import SideMenu from '@/layouts/components/SideMenu.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const { t } = useI18n();
const text = (key: string) => t(`platformConfig.${key}`);
const navigationOpen = ref(false);
watch(() => route.fullPath, () => { navigationOpen.value = false; });
const allSections = [...sections, ...managementSections];
const sectionGroups = [{ key: 'main', sections }, { key: 'management', sections: managementSections }];
const selected = computed(() => allSections.find(section => section.key === route.query.section));
const icons: Record<string, Component> = {
  SettingOutlined, TagOutlined, TeamOutlined, DollarOutlined, CreditCardOutlined, SyncOutlined,
  CloseCircleOutlined, BellOutlined, MailOutlined, MessageOutlined, ThunderboltOutlined,
  LinkOutlined, GlobalOutlined, ApiOutlined, ToolOutlined, NotificationOutlined, EnvironmentOutlined,
};
const pages: Record<string, Component> = {
  global: defineAsyncComponent(() => import('./PlatformSettings.vue')),
  kyc: defineAsyncComponent(() => import('../kyc-template/index.vue')),
  sms: defineAsyncComponent(() => import('../sms/index.vue')),
  features: defineAsyncComponent(() => import('../features/index.vue')),
  client: defineAsyncComponent(() => import('../client/index.vue')),
  announcements: defineAsyncComponent(() => import('../../helpcenter/announcements/index.vue')),
  map: defineAsyncComponent(() => import('../map/index.vue')),
  email: defineAsyncComponent(() => import('../email/index.vue')),
  advanced: defineAsyncComponent(() => import('../global/index.vue')),
  site: defineAsyncComponent(() => import('../site/index.vue')),
  storage: defineAsyncComponent(() => import('../storage/index.vue')),
  pay: defineAsyncComponent(() => import('../pay/index.vue')),
  payAccount: defineAsyncComponent(() => import('../pay-account/index.vue')),
  permtpl: defineAsyncComponent(() => import('../permtpl/index.vue')),
  filter: defineAsyncComponent(() => import('../../cops/filter/index.vue')),
  tax: defineAsyncComponent(() => import('../../wip/index.vue')),
};
const hints: Record<string, string> = {
  platform: 'platformHint', notifications: 'notificationHint',
  email: 'emailHint', commission: 'commissionHint', sms: 'smsHint', api: 'apiHint', location: 'locationHint',
};

function allowed(section: ConfigSection): boolean {
  if (!section.permission || user.hasPerm(section.permission)) return true;
  const contains = (nodes: MenuNode[]): boolean => nodes.some(node =>
    (node.menu_type === 2 && node.perm_key === section.permission) || contains(node.children ?? []));
  return contains(user.menus ?? []);
}
function state(section: ConfigSection): string {
  if (section.key === 'tax') return 'pending';
  if (['platform', 'notifications', 'email', 'api', 'location'].includes(section.key)) return 'partial';
  return section.component ? 'connected' : 'pending';
}
function open(section?: ConfigSection): void {
  void router.push({ path: route.path, query: section ? { section: section.key } : {} });
}
</script>

<template>
  <PageContainer>
    <div class="platform-config">
      <a-button class="mobile-navigation" @click="navigationOpen = true"><MenuOutlined />{{ text('navigation') }}</a-button>
      <a-drawer v-model:open="navigationOpen" :title="text('navigation')" placement="left" :width="280" :body-style="{ background: '#0f172a', padding: '8px' }">
        <SideMenu v-if="navigationOpen" />
      </a-drawer>
      <header class="config-heading">
        <a-button v-if="selected" class="back-button" @click="open()"><ArrowLeftOutlined />{{ text('back') }}</a-button>
        <div>
          <h1>{{ selected ? text(`sections.${selected.key}.title`) : text('title') }}</h1>
          <p>{{ selected ? text(`sections.${selected.key}.description`) : text('subtitle') }}</p>
        </div>
        <a-tag v-if="selected" class="section-state" :color="state(selected) === 'pending' ? 'default' : 'blue'">{{ text(state(selected)) }}</a-tag>
      </header>

      <template v-if="!selected">
        <section v-for="group in sectionGroups" :key="group.key" class="config-group">
          <h2 v-if="group.key === 'management'">{{ text('managementTitle') }}</h2>
          <div class="config-grid">
        <button v-for="section in group.sections" :key="section.key" type="button" class="config-tile" :data-section="section.key" @click="open(section)">
          <span class="tile-top">
            <span class="tile-icon" :class="`tile-icon--${section.color}`"><component :is="icons[section.icon]" /></span>
            <LockOutlined v-if="!allowed(section)" class="tile-chevron" />
            <RightOutlined v-else class="tile-chevron" />
          </span>
          <span class="tile-title">{{ text(`sections.${section.key}.title`) }}</span>
          <span class="tile-description">{{ text(`sections.${section.key}.description`) }}</span>
          <span class="tile-state" :class="`tile-state--${state(section)}`">{{ text(state(section)) }}</span>
        </button>
          </div>
        </section>
      </template>

      <template v-else>
        <a-result v-if="!allowed(selected)" status="403" :title="text('noPermission')">
          <template #extra><a-button @click="open()">{{ text('back') }}</a-button></template>
        </a-result>
        <template v-else>
          <a-alert v-if="hints[selected.key]" class="section-hint" type="info" show-icon :message="text(hints[selected.key])" />
          <div v-if="selected.component" class="connected-section">
            <component :is="pages[selected.component]" :key="selected.key" v-bind="selected.key === 'sms' ? { initialTab: 'template' } : {}" />
          </div>
          <TemplateList v-else-if="selected.key === 'notifications'" :key="selected.key" :kind="selected.key" />
          <a-card v-if="selected.fields" :bordered="false" class="mtrip-card-shadow preview-card" :class="{ 'preview-card--extra': selected.component }">
            <template #title>{{ selected.component ? text('additionalSettings') : text(`sections.${selected.key}.title`) }}</template>
            <template #extra><a-button type="primary" disabled>{{ text('saveUnavailable') }}</a-button></template>
            <a-alert class="section-hint" type="warning" show-icon :message="text('preview')" :description="text('previewHint')" />
            <a-form layout="vertical" disabled class="preview-form">
              <div v-for="field in selected.fields" :key="field.key" class="config-field">
                <label :for="`preview-${field.key}`">{{ text(`fields.${field.key}`) }}</label>
                <div class="field-control">
                  <a-switch v-if="field.type === 'switch'" :id="`preview-${field.key}`" disabled :aria-label="text(`fields.${field.key}`)" />
                  <a-textarea v-else-if="field.type === 'textarea'" :id="`preview-${field.key}`" :rows="3" :placeholder="text('notConfigured')" />
                  <a-input-number v-else-if="field.type === 'number'" :id="`preview-${field.key}`" :placeholder="text('notConfigured')" />
                  <a-input-password v-else-if="field.type === 'password'" :id="`preview-${field.key}`" :placeholder="text('notConfigured')" />
                  <a-input v-else :id="`preview-${field.key}`" :placeholder="text('notConfigured')" />
                  <span v-if="field.type === 'switch'" class="unconfigured">{{ text('notConfigured') }}</span>
                </div>
              </div>
            </a-form>
            <a-button v-if="selected.key === 'commission' && user.hasPerm('merchant:list:list')" @click="router.push('/merchant/list')">{{ text('merchantLink') }}<RightOutlined /></a-button>
            <p class="scope-note">{{ text('transactionHint') }}</p>
          </a-card>
        </template>
      </template>
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
.platform-config { padding: 8px; }
.mobile-navigation { display: none; }
.config-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; h1 { margin: 0 0 4px; font-size: 20px; line-height: 28px; font-weight: 650; color: var(--mtrip-text-main); } p { margin: 0; color: var(--mtrip-text-aux); font-size: 14px; line-height: 22px; } }
.back-button { flex-shrink: 0; }
.section-state { margin-left: auto; flex-shrink: 0; }
.config-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.config-group + .config-group { margin-top: 28px; }
.config-group h2 { margin: 0 0 16px; font-size: 17px; font-weight: 600; color: var(--mtrip-text-main); }
.config-tile { display: flex; flex-direction: column; align-items: stretch; text-align: left; padding: 16px; min-height: 156px; border: 1px solid var(--mtrip-border-color, #e7e9ef); border-radius: 8px; background: var(--mtrip-bg-card, #fff); font: inherit; cursor: pointer; transition: border-color .15s, box-shadow .15s; &:hover { border-color: #8b95ff; box-shadow: 0 3px 10px #4f5cff0d; } &:focus-visible { outline: 2px solid #4f5cff; outline-offset: 3px; } }
.tile-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.tile-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; font-size: 18px; &--blue { background: #f0f1ff; color: #505ff1; } &--purple { background: #f7f1ff; color: #9360d7; } &--green { background: #eefaf5; color: #42a386; } &--gold { background: #fff9e9; color: #cea342; } &--cyan { background: #effaff; color: #609dbc; } &--red { background: #fff3f2; color: #d45b58; } &--pink { background: #fff1f8; color: #cc659d; } &--slate { background: #f3f4f8; color: #677082; } }
.tile-chevron { color: #b9bdc8; font-size: 11px; margin-top: 3px; }
.tile-title { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--mtrip-text-main); margin-bottom: 4px; }
.tile-description { font-size: 13px; line-height: 19px; color: var(--mtrip-text-aux); }
.tile-state { font-size: 11px; line-height: 18px; margin-top: auto; padding-top: 10px; color: #9299a8; &--connected { color: #38846a; } &--partial { color: #7c83a0; } }
.section-hint { margin-bottom: 16px; }
.connected-section :deep(.page-body) { padding: 0; min-height: auto; }
.config-field { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(220px, 40%); gap: 24px; padding: 22px 0; border-bottom: 1px solid #f1f2f6; label { font-size: 14px; line-height: 32px; color: var(--mtrip-text-main); } }
.field-control { .ant-input-number { width: 100%; } }
.unconfigured { margin-left: 12px; color: var(--mtrip-text-aux); font-size: 12px; }
.scope-note { margin: 20px 0 0; font-size: 12px; color: var(--mtrip-text-aux); }
.preview-card--extra { margin-top: 16px; }
@media (max-width: 1200px) { .config-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 960px) { .config-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .config-heading { flex-wrap: wrap; } }
@media (max-width: 600px) { .platform-config { padding: 0; } .config-grid { grid-template-columns: 1fr; } .config-heading h1 { font-size: 18px; } .config-heading { gap: 10px; margin-bottom: 18px; } .config-heading > div { flex: 1; min-width: 180px; } .section-state { margin-left: 0; } .config-field { grid-template-columns: 1fr; gap: 8px; padding: 16px 0; } .preview-card :deep(.ant-card-head) { flex-wrap: wrap; } }
@media (max-width: 600px) {
  .mobile-navigation { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 16px; }
  :global(.layout-container:has(.platform-config) > .layout-sidebar) { display: none; }
  :global(.layout-container:has(.platform-config) .layout-header) { display: none; }
}
</style>
