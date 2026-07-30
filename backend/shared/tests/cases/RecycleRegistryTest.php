<?php

declare(strict_types=1);

/**
 * 回收站注册表用例:白名单单一事实源的完整性与安全约束
 *
 * RecycleRegistry 位于 system-service 的 App\Support 命名空间(非 shared 包),
 * 无任何依赖,直接 require 物理文件参与断言。
 */

use App\Support\RecycleRegistry;

if (! class_exists(RecycleRegistry::class)) {
    require __DIR__ . '/../../../services/system-service/app/Support/RecycleRegistry.php';
}

MiniTest::add('RecycleRegistry::get 非法 key 拒绝(白名单)', static function (): void {
    MiniTest::assertSame(null, RecycleRegistry::get('order_main'), '排除表不在白名单');
    MiniTest::assertSame(null, RecycleRegistry::get('not_exist'), '未知表拒绝');
    MiniTest::assertSame(null, RecycleRegistry::get(''), '空 key 拒绝');
    MiniTest::assertSame(null, RecycleRegistry::get('user_info; DROP TABLE'), '注入串拒绝');
});

MiniTest::add('RecycleRegistry::get 合法 key 命中', static function (): void {
    $item = RecycleRegistry::get('user_info');
    MiniTest::assertTrue($item !== null, 'user_info 在白名单内');
    MiniTest::assertSame('business', $item['conn']);
    MiniTest::assertSame('user_info', $item['table']);
    MiniTest::assertSame('site', $item['scope']);
});

MiniTest::add('RecycleRegistry::all key 唯一', static function (): void {
    $keys = array_column(RecycleRegistry::all(), 'key');
    MiniTest::assertSame(count($keys), count(array_unique($keys)), 'key 不得重复');
    MiniTest::assertTrue(count($keys) > 0, '注册表非空');
});

MiniTest::add('RecycleRegistry::all 结构与约束完整', static function (): void {
    foreach (RecycleRegistry::all() as $item) {
        $hint = (string) ($item['key'] ?? '?');
        // 必备字段齐全
        foreach (['key', 'conn', 'table', 'group', 'label', 'labelEn', 'scope', 'title', 'search'] as $field) {
            MiniTest::assertTrue(isset($item[$field]), $hint . " 缺字段 {$field}");
        }
        // 枚举约束
        MiniTest::assertTrue(in_array($item['conn'], ['system', 'business'], true), $hint . ' conn 合法');
        MiniTest::assertTrue(in_array($item['group'], ['system', 'business'], true), $hint . ' group 合法');
        MiniTest::assertTrue(in_array($item['scope'], ['site', 'global'], true), $hint . ' scope 合法');
        // 名称/搜索字段非空且非敏感列
        MiniTest::assertTrue(count($item['title']) > 0, $hint . ' title 非空');
        MiniTest::assertTrue(count($item['search']) > 0, $hint . ' search 非空');
        foreach (array_merge($item['title'], $item['search']) as $col) {
            $lower = strtolower($col);
            $sensitive = str_contains($lower, 'password') || str_contains($lower, 'secret')
                || str_contains($lower, 'token') || str_contains($lower, 'salt')
                || str_contains($lower, 'app_key') || str_contains($lower, 'access_key');
            MiniTest::assertSame(false, $sensitive, $hint . " 字段 {$col} 不得为敏感列");
        }
    }
});

MiniTest::add('RecycleRegistry global 表仅限系统库', static function (): void {
    foreach (RecycleRegistry::all() as $item) {
        if ($item['scope'] === 'global') {
            MiniTest::assertSame('system', $item['conn'], $item['key'] . ' global 表须在 system 库');
        }
    }
});
