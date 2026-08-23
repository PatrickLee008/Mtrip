<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckOutlined } from '@ant-design/icons-vue';

/**
 * 入驻阶段步骤条(对照原型 stir-long v4.2.1 实测值)
 * 节点 24×24 圆形:激活=蓝色实心+8px 白芯;已过=绿色 #059669+白勾;未到=#F1F5F9 底+2px #CBD5E1 边+6px 灰芯
 * 连接线 flex:1 高 2px #E3E8F0,已过段变绿;标签 9px 距节点 4px(激活 700 蓝,未到 500 #94A3B8)
 * 四节点(stir-long 原型):New Lead → Contacted → KYC Access Granted → KYC In Progress
 * stage 1-4 逐节点;5(得到正式认可)=全部完成;6(已拒绝)=全部置灰,终态语义由外层 StatusTag 表达
 */
const { t } = useI18n();
const props = defineProps<{ stage: number }>();

const steps = computed<string[]>(() => [
  t('merchant.onboardingPage.stageNewLead'),
  t('merchant.onboardingPage.stageContacted'),
  t('merchant.onboardingPage.stageKycGranted'),
  t('merchant.onboardingPage.stageKycInProgress'),
]);

// 当前位置:0=无高亮(驳回终态),4=全部完成(正式认可终态)
const pos = computed(() => (props.stage === 6 ? 0 : props.stage >= 5 ? 4 : props.stage));
</script>

<template>
  <div class="stage-steps">
    <template v-for="(label, i) in steps" :key="i">
      <div class="stage-steps__item" :class="{ 'is-active': pos === i + 1, 'is-done': pos > i + 1 }">
        <div class="stage-steps__node">
          <CheckOutlined v-if="pos > i + 1" class="stage-steps__check" />
        </div>
        <div class="stage-steps__label">{{ label }}</div>
      </div>
      <div v-if="i < steps.length - 1" class="stage-steps__tail" :class="{ 'is-done': pos > i + 1 }" />
    </template>
  </div>
</template>

<style scoped>
.stage-steps {
  display: flex;
  align-items: flex-start;
}
/* 节点列:圆点 + 标签纵向排列 */
.stage-steps__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
/* 未到节点:浅灰底 + 灰边 + 6px 灰芯 */
.stage-steps__node {
  position: relative;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2px solid #cbd5e1;
}
.stage-steps__node::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
}
/* 激活节点:蓝色实心 + 8px 白芯(项目主色 #2563EB) */
.stage-steps__item.is-active .stage-steps__node {
  background: var(--sap-primary, #2563eb);
  border-color: var(--sap-primary, #2563eb);
}
.stage-steps__item.is-active .stage-steps__node::after {
  width: 8px;
  height: 8px;
  background: #fff;
}
/* 已过节点:绿色实心 + 白色对勾 */
.stage-steps__item.is-done .stage-steps__node {
  background: #059669;
  border-color: #059669;
}
.stage-steps__item.is-done .stage-steps__node::after {
  content: none;
}
.stage-steps__check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
}
.stage-steps__label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #94a3b8;
  white-space: nowrap;
}
.stage-steps__item.is-active .stage-steps__label {
  font-weight: 700;
  color: var(--sap-primary, #2563eb);
}
.stage-steps__item.is-done .stage-steps__label {
  color: #059669;
}
/* 连接线:flex 撑满,对齐节点中心(24px 节点中线 12px - 线高一半 1px) */
.stage-steps__tail {
  flex: 1;
  height: 2px;
  margin: 11px 2px 0;
  background: #e3e8f0;
}
.stage-steps__tail.is-done {
  background: #059669;
}
</style>
