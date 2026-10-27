/**
 * 时间工具:后端 UTC 时间串解析
 *
 * 支付相关接口(`/app/order/pay*`)返回的 `expireAt` / `orderExpireAt` / `paidAt` 是
 * `Y-m-d H:i:s` 格式的 **UTC** 字符串。`new Date('2026-10-27 08:00:00')` 在 Web 上按本地时区解析、
 * 在部分 RN 引擎上直接 Invalid Date,所以这里手动拆字段走 `Date.UTC`,结果与平台/时区无关。
 */

const UTC_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;

/** `Y-m-d H:i:s`(UTC)→ 毫秒时间戳;空值或格式不符返回 null */
export function parseUtcTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = UTC_PATTERN.exec(String(value).trim());
  if (!m) return null;
  const ms = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
  return Number.isNaN(ms) ? null : ms;
}

/** 距某个 UTC 时间点还剩多少秒(不小于 0);无效时间返回 null */
export function secondsUntilUtc(value: string | null | undefined, now = Date.now()): number | null {
  const at = parseUtcTime(value);
  if (at === null) return null;
  return Math.max(0, Math.floor((at - now) / 1000));
}
