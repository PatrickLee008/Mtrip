<script setup lang="ts">
/**
 * 平台活动详情抽屉(Figma 未画,沿用 Promotions 抽屉的 562 宽面板令牌)。
 *
 * 功能需求要求「查看活动详情、参与资格要求、出资模式、活动条款,并接受或拒绝活动邀请」,
 * 抽屉把这四项分区展示,底部是响应区(拒绝原因 + 接受/拒绝)。
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from '@/views/promotions/components/PromoIcon.vue';
import { dateRangeText, thousands } from '@/views/promotions/helpers';
import { PARTICIPATION_STATUS, type MerchantCampaign } from '@/api/campaigns';

const props = defineProps<{
  open: boolean;
  campaign: MerchantCampaign | null;
  /** 详情接口返回的关联券;列表行没有 */
  coupons: { id: number; coupon_name: string; coupon_type: number; discount_value: number }[];
  currency: string;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'respond', id: number, action: 'accept' | 'decline', remark: string): void;
}>();

const { t } = useI18n();
const remark = ref('');

watch(() => props.open, (open) => {
  if (open) remark.value = '';
});

const isJoined = computed(() => Number(props.campaign?.participation_status) === PARTICIPATION_STATUS.accepted);
const canRespond = computed(() => props.campaign !== null && props.campaign.can_respond);

const fundingText = computed(() => {
  const campaign = props.campaign;
  if (!campaign) return '';
  const source = Number(campaign.funding_source);
  if (source === 4) {
    const rules = campaign.funding_rules || {};
    return t('campaigns.funding.4', { mtrip: Number(rules.mtrip || 0), merchant: Number(rules.merchant || 0) });
  }
  return t(`campaigns.funding.${source}`);
});

function couponText(coupon: { coupon_type: number; discount_value: number }): string {
  if (Number(coupon.coupon_type) === 2) {
    return `${((10 - Number(coupon.discount_value || 0)) * 10).toFixed(0)}% Off`;
  }
  return `${props.currency} ${thousands(Number(coupon.discount_value || 0))} Off`;
}

function decline(): void {
  if (remark.value.trim() === '') {
    message.warning(t('campaigns.validation.remark'));
    return;
  }
  if (props.campaign) emit('respond', props.campaign.id, 'decline', remark.value.trim());
}

function accept(): void {
  if (props.campaign) emit('respond', props.campaign.id, 'accept', remark.value.trim());
}
</script>

<template>
  <div v-if="open && campaign" class="drawer-root">
    <div class="scrim" @click="$emit('close')" />
    <aside class="drawer">
      <header class="drawer-header">
        <h2 class="drawer-title">{{ campaign.title }}</h2>
        <button type="button" class="icon-btn" @click="$emit('close')">
          <PromoIcon name="x" :size="14" />
        </button>
      </header>

      <div class="drawer-body">
        <p class="overview">{{ campaign.subtitle }}</p>

        <section class="field">
          <span class="field-label">{{ t('campaigns.drawer.period') }}</span>
          <span class="field-value">{{ dateRangeText(campaign.start_time, campaign.end_time) }}</span>
        </section>

        <section class="field">
          <span class="field-label">{{ t('campaigns.drawer.inviteMode') }}</span>
          <span class="field-value">{{ t(`campaigns.inviteMode.${campaign.invite_mode}`) }}</span>
        </section>

        <section class="field">
          <span class="field-label">{{ t('campaigns.drawer.funding') }}</span>
          <span class="field-value">{{ fundingText }}</span>
        </section>

        <section class="field">
          <span class="field-label">
            <PromoIcon name="users" :size="13" />
            {{ t('campaigns.drawer.requirements') }}
          </span>
          <p class="field-text">{{ campaign.requirements || t('campaigns.drawer.noRequirements') }}</p>
        </section>

        <section class="field">
          <span class="field-label">
            <PromoIcon name="file-text" :size="13" />
            {{ t('campaigns.drawer.terms') }}
          </span>
          <p class="field-text">{{ campaign.terms || t('campaigns.drawer.noTerms') }}</p>
        </section>

        <section class="field">
          <span class="field-label">
            <PromoIcon name="ticket" :size="13" />
            {{ t('campaigns.drawer.coupons') }}
          </span>
          <div v-if="coupons.length === 0" class="field-text">{{ t('campaigns.drawer.noCoupons') }}</div>
          <ul v-else class="coupon-list">
            <li v-for="coupon in coupons" :key="coupon.id">
              <span class="coupon-name">{{ coupon.coupon_name }}</span>
              <span class="coupon-discount">{{ couponText(coupon) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="campaign.responded_at" class="field">
          <span class="field-label">{{ t('campaigns.drawer.respondedAt') }}</span>
          <span class="field-value">{{ campaign.responded_at }}</span>
        </section>

        <section v-if="canRespond" class="field">
          <span class="field-label">{{ t('campaigns.drawer.remark') }}</span>
          <a-textarea v-model:value="remark" :rows="3" :placeholder="t('campaigns.drawer.remarkPlaceholder')" />
        </section>
      </div>

      <footer class="drawer-footer">
        <template v-if="canRespond">
          <button type="button" class="btn ghost" :disabled="saving" @click="decline">
            {{ t('campaigns.drawer.confirmDecline') }}
          </button>
          <button type="button" class="btn primary" :disabled="saving" @click="accept">
            {{ t('campaigns.actions.accept') }}
          </button>
        </template>
        <span v-else-if="isJoined" class="joined-badge">
          <PromoIcon name="check-circle" :size="14" />
          {{ t('campaigns.participation.accepted') }}
        </span>
        <button v-else type="button" class="btn ghost" @click="$emit('close')">{{ t('common.cancel') }}</button>
      </footer>
    </aside>
  </div>
</template>

<style scoped lang="less">
@import '@/views/promotions/tokens.less';

.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.scrim {
  position: absolute;
  inset: 0;
  background: @pr-scrim;
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: @pr-drawer-width;
  max-width: 100%;
  height: 100%;
  flex-direction: column;
  border-left: 1px solid @pr-line;
  background: #fff;
}

.drawer-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid @pr-line;
}

.drawer-title {
  margin: 0;
  color: @pr-ink-page;
  font-family: @pr-font-display;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.5;
}

.drawer-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 24px;
}

.overview {
  margin: 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: @pr-ink-label;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;

  svg {
    color: @pr-primary;
  }
}

.field-value {
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 14px;
  line-height: 1.5;
}

.field-text {
  margin: 0;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.coupon-list {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid @pr-line;
    border-radius: @pr-radius-control;
    background: @pr-soft;

    & + li {
      margin-top: 8px;
    }
  }
}

.coupon-name {
  overflow: hidden;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coupon-discount {
  flex: none;
  color: @pr-primary;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 700;
}

.drawer-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid @pr-line;
}

.joined-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: @pr-success;
  font-family: @pr-font-body;
  font-size: 14px;
  font-weight: 600;
}

.icon-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid @pr-line;
  border-radius: 6px;
  background: @pr-chip-bg;
  color: @pr-ink-muted;
  cursor: pointer;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: @pr-input-height;
  padding: 12px 20px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink;
  font-family: @pr-font-button;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &.primary {
    border-color: @pr-primary;
    background: @pr-primary;
    color: #fff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}
</style>
