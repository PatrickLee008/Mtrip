<?php

declare(strict_types=1);

namespace App\Chat;

/**
 * mTrip 平台客服机器人的纯逻辑(Consumer App PRD v1.0.6 模块 13):
 * 预订 → 场景、请求语言归一、推荐问题/关键词匹配。不碰数据库,便于 shared 单测直接覆盖。
 *
 * FAQ 行即 chat_support_faq 的一行(数组):faq_key / scene / question / answer / keywords / handoff。
 * handoff:0 仅回答;1 回答后建议转人工(消息带 suggest_agent);2 直接转人工。
 */
final class SupportBot
{
    public const SCENES = ['general', 'payment', 'upcoming', 'in_stay', 'completed', 'cancelled'];

    /** 场景按 order_main.order_status(0待支付 1已支付 2已入住 3已完成 4已取消 5退款中 6已退款 7已过期)+ 离店日 */
    public static function scene(?array $order, string $today): string
    {
        if (! $order) {
            return 'general';
        }
        $status = (int) ($order['order_status'] ?? -1);
        if ($status === 0) return 'payment';
        if (in_array($status, [4, 5, 6, 7], true)) return 'cancelled';
        if ($status === 2) return 'in_stay';
        if ($status === 3) return 'completed';
        if ($status === 1) {
            $end = (string) ($order['end_date'] ?? '');
            return $end !== '' && $end < $today ? 'completed' : 'upcoming';
        }
        return 'general';
    }

    /** 当前/历史:选预订列表分组用 */
    public static function isCurrent(string $scene): bool
    {
        return in_array($scene, ['payment', 'upcoming', 'in_stay'], true);
    }

    /** X-Lang → 支持的语言;my-MM 话术没配时由调用方回退 en-US */
    public static function language(string $header): string
    {
        $h = strtolower(trim($header));
        if (str_starts_with($h, 'zh')) return 'zh-CN';
        if (str_starts_with($h, 'my')) return 'my-MM';
        return 'en-US';
    }

    /**
     * 同一 faq_key 只留一行:请求语言优先于 en-US 兜底,同语言里站点行优先于通用行(site_id=0)。
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function dedupe(array $rows, string $language = 'en-US'): array
    {
        $out = [];
        $rank = static fn (array $r) => [($r['language'] ?? $language) === $language ? 1 : 0, (int) ($r['site_id'] ?? 0) > 0 ? 1 : 0];
        foreach ($rows as $row) {
            $key = (string) $row['faq_key'];
            if (! isset($out[$key]) || $rank($row) > $rank($out[$key])) {
                $out[$key] = $row;
            }
        }
        usort($out, static fn ($a, $b) => [(int) ($a['sort'] ?? 0), (string) $a['faq_key']] <=> [(int) ($b['sort'] ?? 0), (string) $b['faq_key']]);
        return array_values($out);
    }

    /**
     * 推荐问题:所选预订场景的在前,一般咨询补位,最多 $limit 条。
     * @return array<int, array{key: string, question: string}>
     */
    public static function suggestions(array $faqs, string $scene, int $limit = 6): array
    {
        $pick = static fn (string $s) => array_values(array_filter($faqs, static fn ($f) => $f['scene'] === $s && trim((string) $f['question']) !== ''));
        $rows = $scene === 'general' ? $pick('general') : array_merge($pick($scene), $pick('general'));
        return array_map(static fn ($f) => ['key' => (string) $f['faq_key'], 'question' => (string) $f['question']], array_slice($rows, 0, $limit));
    }

    /**
     * 找回复:点了推荐问题按 key 精确命中;否则关键词匹配。
     * 优先级:trigger(转人工/投诉)> 最长关键词命中;同长度时本场景 > 一般 > 其它场景。
     * 都不中返回 null(调用方发 system_fallback 并建议转人工)。
     */
    public static function match(array $faqs, string $content, string $scene, string $faqKey = ''): ?array
    {
        if ($faqKey !== '') {
            foreach ($faqs as $f) {
                if ($f['faq_key'] === $faqKey && $f['scene'] !== 'system') return $f;
            }
        }
        $text = mb_strtolower(trim($content));
        if ($text === '') return null;
        $best = null;
        $bestScore = [-1, -1, -1];
        foreach ($faqs as $f) {
            if ($f['scene'] === 'system') continue;
            $len = 0;
            foreach (explode(',', (string) $f['keywords']) as $kw) {
                $kw = mb_strtolower(trim($kw));
                if ($kw !== '' && self::contains($text, $kw)) $len = max($len, mb_strlen($kw));
            }
            if ($len === 0) continue;
            $rank = match (true) {
                $f['scene'] === $scene => 2,
                $f['scene'] === 'general' => 1,
                default => 0,
            };
            $score = [$f['scene'] === 'trigger' ? 1 : 0, $len, $rank];
            if ($score > $bestScore) {
                $best = $f;
                $bestScore = $score;
            }
        }
        return $best;
    }

    /** 拉丁关键词按词边界匹配(避免 "pay" 命中 "paypal",允许常见词尾 refunds / cancelled),中缅等直接子串 */
    private static function contains(string $text, string $kw): bool
    {
        if (preg_match('/^[a-z0-9 \-\']+$/u', $kw)) {
            return (bool) preg_match('/(?<![a-z0-9])' . preg_quote($kw, '/') . '(?:s|es|d|ed|led|ing|ling)?(?![a-z0-9])/u', $text);
        }
        return str_contains($text, $kw);
    }
}
