<?php

declare(strict_types=1);

/**
 * 权限体系用例:Permission 注解多键归一化 + AdminContext 权限判定/站点隔离
 */

use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Context\AdminContext;

// ---------- Permission 注解 ----------
MiniTest::add('Permission::keys 单键/多键/空值归一化', static function (): void {
    MiniTest::assertSame(['sys:admin:add'], (new Permission('sys:admin:add'))->keys());
    MiniTest::assertSame(
        ['goods:hotel:add', 'goods:ticket:add'],
        (new Permission(['goods:hotel:add', 'goods:ticket:add']))->keys()
    );
    MiniTest::assertSame([], (new Permission(''))->keys(), '空串归一化为空数组');
    MiniTest::assertSame([], (new Permission())->keys(), '缺省值归一化为空数组');
    MiniTest::assertSame(
        ['a:b:c'],
        (new Permission(['a:b:c', '']))->keys(),
        '数组内空串被过滤且索引重排'
    );
});

// ---------- AdminContext ----------
MiniTest::add('AdminContext 基础读取与默认值', static function (): void {
    AdminContext::set([]);
    MiniTest::assertSame(0, AdminContext::adminId());
    MiniTest::assertSame('', AdminContext::adminName());
    MiniTest::assertSame(0, AdminContext::siteId());
    MiniTest::assertSame(false, AdminContext::isSuper());
    MiniTest::assertSame([], AdminContext::permissions());

    AdminContext::set(['admin_id' => 9, 'admin_name' => '张三', 'site_id' => 3]);
    MiniTest::assertSame(9, AdminContext::adminId());
    MiniTest::assertSame('张三', AdminContext::adminName());
    MiniTest::assertSame(3, AdminContext::siteId());
});

MiniTest::add('AdminContext::hasPermission 普通管理员精确匹配', static function (): void {
    AdminContext::set(['is_super' => false, 'permissions' => ['goods:hotel:add', 'order:all:list']]);
    MiniTest::assertTrue(AdminContext::hasPermission('goods:hotel:add'));
    MiniTest::assertSame(false, AdminContext::hasPermission('goods:hotel:delete'));
});

MiniTest::add('AdminContext::hasAnyPermission 多键任一匹配', static function (): void {
    AdminContext::set(['is_super' => false, 'permissions' => ['goods:ticket:add']]);
    MiniTest::assertTrue(
        AdminContext::hasAnyPermission(['goods:hotel:add', 'goods:ticket:add']),
        '持有其中一键即通过'
    );
    MiniTest::assertSame(
        false,
        AdminContext::hasAnyPermission(['goods:hotel:delete', 'goods:ticket:delete']),
        '一键未持有则拒绝'
    );
    MiniTest::assertSame(false, AdminContext::hasAnyPermission([]), '空键集拒绝');
});

MiniTest::add('AdminContext 超管跳过权限校验', static function (): void {
    AdminContext::set(['is_super' => true, 'site_id' => 0, 'permissions' => []]);
    MiniTest::assertTrue(AdminContext::hasPermission('whatever:key'));
    MiniTest::assertTrue(AdminContext::hasAnyPermission(['a', 'b']));
    MiniTest::assertTrue(AdminContext::hasAnyPermission([]), '超管空键集也通过');
});

MiniTest::add('AdminContext::scopeSiteId 站点数据隔离', static function (): void {
    // 超管:透传查询站点(null/0 = 不过滤)
    AdminContext::set(['is_super' => true, 'site_id' => 0]);
    MiniTest::assertSame(null, AdminContext::scopeSiteId(null));
    MiniTest::assertSame(0, AdminContext::scopeSiteId(0));
    MiniTest::assertSame(5, AdminContext::scopeSiteId(5));

    // 非超管:强制锁定自身站点,忽略查询入参
    AdminContext::set(['is_super' => false, 'site_id' => 3]);
    MiniTest::assertSame(3, AdminContext::scopeSiteId(null));
    MiniTest::assertSame(3, AdminContext::scopeSiteId(8), '越权查询他站被强制覆盖');
});
