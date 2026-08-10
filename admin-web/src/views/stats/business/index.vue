<script setup lang="ts">
import { useRouter } from 'vue-router';
import PageContainer from '@/components/PageContainer.vue';

/** 业务报表(Super Admin Portal 模块 10 Business Reports):报表类型入口卡 */
const router = useRouter();

const REPORTS = [
  { key: 'merchant', title: 'Merchant Reports', desc: 'Onboarding, verification status, activity, revenue and settlement history', to: '/stats/merchant' },
  { key: 'booking', title: 'Booking Reports', desc: 'All bookings with check-in/out, room types, cancellation rates and channels', to: '/stats/custom' },
  { key: 'revenue', title: 'Revenue Reports', desc: 'Gross revenue, commissions, refunds, net settlements by category', to: '/stats/custom' },
  { key: 'campaign', title: 'Campaign Reports', desc: 'Campaign performance, budget utilization, ROI by campaign type', to: '/stats/finance' },
  { key: 'affiliate', title: 'Affiliate Reports', desc: 'Partner performance, referral counts, commission payouts, fraud summary', to: '/affiliate/partners' },
  { key: 'inventory', title: 'Inventory Reports', desc: 'Availability rates, occupancy metrics, sync status and alert history', to: '/inventory/overview' },
];

function open(to: string): void {
  void router.push(to);
}
</script>

<template>
  <PageContainer>
    <a-row :gutter="16">
      <a-col v-for="r in REPORTS" :key="r.key" :span="8" style="margin-bottom: 16px">
        <a-card :bordered="false" class="mtrip-card-shadow" hoverable @click="open(r.to)">
          <div style="font-size: 15px; font-weight: 600; color: var(--sap-text)">{{ r.title }}</div>
          <div style="font-size: 13px; color: var(--sap-muted); margin-top: 8px; min-height: 40px">{{ r.desc }}</div>
          <a-button type="link" style="padding: 0; margin-top: 8px">Open →</a-button>
        </a-card>
      </a-col>
    </a-row>
  </PageContainer>
</template>
