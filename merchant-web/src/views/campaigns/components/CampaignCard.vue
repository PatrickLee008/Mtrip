<script setup lang="ts">
/**
 * 单个平台活动卡(Figma 未画,沿用 Promotions 页的卡片令牌与形状)。
 *
 * 卡片把功能需求要求的四件事都摊开:活动详情(标题/副标题)、参与资格要求、
 * 出资模式、活动条款;底部是邀请响应(接受 / 拒绝)。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PromoIcon from '@/views/promotions/components/PromoIcon.vue';
import { dateRangeText } from '@/views/promotions/helpers';
import { CAMPAIGN_INVITE_MODE, PARTICIPATION_STATUS, type MerchantCampaign } from '@/api/campaigns';

const props = defineProps<{ campaign: MerchantCampaign }>();

defineEmits<{
  (e: 'detail', row: MerchantCampaign): void;
  (e: 'respond', row: MerchantCampaign, action: 'accept' | 'decline'): void;
}>();

const { t } = useI18n();

const participation = computed(() => {
  const status = props.campaign.participation_status;
  if (status === null || status === undefined) return '';
  const map: Record<number, string> = {
    [PARTICIPATION_STATUS.invited]: 'invited',
    [PARTICIPATION_STATUS.accepted]: 'accepted',
    [PARTICIPATION_STATUS.declined]: 'declined',
    [PARTICIPATION_STATUS.withdrawn]: 'withdrawn',
  };
  return map[Number(status)] ?? '';
});

const isJoined = computed(() => Number(props.campaign.participation_status) === PARTICIPATION_STATUS.accepted);
const isInviteOnly = computed(() => Number(props.campaign.invite_mode) === CAMPAIGN_INVITE_MODE.invited);

/** 出资模式文案:共担时把比例摊开(与后端 funding_rules 的键一致) */
const fundingText = computed(() => {
  const source = Number(props.campaign.funding_source);
  if (source === 4) {
    const rules = props.campaign.funding_rules || {};
    return t('campaigns.funding.4', { mtrip: Number(rules.mtrip || 0), merchant: Number(rules.merchant || 0) });
  }
  return t(`campaigns.funding.${source}`);
});
</script>

<template>
  <article class="campaign-card">
    <header class="card-header">
      <h3 class="card-title">{{ campaign.title }}</h3>
      <span class="mode-badge">{{ t(`campaigns.inviteMode.${campaign.invite_mode}`) }}</span>
    </header>

    <p class="card-sub">{{ campaign.subtitle }}</p>

    <div class="meta-row">
      <div class="meta-item">
        <span class="meta-label">{{ t('campaigns.card.period') }}</span>
        <span class="meta-value">{{ dateRangeText(campaign.start_time, campaign.end_time) }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">{{ t('campaigns.card.funding') }}</span>
        <span class="meta-value">{{ fundingText }}</span>
      </div>
    </div>

    <div class="block">
      <span class="meta-label">{{ t('campaigns.card.eligibility') }}</span>
      <p class="block-text">{{ campaign.requirements || t('campaigns.drawer.noRequirements') }}</p>
    </div>

    <div class="block">
      <span class="meta-label">{{ t('campaigns.card.terms') }}</span>
      <p class="block-text">{{ campaign.terms || t('campaigns.drawer.noTerms') }}</p>
    </div>

    <footer class="card-actions">
      <span v-if="participation" class="part-badge" :class="`part-${participation}`">
        {{ t(`campaigns.participation.${participation}`) }}
      </span>
      <span class="spacer" />
      <button type="button" class="action-btn" @click="$emit('detail', campaign)">
        <PromoIcon name="file-text" :size="14" />
        <span>{{ t('campaigns.actions.detail') }}</span>
      </button>
      <button
        v-if="!isJoined"
        v-perm="'mch:campaigns:respond'"
        type="button"
        class="action-btn primary"
        @click="$emit('respond', campaign, 'accept')"
      >
        <PromoIcon name="check" :size="14" />
        <span>{{ isInviteOnly ? t('campaigns.actions.accept') : t('campaigns.actions.rejoin') }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped lang="less">
@import '@/views/promotions/tokens.less';

.campaign-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-promo-card;
  background: #fff;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-title {
  margin: 0;
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.mode-badge,
.part-badge {
  flex: none;
  padding: 4px 10px;
  border-radius: 99px;
  background: @pr-primary-soft;
  color: @pr-primary;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.part-invited {
  background: @pr-warn-soft;
  color: @pr-warn;
}

.part-accepted {
  background: @pr-success-faint;
  color: @pr-success;
}

.part-declined,
.part-withdrawn {
  background: @pr-neutral-soft;
  color: @pr-ink-sub;
}

.card-sub {
  margin: 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  line-height: 1.5;
}

.meta-row {
  display: flex;
  gap: 24px;
}

.meta-item,
.block {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
}

.meta-value {
  color: @pr-primary;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
}

.block-text {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: @pr-ink;
  font-family: @pr-font-body;
  font-size: 13px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.spacer {
  flex: 1;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    border-color: @pr-primary;
    color: @pr-primary;
  }

  &.primary {
    border-color: @pr-primary;
    background: @pr-primary;
    color: #fff;
  }
}
</style>
