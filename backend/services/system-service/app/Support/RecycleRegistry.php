<?php

declare(strict_types=1);

namespace App\Support;

/**
 * 回收站注册表:软删数据统一管理的单一事实源。
 *
 * 全库仅 mtrip_system 与 mtrip_business 两库共用同一 MySQL,mtrip 账号对两库均有全部权限,
 * 故 system-service 借 business 连接即可集中管理两库所有目标表。新增/移除可回收表只需改本数组。
 *
 * 仅纳入"配置/基础数据表"(均含 site_id),排除交易/财务流水/审计/高频库存等表。
 *
 * 每项字段:
 * - key:   API 与前端使用的稳定标识(取表名,白名单键)
 * - conn:  数据库连接名(system / business)
 * - table: 物理表名
 * - group: 分组(system=系统 / business=业务),用于前端分组展示
 * - label / labelEn: 中英文显示名(内置,避免污染前端 locale)
 * - scope: site=按 site_id 站点隔离(非超管仅本站点);global=仅超管可见
 * - title: 列表展示的名称字段(不含任何敏感/加密字段)
 * - search: 关键词 LIKE 命中的字段
 */
class RecycleRegistry
{
    /**
     * @var array<int, array{key:string,conn:string,table:string,group:string,label:string,labelEn:string,scope:string,title:array<int,string>,search:array<int,string>}>
     */
    private const TABLES = [
        // ---------- mtrip_system(conn=system) ----------
        ['key' => 'sys_admin', 'conn' => 'system', 'table' => 'sys_admin', 'group' => 'system', 'label' => '管理员账号', 'labelEn' => 'Admin Accounts', 'scope' => 'site', 'title' => ['username', 'real_name'], 'search' => ['username', 'real_name']],
        ['key' => 'sys_role', 'conn' => 'system', 'table' => 'sys_role', 'group' => 'system', 'label' => '角色', 'labelEn' => 'Roles', 'scope' => 'site', 'title' => ['role_name'], 'search' => ['role_name']],
        ['key' => 'sys_menu', 'conn' => 'system', 'table' => 'sys_menu', 'group' => 'system', 'label' => '菜单', 'labelEn' => 'Menus', 'scope' => 'global', 'title' => ['menu_name'], 'search' => ['menu_name']],
        ['key' => 'sys_config', 'conn' => 'system', 'table' => 'sys_config', 'group' => 'system', 'label' => '全局配置', 'labelEn' => 'Global Configs', 'scope' => 'global', 'title' => ['config_name', 'config_key'], 'search' => ['config_name', 'config_key']],
        ['key' => 'sys_site', 'conn' => 'system', 'table' => 'sys_site', 'group' => 'system', 'label' => '站点', 'labelEn' => 'Sites', 'scope' => 'global', 'title' => ['site_name'], 'search' => ['site_name']],
        ['key' => 'sys_site_config', 'conn' => 'system', 'table' => 'sys_site_config', 'group' => 'system', 'label' => '站点配置', 'labelEn' => 'Site Configs', 'scope' => 'site', 'title' => ['config_name', 'config_key'], 'search' => ['config_name', 'config_key']],
        ['key' => 'sys_storage', 'conn' => 'system', 'table' => 'sys_storage', 'group' => 'system', 'label' => '存储配置', 'labelEn' => 'Storage Configs', 'scope' => 'site', 'title' => ['storage_name'], 'search' => ['storage_name']],
        ['key' => 'sys_pay_channel', 'conn' => 'system', 'table' => 'sys_pay_channel', 'group' => 'system', 'label' => '支付渠道', 'labelEn' => 'Pay Channels', 'scope' => 'site', 'title' => ['channel_name', 'channel_code'], 'search' => ['channel_name', 'channel_code']],
        ['key' => 'sys_sms_channel', 'conn' => 'system', 'table' => 'sys_sms_channel', 'group' => 'system', 'label' => '短信渠道', 'labelEn' => 'SMS Channels', 'scope' => 'site', 'title' => ['provider_name', 'provider_code'], 'search' => ['provider_name', 'provider_code']],
        ['key' => 'sys_sms_template', 'conn' => 'system', 'table' => 'sys_sms_template', 'group' => 'system', 'label' => '短信模板', 'labelEn' => 'SMS Templates', 'scope' => 'site', 'title' => ['template_name'], 'search' => ['template_name']],
        ['key' => 'sys_map_config', 'conn' => 'system', 'table' => 'sys_map_config', 'group' => 'system', 'label' => '地图配置', 'labelEn' => 'Map Configs', 'scope' => 'site', 'title' => ['provider'], 'search' => ['provider']],
        ['key' => 'sys_client_perm_template', 'conn' => 'system', 'table' => 'sys_client_perm_template', 'group' => 'system', 'label' => '接口权限模板', 'labelEn' => 'API Perm Templates', 'scope' => 'site', 'title' => ['template_name'], 'search' => ['template_name']],
        ['key' => 'sys_client', 'conn' => 'system', 'table' => 'sys_client', 'group' => 'system', 'label' => '客户端', 'labelEn' => 'Clients', 'scope' => 'site', 'title' => ['client_name', 'client_id'], 'search' => ['client_name', 'client_id']],

        // ---------- mtrip_business(conn=business) ----------
        ['key' => 'user_info', 'conn' => 'business', 'table' => 'user_info', 'group' => 'business', 'label' => '用户', 'labelEn' => 'Users', 'scope' => 'site', 'title' => ['nickname'], 'search' => ['nickname']],
        ['key' => 'user_member_level', 'conn' => 'business', 'table' => 'user_member_level', 'group' => 'business', 'label' => '会员等级', 'labelEn' => 'Member Levels', 'scope' => 'site', 'title' => ['level_name'], 'search' => ['level_name']],
        ['key' => 'merchant_info', 'conn' => 'business', 'table' => 'merchant_info', 'group' => 'business', 'label' => '商户', 'labelEn' => 'Merchants', 'scope' => 'site', 'title' => ['merchant_name', 'merchant_short_name'], 'search' => ['merchant_name', 'merchant_short_name']],
        ['key' => 'merchant_account', 'conn' => 'business', 'table' => 'merchant_account', 'group' => 'business', 'label' => '商户结算账户', 'labelEn' => 'Merchant Accounts', 'scope' => 'site', 'title' => ['account_name', 'bank_name'], 'search' => ['account_name', 'bank_name']],
        ['key' => 'merchant_admin', 'conn' => 'business', 'table' => 'merchant_admin', 'group' => 'business', 'label' => '商户子账号', 'labelEn' => 'Merchant Sub-Accounts', 'scope' => 'site', 'title' => ['username', 'real_name'], 'search' => ['username', 'real_name']],
        ['key' => 'merchant_group', 'conn' => 'business', 'table' => 'merchant_group', 'group' => 'business', 'label' => '商户集团', 'labelEn' => 'Merchant Groups', 'scope' => 'site', 'title' => ['group_name', 'group_short_name'], 'search' => ['group_name', 'group_short_name']],
        ['key' => 'merchant_store', 'conn' => 'business', 'table' => 'merchant_store', 'group' => 'business', 'label' => '商户门店', 'labelEn' => 'Merchant Stores', 'scope' => 'site', 'title' => ['store_name'], 'search' => ['store_name']],
        ['key' => 'supplier_info', 'conn' => 'business', 'table' => 'supplier_info', 'group' => 'business', 'label' => '供应商', 'labelEn' => 'Suppliers', 'scope' => 'site', 'title' => ['supplier_name', 'supplier_short_name'], 'search' => ['supplier_name', 'supplier_short_name']],
        ['key' => 'supplier_goods', 'conn' => 'business', 'table' => 'supplier_goods', 'group' => 'business', 'label' => '供应商供货商品', 'labelEn' => 'Supplier Goods', 'scope' => 'site', 'title' => ['goods_name'], 'search' => ['goods_name']],
        ['key' => 'goods_category', 'conn' => 'business', 'table' => 'goods_category', 'group' => 'business', 'label' => '商品分类', 'labelEn' => 'Goods Categories', 'scope' => 'site', 'title' => ['category_name'], 'search' => ['category_name']],
        ['key' => 'goods_info', 'conn' => 'business', 'table' => 'goods_info', 'group' => 'business', 'label' => '商品', 'labelEn' => 'Goods', 'scope' => 'site', 'title' => ['goods_name'], 'search' => ['goods_name']],
        ['key' => 'hotel_room_type', 'conn' => 'business', 'table' => 'hotel_room_type', 'group' => 'business', 'label' => '酒店房型', 'labelEn' => 'Room Types', 'scope' => 'site', 'title' => ['room_name'], 'search' => ['room_name']],
        ['key' => 'ticket_type', 'conn' => 'business', 'table' => 'ticket_type', 'group' => 'business', 'label' => '门票票种', 'labelEn' => 'Ticket Types', 'scope' => 'site', 'title' => ['ticket_name'], 'search' => ['ticket_name']],
        ['key' => 'goods_refund_rule', 'conn' => 'business', 'table' => 'goods_refund_rule', 'group' => 'business', 'label' => '退改规则', 'labelEn' => 'Refund Rules', 'scope' => 'site', 'title' => ['remark'], 'search' => ['remark']],
        ['key' => 'verify_device', 'conn' => 'business', 'table' => 'verify_device', 'group' => 'business', 'label' => '核销设备', 'labelEn' => 'Verify Devices', 'scope' => 'site', 'title' => ['device_name', 'device_sn'], 'search' => ['device_name', 'device_sn']],
        ['key' => 'verify_rule', 'conn' => 'business', 'table' => 'verify_rule', 'group' => 'business', 'label' => '核销规则', 'labelEn' => 'Verify Rules', 'scope' => 'site', 'title' => ['rule_name'], 'search' => ['rule_name']],
        ['key' => 'marketing_coupon', 'conn' => 'business', 'table' => 'marketing_coupon', 'group' => 'business', 'label' => '优惠券', 'labelEn' => 'Coupons', 'scope' => 'site', 'title' => ['coupon_name'], 'search' => ['coupon_name']],
        ['key' => 'marketing_activity', 'conn' => 'business', 'table' => 'marketing_activity', 'group' => 'business', 'label' => '限时活动', 'labelEn' => 'Activities', 'scope' => 'site', 'title' => ['activity_name'], 'search' => ['activity_name']],
        ['key' => 'marketing_banner', 'conn' => 'business', 'table' => 'marketing_banner', 'group' => 'business', 'label' => '首页Banner', 'labelEn' => 'Banners', 'scope' => 'site', 'title' => ['title'], 'search' => ['title']],
        ['key' => 'marketing_points_rule', 'conn' => 'business', 'table' => 'marketing_points_rule', 'group' => 'business', 'label' => '积分规则', 'labelEn' => 'Points Rules', 'scope' => 'site', 'title' => ['rule_name', 'rule_key'], 'search' => ['rule_name', 'rule_key']],
        ['key' => 'finance_tax_config', 'conn' => 'business', 'table' => 'finance_tax_config', 'group' => 'business', 'label' => '税费配置', 'labelEn' => 'Tax Configs', 'scope' => 'site', 'title' => ['tax_name'], 'search' => ['tax_name']],
    ];

    /**
     * 返回全部注册表项。
     *
     * @return array<int, array<string, mixed>>
     */
    public static function all(): array
    {
        return self::TABLES;
    }

    /**
     * 按 key 取注册表项(白名单校验);不存在返回 null。
     *
     * @return array<string, mixed>|null
     */
    public static function get(string $key): ?array
    {
        foreach (self::TABLES as $item) {
            if ($item['key'] === $key) {
                return $item;
            }
        }
        return null;
    }
}
