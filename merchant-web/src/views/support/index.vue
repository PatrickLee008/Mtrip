<script setup lang="ts">
import { computed } from 'vue';
import { BookOutlined, CustomerServiceOutlined, FileTextOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';

const { t } = useI18n();

const quickActions = computed(() => [
  { key: 'booking', icon: CustomerServiceOutlined, title: t('support.quick.booking'), desc: t('support.quick.bookingDesc') },
  { key: 'settlement', icon: FileTextOutlined, title: t('support.quick.settlement'), desc: t('support.quick.settlementDesc') },
  { key: 'policies', icon: SafetyCertificateOutlined, title: t('support.quick.policies'), desc: t('support.quick.policiesDesc') },
]);

const faqs = computed(() => [
  { q: t('support.faq.q1'), a: t('support.faq.a1') },
  { q: t('support.faq.q2'), a: t('support.faq.a2') },
  { q: t('support.faq.q3'), a: t('support.faq.a3') },
  { q: t('support.faq.q4'), a: t('support.faq.a4') },
]);

const guides = computed(() => [
  t('support.guides.g1'),
  t('support.guides.g2'),
  t('support.guides.g3'),
]);
</script>

<template>
  <PageContainer>
    <div class="support-hero">
      <div>
        <div class="eyebrow">{{ t('support.eyebrow') }}</div>
        <h1>{{ t('support.title') }}</h1>
        <p>{{ t('support.subtitle') }}</p>
      </div>
      <a-button type="primary" href="mailto:support@mtrip.com">
        <template #icon><MailOutlined /></template>{{ t('support.contactSupport') }}
      </a-button>
    </div>

    <div class="quick-grid">
      <a-card v-for="item in quickActions" :key="item.key" :bordered="false" class="mtrip-card-shadow quick-card">
        <component :is="item.icon" class="quick-icon" />
        <h3>{{ item.title }}</h3>
        <p>{{ item.desc }}</p>
      </a-card>
    </div>

    <div class="support-grid">
      <a-card :bordered="false" class="mtrip-card-shadow">
        <template #title>
          <span class="section-title"><BookOutlined />{{ t('support.faqTitle') }}</span>
        </template>
        <a-collapse ghost>
          <a-collapse-panel v-for="(item, index) in faqs" :key="index" :header="item.q">
            <p class="faq-answer">{{ item.a }}</p>
          </a-collapse-panel>
        </a-collapse>
      </a-card>

      <a-card :bordered="false" class="mtrip-card-shadow">
        <template #title>
          <span class="section-title"><FileTextOutlined />{{ t('support.guidesTitle') }}</span>
        </template>
        <div class="guide-list">
          <div v-for="guide in guides" :key="guide" class="guide-row">
            <span>{{ guide }}</span>
            <a-tag color="blue">{{ t('support.availableSoon') }}</a-tag>
          </div>
        </div>
        <a-alert type="info" show-icon :message="t('support.ticketTip')" />
      </a-card>
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
.support-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
  padding: 20px;
  border: 1px solid var(--mtrip-border);
  border-radius: 14px;
  background:
    radial-gradient(circle at 90% 0%, rgba(37, 99, 235, 0.14), transparent 30%),
    #fff;

  .eyebrow {
    color: var(--mtrip-primary);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 6px 0 0;
    color: var(--mtrip-text-main);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.05em;
  }

  p {
    max-width: 680px;
    margin: 6px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.quick-grid,
.support-grid {
  display: grid;
  gap: 16px;
}

.quick-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 16px;
}

.support-grid {
  grid-template-columns: 1.2fr 0.8fr;
}

.quick-card :deep(.ant-card-body) {
  padding: 18px;
}

.quick-icon {
  display: block;
  width: 30px;
  height: 30px;
  padding: 7px;
  border-radius: 9px;
  background: #eff6ff;
  color: var(--mtrip-primary);
}

.quick-card h3 {
  margin: 12px 0 4px;
  color: var(--mtrip-text-main);
  font-size: 14px;
  font-weight: 800;
}

.quick-card p,
.faq-answer {
  margin: 0;
  color: var(--mtrip-text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--mtrip-text-main);
  font-size: 13px;
  font-weight: 800;
}

.guide-list {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.guide-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--mtrip-border-light);
  border-radius: 8px;
  background: var(--mtrip-bg-soft);
  color: var(--mtrip-text-main);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 980px) {
  .support-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .quick-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }
}
</style>
