/**
 * 教程视频接口(system-service /api/v1/app/tutorial/*,公开)
 *
 * 后端按请求头 X-Lang 返回「所有语言通用」+「当前语言」的已上架教程,
 * 已按分类(酒店 / 餐饮 / 其他)与排序值排好,前端直接渲染。
 */

import { get } from '@/api/request';

export type TutorialCategory = 'hotel' | 'food' | 'other';

export interface TutorialItem {
  id: number;
  category: TutorialCategory;
  /** all = 所有语言通用 */
  lang: string;
  title: string;
  description: string;
  /** 空 = 用本地默认封面 */
  cover_url: string;
  video_url: string;
  duration_sec: number;
}

export function fetchTutorials(): Promise<TutorialItem[]> {
  return get<TutorialItem[]>('/api/v1/app/tutorial/list');
}
