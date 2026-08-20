<script setup lang="ts">
import { ref, reactive, type PropType } from 'vue';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons-vue';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
}

const props = defineProps({
  placeholder: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  filters: { type: Array as PropType<FilterConfig[]>, default: () => [] },
  filterValues: { type: Object as PropType<Record<string, string | number | undefined>>, default: () => ({}) },
  total: { type: Number, default: 0 },
  resultLabel: { type: String, default: '个结果' },
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'update:filterValues', val: Record<string, string | number | undefined>): void;
  (e: 'search'): void;
  (e: 'filterChange', key: string, val: string | number | undefined): void;
}>();

const localValue = ref(props.modelValue);
const localFilterValues = reactive<Record<string, string | number | undefined>>({ ...props.filterValues });
const openKey = ref<string | null>(null);

function getFilterLabel(filter: FilterConfig): string {
  const val = localFilterValues[filter.key];
  if (val === undefined || val === null || val === '') {
    return filter.allLabel ?? filter.label;
  }
  const opt = filter.options.find((o) => o.value === val);
  return opt?.label ?? filter.allLabel ?? filter.label;
}

function isFilterActive(filter: FilterConfig): boolean {
  const val = localFilterValues[filter.key];
  return val !== undefined && val !== null && val !== '';
}

function handleSearch(): void {
  emit('update:modelValue', localValue.value);
  emit('search');
}

function handleFilterChange(key: string, val: string | number | undefined): void {
  localFilterValues[key] = val;
  emit('update:filterValues', { ...localFilterValues });
  emit('filterChange', key, val);
  emit('search');
  openKey.value = null;
}

function clearFilter(key: string, e: MouseEvent): void {
  e.stopPropagation();
  localFilterValues[key] = undefined;
  emit('update:filterValues', { ...localFilterValues });
  emit('filterChange', key, undefined);
  emit('search');
}

function isOpen(filter: FilterConfig): boolean {
  return openKey.value === filter.key;
}

function handleOpenChange(key: string, open: boolean): void {
  openKey.value = open ? key : null;
}
</script>

<template>
  <div class="sfb-bar">
    <div class="sfb-main">
      <div class="sfb-search">
        <input
          v-model="localValue"
          class="sfb-search-input"
          :placeholder="placeholder"
          @keyup.enter="handleSearch"
        />
        <button class="sfb-search-btn" type="button" @click="handleSearch">
          <SearchOutlined />
        </button>
      </div>

      <div class="sfb-filters" v-if="filters.length > 0">
        <template v-for="filter in filters" :key="filter.key">
          <a-dropdown
            :open="isOpen(filter)"
            :trigger="['click']"
            @update:open="handleOpenChange(filter.key, $event)"
          >
            <div class="sfb-filter-item" :class="{ 'is-active': isFilterActive(filter) }">
              <span class="sfb-filter-label">{{ getFilterLabel(filter) }}</span>
              <span v-if="isFilterActive(filter)" class="sfb-filter-clear" @click="clearFilter(filter.key, $event)">
                ×
              </span>
              <span class="sfb-filter-chevron" :class="{ 'is-open': isOpen(filter) }">▾</span>
            </div>
            <template #overlay>
              <div class="sfb-dropdown">
                <div
                  class="sfb-dropdown-item"
                  :class="{ 'is-selected': localFilterValues[filter.key] === undefined }"
                  @click="handleFilterChange(filter.key, undefined)"
                >
                  {{ filter.allLabel ?? filter.label }}
                </div>
                <div
                  v-for="opt in filter.options"
                  :key="opt.value"
                  class="sfb-dropdown-item"
                  :class="{ 'is-selected': localFilterValues[filter.key] === opt.value }"
                  @click="handleFilterChange(filter.key, opt.value)"
                >
                  {{ opt.label }}
                </div>
              </div>
            </template>
          </a-dropdown>
        </template>
      </div>
    </div>

    <div class="sfb-summary" v-if="total > 0">
      <FilterOutlined class="sfb-summary-icon" />
      <span>{{ total }} {{ resultLabel }}</span>
    </div>
  </div>
</template>

<style scoped lang="less">
.sfb-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid var(--sap-border);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s;
  margin-bottom: 16px;

  &:focus-within {
    border-color: var(--sap-brand);
    box-shadow: 0 0 0 2px rgba(22, 100, 255, 0.1);
  }
}

.sfb-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

// ---------- Search input ----------
.sfb-search {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 240px;
  background: transparent;
  padding-right: 12px;
  margin-right: 4px;
}

.sfb-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--mtrip-text-main);
  padding: 6px 8px 6px 4px;
  min-width: 0;

  &::placeholder {
    color: var(--mtrip-text-aux);
  }
}

.sfb-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--mtrip-text-aux);
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--sap-brand-light);
    color: var(--sap-brand);
  }
}

// ---------- Filter items ----------
.sfb-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.sfb-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--mtrip-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;

  &:hover {
    background: var(--sap-surface);
    color: var(--mtrip-text-main);
  }

  &.is-active {
    background: var(--sap-brand);
    color: #ffffff;

    &:hover {
      background: var(--sap-brand-dark);
      color: #ffffff;
    }

    .sfb-filter-chevron {
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

.sfb-filter-label {
  line-height: 1;
}

.sfb-filter-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.5);
  }
}

.sfb-filter-chevron {
  font-size: 10px;
  color: var(--mtrip-text-aux);
  line-height: 1;
  transition: transform 0.15s;

  &.is-open {
    transform: rotate(180deg);
  }
}

// ---------- Dropdown panel ----------
.sfb-dropdown {
  min-width: 140px;
  max-width: 240px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  padding: 4px;
  overflow: hidden;
}

.sfb-dropdown-item {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--mtrip-text-main);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--sap-surface);
  }

  &.is-selected {
    color: var(--sap-brand);
    font-weight: 500;
    background: var(--sap-brand-light);
  }
}

// ---------- Result summary ----------
.sfb-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--sap-surface);
  border-radius: 6px;
  font-size: 12px;
  color: var(--mtrip-text-secondary);
  flex-shrink: 0;
  margin-left: auto;
}

.sfb-summary-icon {
  font-size: 12px;
  color: var(--mtrip-text-aux);
}

// ---------- Responsive: wrap filters ----------
@media (max-width: 768px) {
  .sfb-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .sfb-main {
    flex-wrap: wrap;
  }

  .sfb-search {
    padding-right: 0;
    padding-bottom: 8px;
    margin-right: 0;
    min-width: 100%;
    border-bottom: 1px solid var(--sap-border);
  }

  .sfb-summary {
    margin-left: 0;
    align-self: flex-end;
  }
}
</style>
