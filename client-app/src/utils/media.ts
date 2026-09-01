/**
 * 接口图片地址的统一解析
 *
 * 后端下发的图片字段有三种形态,直接丢给 `<Image>` 会踩两个坑:
 *   1. **相对路径**(`/uploads/rooms/x.png`):web 端同源能出图,原生端没有 origin,加载必失败;
 *      这里统一拼上 `API_BASE_URL`。
 *   2. **脏值**:后台表单里随手填的字符串(实际遇到过 `cover_image = '111'`)既不是 URL 也不是路径,
 *      但因为「非空」而绕过了各处 `uri ? uri : fallback` 的兜底,最终渲染成一张加载失败的空白图。
 *      这里把它判定为「没有图」,让调用方落到本地兜底图或渐变占位。
 *
 * 判定口径刻意保守:只认 `http(s)://` 与以 `/` 开头的路径,其余一律当没有。
 * 宁可多走一次兜底图,也不要在页面上留白块。
 */

import { API_BASE_URL } from '@/config/env';

/** 能不能当图片地址用 */
export function isUsableMediaUri(uri?: string | null): boolean {
  if (typeof uri !== 'string') return false;
  const value = uri.trim();
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

/**
 * 解析成可直接交给 `<Image source={{ uri }}>` 的绝对地址;
 * 不可用时返回 `null`,由调用方决定用本地兜底图还是占位。
 */
export function resolveMediaUri(uri?: string | null): string | null {
  if (!isUsableMediaUri(uri)) return null;
  const value = (uri as string).trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL.replace(/\/+$/, '')}${value}`;
}
