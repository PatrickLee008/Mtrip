<?php

declare(strict_types=1);

/**
 * AppVersion:版本号解析 / 比较 / 强更与可选更新判定(Consumer App PRD 19.1)
 */

use Mtrip\Shared\Support\AppVersion as AV;

MiniTest::add('App版本:解析支持 1~4 段、v 前缀与后缀,非法返回 null', static function (): void {
    MiniTest::assertSame([1, 2, 3], AV::parse('1.2.3'));
    MiniTest::assertSame([1, 2], AV::parse(' v1.2 '));
    MiniTest::assertSame([2, 0, 1], AV::parse('2.0.1-beta.1'));
    MiniTest::assertSame([1, 0, 0, 7], AV::parse('1.0.0.7'));
    MiniTest::assertSame(null, AV::parse(''));
    MiniTest::assertSame(null, AV::parse(null));
    MiniTest::assertSame(null, AV::parse('abc'));
    MiniTest::assertSame(null, AV::parse('1..2'));
    MiniTest::assertSame(null, AV::parse('1.2.3.4.5'));
});

MiniTest::add('App版本:按数字段比较,缺段补 0,不按字符串比较', static function (): void {
    MiniTest::assertSame(-1, AV::compare('1.9.0', '1.10.0'));
    MiniTest::assertSame(0, AV::compare('1.2', '1.2.0'));
    MiniTest::assertSame(1, AV::compare('2.0.0', '1.99.99'));
    MiniTest::assertSame(-1, AV::compare('1.0.0', '1.0.0.1'));
    MiniTest::assertSame(null, AV::compare('x', '1.0.0'));
});

MiniTest::add('App版本:低于最低支持版本 = 强制更新', static function (): void {
    MiniTest::assertSame(['forceUpdate' => true, 'hasUpdate' => true], AV::evaluate('1.0.0', '1.1.0', '1.2.0'));
    // 最新版本未配置时强更仍成立
    MiniTest::assertSame(['forceUpdate' => true, 'hasUpdate' => true], AV::evaluate('1.0.0', '1.1.0', ''));
});

MiniTest::add('App版本:介于最低与最新之间 = 可选更新;已是最新 = 无更新', static function (): void {
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => true], AV::evaluate('1.1.0', '1.1.0', '1.2.0'));
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => false], AV::evaluate('1.2.0', '1.1.0', '1.2.0'));
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => false], AV::evaluate('1.3.0', '1.1.0', '1.2.0'));
});

MiniTest::add('App版本:配置留空或客户端版本非法 = 不提示不强更', static function (): void {
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => false], AV::evaluate('1.0.0', '', ''));
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => false], AV::evaluate('', '9.0.0', '9.0.0'));
    MiniTest::assertSame(['forceUpdate' => false, 'hasUpdate' => false], AV::evaluate('garbage', '9.0.0', '9.0.0'));
});
