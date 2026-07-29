import { computed, reactive, ref, type Ref } from 'vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import type { PageData } from '@/api/types';

/** 通用表格行(后端多为 snake_case 直出) */
export type TableRow = Record<string, any>;

/**
 * 分页列表通用逻辑:查询条件 + 分页 + 加载态
 * 所有列表页统一使用,与后端 Result::page({list,total,page,pageSize}) 对齐
 */
export function useTable<T = TableRow>(
  fetcher: (params: Record<string, unknown>) => Promise<PageData<T>>,
  defaultQuery: Record<string, any> = {},
) {
  const loading = ref(false);
  const list = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const query = reactive<Record<string, any>>({ ...defaultQuery });

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const data = await fetcher({ ...query, page: page.value, pageSize: pageSize.value });
      list.value = data.list;
      total.value = data.total;
    } finally {
      loading.value = false;
    }
  }

  /** 条件变化后从第一页重查 */
  function search(): void {
    page.value = 1;
    void load();
  }

  function reset(): void {
    Object.keys(query).forEach((key) => {
      query[key] = defaultQuery[key];
    });
    search();
  }

  const pagination = computed<TablePaginationConfig>(() => ({
    current: page.value,
    pageSize: pageSize.value,
    total: total.value,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (t: number) => `共 ${t} 条`,
    onChange: (p: number, ps: number) => {
      page.value = p;
      pageSize.value = ps;
      void load();
    },
  }));

  return { loading, list, total, page, pageSize, query, load, search, reset, pagination };
}
