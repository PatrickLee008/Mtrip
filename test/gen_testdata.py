#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mtrip 管理后台 (admin-web) 测试数据生成器
=========================================

为什么用生成器而不是直接写死的 SQL?
------------------------------------
库里有一批字段是**加密/哈希存储**的,写死的字符串后端解不开,页面会显示空白:

  1. AES-256-GCM 密文列(手机号/邮箱/身份证/银行账号/密钥类字段)
     后端实现见 backend/shared/src/Support/CryptoHelper.php:
         key  = raw sha256(MTRIP_AES_KEY 字符串)         # 注意是二进制摘要,不是 hex
         iv   = random_bytes(12)
         输出  = base64( IV[12] || TAG[16] || CIPHERTEXT )   # tag 在 iv 之后、密文之前
     本脚本必须复刻同样的布局,否则 openssl_decrypt 校验 tag 失败。

  2. user_info.mobile_hash = HMAC-SHA256(mobile, MTRIP_AES_KEY)
     见 backend/services/user-service/app/Service/UserAuthService.php:189
     该列上有 UNIQUE KEY (site_id, mobile_hash),同一个站点里**最多只能有一行是空串**,
     所以批量造 C 端用户时必须逐个算出真实哈希。

  3. 口令 = bcrypt(password_hash / PASSWORD_BCRYPT),无 pepper、无预哈希。

因此 MTRIP_AES_KEY 必须和运行环境一致(默认从 deploy/.env 读取),
否则密文解出来是空串 —— 后端 decryptField() 是 fail-soft 的,不会报错,只是显示空白。

分表说明
--------
order_main / finance_flow / sys_api_access_log 虽然 DDL 注释里写着"月分表模板",
但后端**尚未实现分表路由**(全库检索无 order_main_YYYYMM 相关代码),
运行时查的就是无后缀表名。所以测试数据直接写无后缀表。

用法
----
    python3 test/gen_testdata.py                    # 默认 medium 规模
    python3 test/gen_testdata.py --scale small
    python3 test/gen_testdata.py --aes-key 'xxx'    # 覆盖密钥
    python3 test/gen_testdata.py --out-dir test/sql

产出
----
    <out-dir>/00-clean.sql     清理本脚本造的数据(按保留 ID 段删除,不碰种子数据)
    <out-dir>/01-system.sql    ... 按域拆分的插入脚本
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import random
import re
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("缺少依赖 cryptography,请先执行: pip3 install cryptography bcrypt")

try:
    import bcrypt
except ImportError:
    sys.exit("缺少依赖 bcrypt,请先执行: pip3 install cryptography bcrypt")


# ============================================================================
# 一、加解密 / 哈希 —— 必须与 PHP 后端逐字节一致
# ============================================================================

class Crypto:
    """复刻 backend/shared/src/Support/CryptoHelper.php + UserAuthService::mobileHash"""

    def __init__(self, aes_key: str):
        if not aes_key:
            raise SystemExit("MTRIP_AES_KEY 为空,无法生成密文(可用 --aes-key 指定)")
        self.aes_key = aes_key
        # PHP: hash('sha256', $key, true) —— 第三个参数 true 表示输出原始二进制
        self._raw_key = hashlib.sha256(aes_key.encode("utf-8")).digest()
        self._aead = AESGCM(self._raw_key)

    def encrypt(self, text: str) -> str:
        """AES-256-GCM,输出 base64(IV[12] || TAG[16] || CIPHERTEXT)"""
        if text is None or text == "":
            return ""  # PHP 侧 encryptField() 对空串直接返回空串
        iv = os.urandom(12)
        # cryptography 的 encrypt() 返回 ciphertext||tag,需要拆开重排成 PHP 的布局
        ct_and_tag = self._aead.encrypt(iv, text.encode("utf-8"), None)
        ciphertext, tag = ct_and_tag[:-16], ct_and_tag[-16:]
        return base64.b64encode(iv + tag + ciphertext).decode("ascii")

    def mobile_hash(self, mobile: str) -> str:
        """user_info.mobile_hash = hash_hmac('sha256', $mobile, MTRIP_AES_KEY)"""
        return hmac.new(
            self.aes_key.encode("utf-8"), mobile.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    def phone_index(self, phone: str) -> str:
        """
        merchant_info.contact_phone_index / merchant_application_business.contact_phone_index
        见 backend/shared/src/Merchant/MerchantPhoneIndex.php:
            hash_hmac('sha256', 'm12-phone-v1:' . $phone, $key)
        传入前需手机号归一化(去格式化字符、去 + / 00 前缀)。
        """
        return hmac.new(
            self.aes_key.encode("utf-8"),
            f"m12-phone-v1:{phone}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()


def bcrypt_hash(password: str) -> str:
    """PHP password_hash($p, PASSWORD_BCRYPT) 的等价物,统一输出 $2y$ 前缀"""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10))
    return hashed.decode("ascii").replace("$2b$", "$2y$", 1)


def normalize_phone(phone: str) -> str:
    """对齐 MerchantPhoneIndex::hash() 的归一化规则"""
    p = re.sub(r"[\s().-]+", "", phone.strip())
    p = p.lstrip("+")
    if p.startswith("00"):
        p = p[2:]
    return p


# ============================================================================
# 二、SQL 输出器
# ============================================================================

SYSTEM_DB = "mtrip_system"
BIZ_DB = "mtrip_business"

# 测试数据保留的 ID 段(种子数据都在低位,不会被误删)
ID_BASE = 1001
SYS_ID_BASE = 101
STOCK_ID_BASE = 1000001


def q(v) -> str:
    """把 Python 值转成 MySQL 字面量"""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, Decimal)):
        return str(v)
    if isinstance(v, float):
        return f"{v:.2f}"
    if isinstance(v, (datetime, date)):
        return "'" + v.strftime("%Y-%m-%d %H:%M:%S") + "'"
    s = str(v)
    s = s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    return "'" + s + "'"


def money(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"))


class SqlFile:
    """按域收集 INSERT,并记录每张表的清理条件,用于生成 00-clean.sql"""

    def __init__(self, name: str, db: str):
        self.name = name
        self.db = db
        self.parts: list[str] = []
        self.clean: dict[str, str] = {}  # "db.table" -> WHERE 条件

    def add(self, comment: str) -> None:
        self.parts.append(f"\n-- {comment}\n")

    def insert(self, db: str, table: str, rows: list[dict], clean: str | None = None) -> None:
        if not rows:
            return
        # 列顺序取所有行 key 的并集,保持首次出现顺序
        cols: list[str] = []
        for r in rows:
            for k in r:
                if k not in cols:
                    cols.append(k)

        # 记录清理条件
        key = f"{db}.{table}"
        if clean:
            self.clean[key] = clean
        elif "id" in cols:
            min_id = min(int(r["id"]) for r in rows if r.get("id") is not None)
            cond = f"id >= {min_id}"
            if key not in self.clean or min_id < int(self.clean[key].split()[-1]):
                self.clean[key] = cond

        prefix = f"INSERT INTO `{table}` (`" + "`,`".join(cols) + "`) VALUES\n"
        batch, out = 0, []
        for r in rows:
            out.append("(" + ",".join(q(r.get(c)) for c in cols) + ")")
            batch += 1
            if batch >= 100:
                self.parts.append(prefix + ",\n".join(out) + ";\n")
                out, batch = [], 0
        if out:
            self.parts.append(prefix + ",\n".join(out) + ";\n")

    def render(self) -> str:
        head = (
            "-- ============================================================\n"
            f"-- {self.name}\n"
            "-- 由 test/gen_testdata.py 自动生成,请勿手工编辑\n"
            "-- ============================================================\n"
            "SET NAMES utf8mb4;\n"
            f"USE `{self.db}`;\n\n"
        )
        return head + "".join(self.parts)


# ============================================================================
# 三、数据池
# ============================================================================

SITE_IDS = [1, 3, 4]           # 全球 / 法国 / 巴黎
MAIN_SITE = 4                  # 主要运营站点(巴黎)
MMK_SITE = 7                   # 缅甸仰光运营站(货币 MMK,见 database/seed/03-config-site.sql)
MMK_ID_BASE = 7001             # MMK 市场业务行高位 ID 段(避开 EUR 的 1001 段)
MMK_ADMIN_BASE = 4701          # MMK 商户登录账号 ID 段(EUR owner 从 4001 起)

HOTEL_POOL = [
    ("巴黎星辰大酒店", "Paris Etoile Grand Hotel", 5),
    ("塞纳河畔精品酒店", "Seine Riverside Boutique", 4),
    ("蒙马特艺术酒店", "Montmartre Art Hotel", 4),
    ("卢浮宫花园酒店", "Louvre Garden Hotel", 5),
    ("拉丁区公寓酒店", "Latin Quarter Residence", 3),
    ("里昂火车站商务酒店", "Lyon Station Business Hotel", 3),
    ("香榭丽舍尊享酒店", "Champs-Elysees Premium", 5),
    ("巴士底设计酒店", "Bastille Design Hotel", 4),
    ("圣日耳曼客栈", "Saint-Germain Inn", 3),
    ("蒙帕纳斯快捷酒店", "Montparnasse Express", 2),
    ("普罗旺斯田园酒店", "Provence Countryside Hotel", 4),
    ("蓝色海岸度假酒店", "Cote d'Azur Resort", 5),
    ("阿尔卑斯山居酒店", "Alpes Mountain Lodge", 4),
    ("波尔多酒庄酒店", "Bordeaux Chateau Hotel", 5),
    ("阿姆斯特丹运河酒店", "Amsterdam Canal Hotel", 4),
    ("布鲁塞尔中心酒店", "Brussels Central Hotel", 3),
]

ATTRACTION_POOL = [
    ("埃菲尔铁塔景区", "Eiffel Tower Attraction", 2),
    ("卢浮宫博物馆", "Louvre Museum", 2),
    ("凡尔赛宫景区", "Versailles Palace", 2),
    ("巴黎迪士尼乐园", "Disneyland Paris", 2),
    ("塞纳河游船码头", "Seine River Cruise Pier", 2),
    ("巴黎圣母院钟楼", "Notre-Dame Towers", 2),
]

CITY_POOL = [
    ("Paris", "FR", 48.8566, 2.3522),
    ("Lyon", "FR", 45.7640, 4.8357),
    ("Marseille", "FR", 43.2965, 5.3698),
    ("Bordeaux", "FR", 44.8378, -0.5792),
    ("Nice", "FR", 43.7102, 7.2620),
    ("Amsterdam", "NL", 52.3676, 4.9041),
    ("Brussels", "BE", 50.8503, 4.3517),
]

FIRST_NAME = ["Alice", "Bruno", "Chen", "Daniel", "Emma", "Felix", "Grace", "Hugo",
              "Isabelle", "Julien", "Karim", "Lea", "Marc", "Nina", "Omar", "Pauline",
              "Quentin", "Rania", "Sophie", "Tomas"]
LAST_NAME = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit",
             "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel",
             "Garcia", "Nguyen", "Silva", "Costa", "Haddad", "Weber"]

DOC_TYPES = ["business_license", "operating_license", "owner_id", "bank_cert", "tax_cert",
             "business_reg", "hotel_license", "id_doc", "bank_letter", "premises_lease"]

REJECT_REASONS = [
    "营业执照已过期,请上传最新版本",
    "法人身份证件照片模糊,无法辨识",
    "银行账户证明与公司名称不一致",
    "经营场所租赁合同缺少出租方签章",
    "税务登记证缺失",
]

BANKS = ["BNP Paribas", "Societe Generale", "Credit Agricole", "ING Bank", "KBC Bank"]

COUPON_POOL = [
    ("新客立减 20 欧", 3, 20.00, 0.00, 0),
    ("酒店满 200 减 30", 1, 30.00, 200.00, 1),
    ("门票 9 折券", 2, 8.50, 0.00, 2),
    ("夏季大促满减", 1, 50.00, 300.00, 0),
    ("长住专享券", 3, 40.00, 500.00, 1),
    ("平台通用无门槛", 3, 15.00, 0.00, 0),
]

RULE_POOL = [
    ("Booking", "取消政策必须明示", 2),
    ("Listing", "商品图片不得使用网络盗图", 3),
    ("Pricing", "不得虚标高价后大额折扣", 2),
    ("Operations", "订单需在 2 小时内确认", 1),
    ("Reviews", "禁止诱导好评或刷单", 1),
    ("Finance", "结算账户须与主体一致", 1),
    ("Compliance", "资质文件过期前 30 天需更新", 2),
    ("Marketing", "促销活动需提前 3 天报备", 4),
]

VIOLATION_POOL = [
    ("到店无房", "Booking", 1),
    ("实际房型与描述不符", "Listing", 2),
    ("虚假折扣", "Pricing", 2),
    ("拒绝履行已确认订单", "Operations", 1),
    ("疑似刷单评价", "Reviews", 2),
    ("结算账户与主体不一致", "Finance", 1),
    ("资质文件已过期", "Compliance", 3),
    ("未报备开展促销", "Marketing", 4),
]

AFFILIATE_POOL = [
    ("Marie Travel", "marie_travel", "influencer", "Instagram"),
    ("Wanderlust Diaries", "wanderlust_diaries", "blogger", "YouTube"),
    ("Paris Insider", "paris_insider", "kol", "TikTok"),
    ("Euro Trip Deals", "euro_trip_deals", "ota_partner", "Website"),
    ("Corporate Stays Ltd", "corporate_stays", "corporate", "LinkedIn"),
    ("Backpack Europe", "backpack_europe", "influencer", "Instagram"),
    ("Luxury Escapes", "luxury_escapes", "kol", "YouTube"),
    ("Family Holiday Tips", "family_holiday", "blogger", "Blog"),
]

SUPPLIER_POOL = [
    ("欧洲酒店批发中心", "Euro Hotel Wholesale", 1),
    ("环球景区代理", "Global Attraction Agency", 2),
    ("综合旅游资源供应", "Allied Travel Supply", 3),
    ("地中海度假资源", "Med Resort Resources", 1),
    ("北欧景区直通车", "Nordic Sight Direct", 2),
]

HELP_CATEGORY = [
    ("预订与支付", "booking", "💳"),
    ("退款与取消", "refund", "↩️"),
    ("账号与安全", "account", "🔒"),
    ("商户入驻", "merchant", "🏨"),
]

FEEDBACK_POOL = [
    "房间卫生状况不佳,希望改进",
    "退款迟迟未到账,请帮忙处理",
    "商户拒绝接待已确认的订单",
    "App 搜索筛选不好用",
    "希望增加更多支付方式",
    "客服响应速度太慢",
]

# ---- 缅甸(MMK)市场数据池:仅供 build_mmk_market 使用,与 EUR 数据完全隔离 ----
MM_HOTEL_POOL = [
    ("仰光大金塔景观酒店", "Yangon Shwedagon View Hotel", 5),
    ("茵莱湖畔度假酒店", "Inle Lake Resort", 4),
    ("蒲甘古城精品酒店", "Bagan Heritage Boutique", 4),
    ("曼德勒皇宫商务酒店", "Mandalay Palace Business Hotel", 3),
    ("内比都中央酒店", "Naypyidaw Central Hotel", 4),
]

MM_CITY_POOL = [
    ("Yangon", "MM", 16.8409, 96.1735),
    ("Mandalay", "MM", 21.9588, 96.0891),
    ("Naypyidaw", "MM", 19.7633, 96.0785),
    ("Bagan", "MM", 21.1717, 94.8585),
    ("Inle", "MM", 20.5860, 96.9100),
]

MM_BANKS = ["KBZ Bank", "AYA Bank", "CB Bank", "Yoma Bank", "AGD Bank"]

MM_FIRST_NAME = ["Aung", "Su", "Kyaw", "Thida", "Zaw", "Nilar", "Min", "Ei",
                 "Htet", "Yamin", "Wai", "Moe", "Phyo", "Nyein"]
MM_LAST_NAME = ["Kyaw", "Hlaing", "Win", "Oo", "Tun", "Aung", "Soe", "Myint",
                "Naing", "Thu", "Zin", "Lwin"]

MM_ROOM_NAMES = ["高级大床房", "湖景套房", "行政客房", "家庭房"]


# ============================================================================
# 四、上下文:跨域共享的 ID 与对象
# ============================================================================

class Ctx:
    def __init__(self, crypto: Crypto, rng: random.Random, scale: float, now: datetime):
        self.c = crypto
        self.rng = rng
        self.scale = scale
        self.now = now
        self.admin_ids: list[int] = []
        self.merchants: list[dict] = []
        self.stores: list[dict] = []
        self.groups: list[dict] = []
        self.goods: list[dict] = []
        self.room_types: list[dict] = []
        self.ticket_types: list[dict] = []
        self.users: list[dict] = []
        self.orders: list[dict] = []
        self.coupons: list[dict] = []
        self.partners: list[dict] = []
        self.rules: list[dict] = []
        self.suppliers: list[dict] = []
        self.applications: list[dict] = []
        # 校验清单:{(库,表,id,列): 明文},供 test/verify_testdata.php 抽样回解
        self.verify_samples: dict[tuple, str] = {}

    def n(self, base: int) -> int:
        """按规模缩放数量"""
        return max(1, int(round(base * self.scale)))

    def ago(self, days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
        return self.now - timedelta(days=days, hours=hours, minutes=minutes)

    def rand_dt(self, max_days_ago: int, min_days_ago: int = 0) -> datetime:
        return self.ago(days=self.rng.randint(min_days_ago, max_days_ago),
                        hours=self.rng.randint(0, 23),
                        minutes=self.rng.randint(0, 59))


# ============================================================================
# 五、各域数据构建
# ============================================================================

def build_system(ctx: Ctx, f: SqlFile) -> None:
    """系统域:管理员账号、角色、权限、日志、平台配置"""
    rng, c = ctx.rng, ctx.c
    pw = bcrypt_hash("Admin@123456")

    # ---- 角色(种子已有 id=1 超级管理员)----
    # menu id 分段:100 仪表盘 / 2xx 商户验证 / 3xx 商户管理 / 4xx 业务运营 / 5xx 促销
    #              / 6xx 达人 / 7xx 合规 / 8xx 用户与角色 / 9xx 报表 / 10xx 终端用户
    #              / 11xx 帮助 / 12xx 内容 / 13xx 平台配置 / 14xx 供应商 / 15xx 商品
    #              / 16xx 核销 / 17xx Trip 财务 / 18xx 日志
    def rng_cond(segs: list[int]) -> str:
        parts = []
        for s in segs:
            lo, hi = s * 100, s * 100 + 99
            parts.append(f"(m.id BETWEEN {lo} AND {hi})")
            parts.append(f"(m.id BETWEEN {lo * 100} AND {hi * 100 + 99})")
        parts.append("(m.id = 100)")
        return " OR ".join(parts)

    roles = [
        (101, MAIN_SITE, "站点管理员", 2, "巴黎站点全权限"),
        (102, MAIN_SITE, "运营专员", 2, "商户入驻审核 + 订单运营"),
        (103, MAIN_SITE, "财务专员", 2, "结算、对账、提现审核"),
        (104, MAIN_SITE, "客服专员", 2, "终端用户、客服会话、帮助中心"),
        (105, 0, "只读审计员", 1, "全平台只读,用于审计"),
    ]
    f.add("角色")
    f.insert(SYSTEM_DB, "sys_role", [
        {"id": rid, "site_id": sid, "role_name": name, "role_type": rt,
         "description": desc, "status": 1,
         "created_at": ctx.ago(300), "updated_at": ctx.ago(300)}
        for rid, sid, name, rt, desc in roles
    ])

    f.add("角色 - 菜单权限(按 sys_menu 的 ID 段批量授予,避免依赖具体菜单 ID)")
    grants = {
        101: list(range(1, 19)),                    # 全菜单
        102: [2, 3, 4, 15, 16, 9, 17],              # 商户验证/管理/运营/商品/核销/报表/财务
        103: [4, 17, 9, 14],                        # 运营/财务/报表/供应商
        104: [4, 10, 11, 9],                        # 运营/终端用户/帮助/报表
        105: list(range(1, 19)),                    # 全菜单(只读)
    }
    for role_id, segs in grants.items():
        f.parts.append(
            f"INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)\n"
            f"SELECT {role_id}, m.id FROM `sys_menu` m "
            f"WHERE m.deleted_at IS NULL AND ({rng_cond(segs)});\n"
        )
    f.clean[f"{SYSTEM_DB}.sys_role_menu"] = "role_id >= 101"

    # ---- 管理员账号 ----
    admins = [
        (101, MAIN_SITE, "site_admin", "站点管理员", 0, 101, "巴黎站点管理员(用于验证站点隔离)"),
        (102, MAIN_SITE, "operator", "运营专员", 0, 102, "负责商户入驻审核"),
        (103, MAIN_SITE, "finance", "财务专员", 0, 103, "负责结算与提现审核"),
        (104, MAIN_SITE, "support", "客服专员", 0, 104, "负责终端用户与会话"),
        (105, 0, "auditor", "只读审计员", 0, 105, "全平台只读"),
        (106, 3, "fr_admin", "法国站点管理员", 0, 101, "法国站点(用于跨站点隔离对比)"),
        (107, MAIN_SITE, "disabled_admin", "已禁用账号", 0, 101, "状态=2,用于验证禁用账号不可登录"),
        (108, MMK_SITE, "mm_admin", "缅甸站点管理员", 0, 101, "仰光站点(MMK 货币,用于多币种/站点隔离验证)"),
    ]
    f.add("管理员账号(口令统一 Admin@123456)")
    f.insert(SYSTEM_DB, "sys_admin", [
        {"id": aid, "site_id": sid, "username": uname, "password": pw, "real_name": real,
         "mobile": c.encrypt(f"+3361{rng.randint(1000000, 9999999)}"),
         "email": f"{uname}@mtrip.test", "avatar": "", "is_super": is_super,
         "status": 1 if aid != 107 else 2, "login_fail_count": 0,
         "last_login_at": ctx.rand_dt(7) if aid != 107 else None,
         "last_login_ip": f"10.0.{rng.randint(0, 9)}.{rng.randint(1, 254)}",
         "remark": remark, "created_at": ctx.ago(300), "updated_at": ctx.rand_dt(7)}
        for aid, sid, uname, real, is_super, _role, remark in admins
    ])
    ctx.admin_ids = [a[0] for a in admins]

    f.add("账号 - 角色关联")
    f.insert(SYSTEM_DB, "sys_admin_role", [
        {"admin_id": aid, "role_id": role, "created_at": ctx.ago(300)}
        for aid, _sid, _u, _r, _s, role, _m in admins
    ], clean="admin_id >= 101")

    # ---- 登录日志 ----
    f.add("管理员登录日志(含失败/锁定,用于验证登录日志筛选)")
    login_rows = []
    lid = ID_BASE
    for _ in range(ctx.n(60)):
        aid = rng.choice(ctx.admin_ids)
        uname = next(a[2] for a in admins if a[0] == aid)
        status = rng.choices([1, 2, 3, 4], weights=[78, 15, 4, 3])[0]
        login_rows.append({
            "id": lid, "admin_id": aid, "username": uname, "site_id": MAIN_SITE,
            "login_ip": f"{rng.randint(1, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
            "user_agent": rng.choice([
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.4",
                "Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0",
            ]),
            "status": status,
            "remark": {1: "登录成功", 2: "密码错误", 3: "账号锁定", 4: "账号禁用"}[status],
            "created_at": ctx.rand_dt(30),
        })
        lid += 1
    f.insert(SYSTEM_DB, "sys_admin_login_log", login_rows)

    # ---- 操作日志 ----
    f.add("系统操作日志")
    op_rows, oid = [], ID_BASE
    modules = [("merchant", ["audit", "suspend", "blacklist", "impersonate"]),
               ("order", ["cancel", "refund_audit", "export"]),
               ("goods", ["audit", "off_shelf", "edit_stock"]),
               ("finance", ["settle_confirm", "withdraw_pay"]),
               ("system", ["add_admin", "edit_role", "reset_pwd"]),
               ("marketing", ["add_coupon", "stop_coupon"]),
               ("user", ["freeze", "adjust_balance", "blacklist"])]
    for _ in range(ctx.n(80)):
        mod, acts = rng.choice(modules)
        act = rng.choice(acts)
        aid = rng.choice(ctx.admin_ids)
        real = next(a[3] for a in admins if a[0] == aid)
        op_rows.append({
            "id": oid, "admin_id": aid, "admin_name": real, "site_id": MAIN_SITE,
            "module": mod, "action": act,
            "content": json.dumps({"target": rng.randint(1, 9999), "result": "ok"},
                                  ensure_ascii=False),
            "request_url": f"/api/{mod}/{act}", "request_method": rng.choice(["POST", "PUT", "DELETE"]),
            "client_ip": f"10.0.{rng.randint(0, 9)}.{rng.randint(1, 254)}",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0",
            "status_code": rng.choices([200, 200, 200, 403, 500], weights=[88, 1, 1, 5, 5])[0],
            "created_at": ctx.rand_dt(30),
        })
        oid += 1
    f.insert(SYSTEM_DB, "sys_operation_log", op_rows)

    # ---- 接口访问日志 ----
    f.add("接口访问日志")
    api_rows, apid = [], ID_BASE
    paths = ["/api/v1/goods/list", "/api/v1/order/list", "/api/v1/merchant/list",
             "/api/v1/user/list", "/api/v1/finance/settle", "/api/v1/coupon/list"]
    for _ in range(ctx.n(80)):
        path = rng.choice(paths)
        code = rng.choices([200, 200, 200, 401, 404, 500], weights=[80, 5, 5, 4, 3, 3])[0]
        api_rows.append({
            "id": apid, "site_id": rng.choice(SITE_IDS), "client_pk_id": 0,
            "client_id": f"mtrip_{rng.choice(['android', 'ios', 'h5'])}",
            "client_name": "Mtrip App", "client_type": rng.randint(1, 3),
            "api_path": path, "request_method": rng.choice(["GET", "POST"]),
            "request_headers": '{"Accept":"application/json"}',
            "request_params": json.dumps({"page": rng.randint(1, 20)}, ensure_ascii=False),
            "response_code": code, "response_body": json.dumps({"code": 0}, ensure_ascii=False),
            "cost_ms": rng.randint(8, 1200),
            "device_info": rng.choice(["Pixel 8", "iPhone 15", "Web"]),
            "client_ip": f"{rng.randint(1, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
            "created_at": ctx.rand_dt(14),
        })
        apid += 1
    f.insert(SYSTEM_DB, "sys_api_access_log", api_rows)

    # ---- 平台配置 ----
    f.add("存储配置")
    ctx.verify_samples[("mtrip_system", "sys_storage", 101, "access_key")] = "AKIAEXAMPLEKEY0001"
    ctx.verify_samples[("mtrip_system", "sys_storage", 101, "secret_key")] = "secret-example-key-0001"
    f.insert(SYSTEM_DB, "sys_storage", [
        {"id": 101, "site_id": 0, "driver": "s3", "storage_name": "AWS S3 主存储",
         "bucket": "mtrip-assets", "region": "eu-west-3",
         "access_key": c.encrypt("AKIAEXAMPLEKEY0001"),
         "secret_key": c.encrypt("secret-example-key-0001"),
         "cdn_domain": "https://cdn.mtrip.test", "path_prefix": "prod/", "expire_days": 0,
         "is_default": 1, "status": 1, "remark": "主存储(密钥已 AES 加密)",
         "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "driver": "local", "storage_name": "本地存储(测试)",
         "bucket": "", "region": "", "access_key": "", "secret_key": "",
         "cdn_domain": "", "path_prefix": "uploads/", "expire_days": 0,
         "is_default": 0, "status": 1, "remark": "本地磁盘存储",
         "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])

    f.add("支付渠道")
    ctx.verify_samples[("mtrip_system", "sys_pay_channel", 101, "api_key")] = "sk_test_example_stripe_key"
    f.insert(SYSTEM_DB, "sys_pay_channel", [
        {"id": 101, "site_id": 0, "channel_name": "Stripe", "channel_code": "stripe",
         "api_key": c.encrypt("sk_test_example_stripe_key"), "merchant_no": "acct_1Ptest",
         "webhook_url": "https://api.mtrip.test/webhook/stripe", "fee_rate": money(2.90),
         "min_amount": money(1.00), "max_amount": money(0),
         "currencies": json.dumps(["EUR", "USD", "GBP"]), "split_enabled": 1,
         "status": 1, "remark": "Stripe 测试渠道", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "channel_name": "PayPal", "channel_code": "paypal",
         "api_key": c.encrypt("paypal_test_client_secret"), "merchant_no": "paypal_merchant_test",
         "webhook_url": "https://api.mtrip.test/webhook/paypal", "fee_rate": money(3.40),
         "min_amount": money(1.00), "max_amount": money(0),
         "currencies": json.dumps(["EUR", "USD"]), "split_enabled": 0,
         "status": 1, "remark": "PayPal 测试渠道", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])

    f.add("短信渠道与模板")
    ctx.verify_samples[("mtrip_system", "sys_sms_channel", 101, "api_key")] = "twilio_test_auth_token"
    f.insert(SYSTEM_DB, "sys_sms_channel", [
        {"id": 101, "site_id": 0, "provider_name": "Twilio", "provider_code": "twilio",
         "api_key": c.encrypt("twilio_test_auth_token"), "account_sid": "ACexample0001",
         "sign_name": "Mtrip", "region_whitelist": json.dumps(["FR", "NL", "BE"]),
         "code_expire_sec": 300, "status": 1, "remark": "国际短信主渠道",
         "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "provider_name": "MessageBird", "provider_code": "messagebird",
         "api_key": c.encrypt("messagebird_test_key"), "account_sid": "",
         "sign_name": "Mtrip", "region_whitelist": None, "code_expire_sec": 300,
         "status": 2, "remark": "备用渠道(当前停用)", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])
    f.insert(SYSTEM_DB, "sys_sms_template", [
        {"id": 101, "site_id": 0, "channel_id": 101, "template_name": "注册验证码",
         "template_type": 1, "content": "Your Mtrip verification code is {code}, valid for 5 minutes.",
         "variables": json.dumps(["code"]), "status": 1, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "channel_id": 101, "template_name": "订单确认通知",
         "template_type": 2, "content": "Your booking {order_no} is confirmed. Check-in: {date}.",
         "variables": json.dumps(["order_no", "date"]), "status": 1, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 103, "site_id": 0, "channel_id": 101, "template_name": "退款完成通知",
         "template_type": 3, "content": "Refund for order {order_no} has been processed.",
         "variables": json.dumps(["order_no"]), "status": 1, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 104, "site_id": 0, "channel_id": 101, "template_name": "商户审核结果通知",
         "template_type": 4, "content": "Your merchant application has been {result}.",
         "variables": json.dumps(["result"]), "status": 1, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])

    f.add("地图配置 / 客户端密钥 / 权限模板")
    ctx.verify_samples[("mtrip_system", "sys_map_config", 101, "api_key")] = "google_maps_test_key"
    f.insert(SYSTEM_DB, "sys_map_config", [
        {"id": 101, "site_id": 0, "provider": "google", "api_key": c.encrypt("google_maps_test_key"),
         "map_language": "en", "default_zoom": 12, "geocode_enabled": 1, "locate_enabled": 1,
         "region_limit": json.dumps(["FR", "NL", "BE"]), "status": 1,
         "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])
    f.insert(SYSTEM_DB, "sys_client_perm_template", [
        {"id": 101, "site_id": 0, "template_name": "C 端默认白名单", "template_type": 1,
         "description": "仅开放商品浏览与下单相关接口", "rule_mode": 1,
         "api_list": json.dumps(["/api/v1/goods/*", "/api/v1/order/create", "/api/v1/user/profile"]),
         "status": 1, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "template_name": "内部调试全放行", "template_type": 1,
         "description": "调试用,禁用状态", "rule_mode": 2, "api_list": json.dumps([]),
         "status": 2, "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])
    ctx.verify_samples[("mtrip_system", "sys_client", 101, "client_secret")] = "android-client-secret-0001"
    f.insert(SYSTEM_DB, "sys_client", [
        {"id": 101, "site_id": 0, "client_name": "Mtrip Android", "client_id": "mtrip_android",
         "client_secret": c.encrypt("android-client-secret-0001"), "client_type": 1,
         "perm_template_id": 101, "qps_limit": 50, "ip_whitelist": "", "status": 1,
         "expire_at": None, "remark": "Android 客户端", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 102, "site_id": 0, "client_name": "Mtrip iOS", "client_id": "mtrip_ios",
         "client_secret": c.encrypt("ios-client-secret-0001"), "client_type": 2,
         "perm_template_id": 101, "qps_limit": 50, "ip_whitelist": "", "status": 1,
         "expire_at": None, "remark": "iOS 客户端", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
        {"id": 103, "site_id": 0, "client_name": "Mtrip H5", "client_id": "mtrip_h5",
         "client_secret": c.encrypt("h5-client-secret-0001"), "client_type": 3,
         "perm_template_id": 101, "qps_limit": 20, "ip_whitelist": "", "status": 2,
         "expire_at": None, "remark": "H5(已停用)", "created_at": ctx.ago(300), "updated_at": ctx.ago(300)},
    ])

    f.add("站点差异化配置(站点 4 巴黎)")
    f.insert(SYSTEM_DB, "sys_site_config", [
        {"id": 101, "site_id": MAIN_SITE, "config_group": "operate", "config_key": "hotel_commission_rate",
         "config_value": "0.12", "config_name": "酒店类目佣金率", "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
        {"id": 102, "site_id": MAIN_SITE, "config_group": "operate", "config_key": "ticket_commission_rate",
         "config_value": "0.08", "config_name": "门票类目佣金率", "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
        {"id": 103, "site_id": MAIN_SITE, "config_group": "page", "config_key": "home_banner_count",
         "config_value": "5", "config_name": "首页 Banner 数量", "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
    ])

    f.add("特性开关(站点 4 覆盖全局默认)")
    f.insert(SYSTEM_DB, "sys_feature_flag", [
        {"id": 101, "site_id": MAIN_SITE, "flag_key": "flash_sale", "label": "限时秒杀",
         "description": "巴黎站开启秒杀活动", "enabled": 1, "sort": 1,
         "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
        {"id": 102, "site_id": MAIN_SITE, "flag_key": "multi_currency", "label": "多币种展示",
         "description": "巴黎站开启多币种", "enabled": 1, "sort": 2,
         "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
        {"id": 103, "site_id": MAIN_SITE, "flag_key": "dynamic_pricing", "label": "动态定价",
         "description": "巴黎站关闭动态定价", "enabled": 0, "sort": 3,
         "created_at": ctx.ago(200), "updated_at": ctx.ago(200)},
    ])

    f.add("App 主题")
    f.insert(SYSTEM_DB, "app_theme", [
        {"id": 101, "site_id": MAIN_SITE, "theme_name": "巴黎夏日主题", "description": "夏季活动主题",
         "thumbnail": "https://cdn.mtrip.test/theme/summer.png",
         "assets": json.dumps({"splash": "", "logo": "", "homeHeader": "", "navAccent": "#ff7a45"}),
         "is_default": 0, "priority": 10, "start_time": ctx.ago(30), "end_time": ctx.ago(-60),
         "status": 1, "created_at": ctx.ago(90), "updated_at": ctx.ago(30)},
        {"id": 102, "site_id": MAIN_SITE, "theme_name": "巴黎冬季节日主题", "description": "未启用的主题",
         "thumbnail": "", "assets": json.dumps({"navAccent": "#1677ff"}),
         "is_default": 0, "priority": 5, "start_time": None, "end_time": None,
         "status": 2, "created_at": ctx.ago(90), "updated_at": ctx.ago(90)},
    ])

    f.add("文件库")
    f.insert(SYSTEM_DB, "sys_file", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "storage_id": 101,
         "file_name": f"merchant_license_{i + 1}.jpg",
         "file_path": f"prod/merchant/{2026}/license_{i + 1}.jpg",
         "file_url": f"https://cdn.mtrip.test/prod/merchant/license_{i + 1}.jpg",
         "file_type": 1, "mime_type": "image/jpeg", "file_size": rng.randint(120000, 2400000),
         "biz_type": "merchant", "uploader_id": 101,
         "created_at": ctx.rand_dt(90), "updated_at": ctx.rand_dt(90)}
        for i in range(ctx.n(6))
    ])


def build_merchant(ctx: Ctx, f: SqlFile) -> None:
    """商户域:集团、商户、门店、账号、入驻申请、资质文档、时间线、黑名单、通知"""
    rng, c = ctx.rng, ctx.c
    pw = bcrypt_hash("Merchant@123456")

    # ---- 集团 ----
    f.add("商户集团")
    groups = [
        (ID_BASE + 0, MAIN_SITE, "星辰酒店集团", "Etoile Group"),
        (ID_BASE + 1, MAIN_SITE, "法兰西文旅集团", "France Tourism Group"),
        (ID_BASE + 2, 3, "欧洲度假联盟", "Euro Resort Alliance"),
    ]
    f.insert(BIZ_DB, "merchant_group", [
        {"id": gid, "site_id": sid, "group_name": name, "group_short_name": en,
         "logo": "", "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
         "contact_phone": c.encrypt(f"+3361{rng.randint(1000000, 9999999)}"),
         "contact_email": f"group{gid}@mtrip.test", "status": 1,
         "remark": "测试数据", "created_at": ctx.ago(400), "updated_at": ctx.rand_dt(20)}
        for gid, sid, name, en in groups
    ])
    ctx.groups = [{"id": g[0], "site_id": g[1], "name": g[2]} for g in groups]

    # ---- 商户:覆盖全部 7 种状态 ----
    # status: 0待审核 1审核通过 2审核驳回 3已启用 4已禁用 5已注销 6待重新提交
    status_plan = ([3] * ctx.n(12) + [0] * ctx.n(3) + [1] * 2 + [2] * 2 + [4] * 2 + [6] * 2 + [5] * 1)
    pool = [(n, e, s) for n, e, s in HOTEL_POOL + ATTRACTION_POOL]
    rng.shuffle(pool)

    f.add(f"商户主体(共 {len(status_plan)} 家,覆盖 0~6 全部状态)")
    merchants, mid = [], ID_BASE
    for i, st in enumerate(status_plan):
        name, en, star = pool[i % len(pool)]
        city, country, lat, lng = rng.choice(CITY_POOL)
        site_id = MAIN_SITE if i % 3 else rng.choice([1, 3])
        is_hotel = "酒店" in name or "Hotel" in en or "Lodge" in en or "Inn" in en or "Resort" in en
        mtype = 1 if is_hotel else 2
        if i % 11 == 0:
            mtype = 3  # 综合
        gid = rng.choice([0] + [g["id"] for g in ctx.groups]) if i % 2 else 0
        credit = f"FR{ rng.randint(100000000, 999999999) }0001{i:03d}".replace(" ", "")
        phone = f"+3361{rng.randint(1000000, 9999999)}"
        if i == 0:
            ctx.verify_samples[("mtrip_business", "merchant_info", mid, "contact_phone_index")] = phone
        rec = {
            "id": mid, "merchant_code": f"MCH-{mid}", "site_id": site_id, "group_id": gid,
            "merchant_name": f"{name}(巴黎{i + 1}店)" if i % 4 == 0 else name,
            "merchant_short_name": en, "merchant_type": mtype,
            "credit_code": credit,
            "business_license": f"https://cdn.mtrip.test/prod/merchant/license_{mid}.jpg",
            "legal_person": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
            "legal_id_card": c.encrypt(f"ID{rng.randint(10000000, 99999999)}"),
            "legal_id_images": json.dumps([
                f"https://cdn.mtrip.test/prod/merchant/id_front_{mid}.jpg",
                f"https://cdn.mtrip.test/prod/merchant/id_back_{mid}.jpg"], ensure_ascii=False),
            "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
            "contact_phone": c.encrypt(phone),
            "contact_phone_index": c.phone_index(normalize_phone(phone)),
            "contact_email": f"merchant{mid}@mtrip.test",
            "address": f"{rng.randint(1, 200)} Rue de {city}, {city}, {country}",
            "longitude": money(lng + rng.uniform(-0.05, 0.05)),
            "latitude": money(lat + rng.uniform(-0.05, 0.05)),
            "commission_rate": money(rng.choice([8.00, 10.00, 12.00, 15.00])),
            "settlement_cycle": rng.choice([7, 14, 30]),
            "status": st,
            "status_version": rng.randint(1, 5),
            "suspended_until": ctx.ago(-30) if st == 4 else None,
            "reactivation_requires_super": 1 if st == 4 else 0,
            "audit_remark": "" if st == 0 else ("资料齐全,审核通过" if st in (1, 3) else
                                                ("资料不符合要求" if st in (2, 6) else "")),
            "audit_by": 101 if st in (1, 2, 3, 6) else None,
            "audit_time": ctx.rand_dt(60) if st in (1, 2, 3, 6) else None,
            "access_code": f"MTRP-{'HOTEL' if mtype == 1 else 'SIGHT'}-{rng.randint(100000, 999999)}",
            "credential_channels": "email,sms",
            "reject_reason_code": rng.randint(1, 5) if st in (2, 6) else 0,
            "two_fa_enabled": 1 if st == 3 and i % 3 == 0 else 0,
            "two_fa_method": "google_authenticator" if (st == 3 and i % 3 == 0) else "",
            "two_fa_status": 1 if (st == 3 and i % 3 == 0) else 0,
            "two_fa_secret_enc": c.encrypt("JBSWY3DPEHPK3PXP") if (st == 3 and i % 3 == 0) else "",
            "access_status": 1 if (st == 3 and i % 3 == 0) else 0,
            "logo": f"https://cdn.mtrip.test/prod/merchant/logo_{mid}.png",
            "cover_image": f"https://cdn.mtrip.test/prod/merchant/cover_{mid}.jpg",
            "last_login_at": ctx.rand_dt(30) if st == 3 else None,
            "remark": f"测试数据 - 状态 {st}",
            "commission_plan": rng.choice(["vip", "premium", "standard"]),
            "created_at": ctx.ago(rng.randint(60, 400)),
            "updated_at": ctx.rand_dt(30),
        }
        merchants.append(rec)
        mid += 1
    f.insert(BIZ_DB, "merchant_info", merchants)
    ctx.merchants = merchants

    enabled = [m for m in merchants if m["status"] == 3]

    # ---- 门店 ----
    f.add("门店")
    stores, sid_no = [], 2001
    for m in merchants:
        if m["status"] in (5,):
            continue
        cnt = rng.randint(1, 3)
        for k in range(cnt):
            city, country, lat, lng = rng.choice(CITY_POOL)
            is_main = 1 if k == 0 else 0
            stores.append({
                "id": sid_no, "site_id": m["site_id"], "merchant_id": m["id"],
                "store_name": f"{m['merchant_short_name']} - {city} {k + 1}号店",
                "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
                "contact_phone": c.encrypt(f"+3361{rng.randint(1000000, 9999999)}"),
                "address": f"{rng.randint(1, 200)} Avenue de {city}",
                "longitude": money(lng + rng.uniform(-0.05, 0.05)),
                "latitude": money(lat + rng.uniform(-0.05, 0.05)),
                "business_license": f"https://cdn.mtrip.test/prod/store/license_{sid_no}.jpg",
                "business_hours": "08:00-22:00", "images": None,
                "is_main": is_main, "status": 1 if m["status"] == 3 else 2,
                "business_type": "hotel" if m["merchant_type"] == 1 else "attraction",
                "country_code": country, "city_key": city.lower(),
                "display_enabled": 1 if m["status"] == 3 else 0,
                "mapping_version": 1,
                "remark": "测试数据",
                "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
            })
            sid_no += 1
    f.insert(BIZ_DB, "merchant_store", stores)
    ctx.stores = stores

    # ---- 结算账户 ----
    f.add("商户结算账户")
    accounts, acc_id = [], 3001
    for m in merchants:
        for k in range(rng.randint(1, 2)):
            accounts.append({
                "id": acc_id, "site_id": m["site_id"], "merchant_id": m["id"],
                "bank_name": rng.choice(BANKS),
                "account_name": m["merchant_name"],
                "account_no": c.encrypt(f"FR76{rng.randint(100000000000, 999999999999)}"),
                "swift_code": rng.choice(["BNPAFRPP", "SOGEFRPP", "AGRIFRPP"]),
                "currency": "EUR", "is_default": 1 if k == 0 else 0,
                "status": 1, "remark": "测试账户",
                "created_at": m["created_at"], "updated_at": m["created_at"],
            })
            acc_id += 1
    f.insert(BIZ_DB, "merchant_account", accounts)

    # ---- 商户登录账号 ----
    f.add(f"商户登录账号(口令统一 Merchant@123456)")
    madmins, maid = [], 4001
    for m in merchants:
        if m["status"] == 5:
            continue
        username = f"m{m['id']}"
        madmins.append({
            "id": maid, "site_id": m["site_id"], "account_type": 2,
            "merchant_id": m["id"], "group_id": 0, "store_id": 0,
            "username": username, "password": pw,
            "real_name": m["contact_name"],
            "mobile": c.encrypt(f"+3361{rng.randint(1000000, 9999999)}"),
            "is_owner": 1, "role_perms": None,
            "status": 1 if m["status"] == 3 else 2,
            "last_login_at": m["last_login_at"],
            "auth_version": 1, "last_accepted_totp_step": -1,
            "two_fa_status": m["two_fa_status"], "security_fail_count": 0,
            "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
        })
        maid += 1
    f.insert(BIZ_DB, "merchant_admin", madmins)

    f.add("商户账号 - 内置角色关联(角色 1/2/3 来自 seed/04)")
    f.insert(BIZ_DB, "merchant_admin_role", [
        {"admin_id": a["id"], "role_id": 2} for a in madmins
    ], clean="admin_id >= 4001")

    # ---- 商户子账号(非主账号,喂 merchant-web StaffScreen)----
    # 给前若干家启用商户各建 1 个运营 + 1 个客服子账号(is_owner=0),
    # 角色用 seed/06 的内置预设(merchant_ops / merchant_cs),按 role_code 动态解析,
    # 不能硬编码角色 ID(存量库自增可能串号)。
    f.add("商户子账号(is_owner=0,喂 StaffScreen;口令 Merchant@123456)")
    subs, sub_id = [], 4501
    sub_role_links: list[tuple[int, str]] = []  # (admin_id, role_code)
    for m in enabled[:ctx.n(4)]:
        for suffix, real_role in (("ops", "merchant_ops"), ("cs", "merchant_cs")):
            subs.append({
                "id": sub_id, "site_id": m["site_id"], "account_type": 2,
                "merchant_id": m["id"], "group_id": 0, "store_id": 0,
                "username": f"m{m['id']}_{suffix}", "password": pw,
                "real_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
                "mobile": c.encrypt(f"+3361{rng.randint(1000000, 9999999)}"),
                "is_owner": 0, "role_perms": None,
                "status": 1, "last_login_at": ctx.rand_dt(20),
                "auth_version": 1, "last_accepted_totp_step": -1,
                "two_fa_status": 0, "security_fail_count": 0,
                "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
            })
            sub_role_links.append((sub_id, real_role))
            sub_id += 1
    f.insert(BIZ_DB, "merchant_admin", subs)
    if sub_role_links:
        f.add("子账号 - 内置预设角色关联(按 role_code 解析,依赖 seed/06)")
        for aid, role_code in sub_role_links:
            f.parts.append(
                f"INSERT IGNORE INTO `merchant_admin_role` (`admin_id`, `role_id`)\n"
                f"SELECT {aid}, `r`.`id` FROM `merchant_role` `r` "
                f"WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = '{role_code}' LIMIT 1;\n"
            )

    # ---- 入驻申请:覆盖 stage 1~6 ----
    f.add("入驻申请(覆盖 1新线索 ~ 6已驳回 全部阶段)")
    apps, app_id = [], ID_BASE
    stage_plan = ([1] * ctx.n(3) + [2] * ctx.n(3) + [3] * 3 + [4] * 3 + [5] * 3 + [6] * 3)
    for i, stage in enumerate(stage_plan):
        city, country, _lat, _lng = rng.choice(CITY_POOL)
        bt = rng.choice(["hotel", "restaurant", "attraction", "car_rental"])
        reg = f"RCS-{rng.randint(100000, 999999)}-{i:03d}"
        ops = rng.choice(ctx.admin_ids)
        submitted = ctx.rand_dt(120, 5) if stage >= 3 else None
        app_merchant = merchants[app_id - ID_BASE] if stage == 5 else None
        app = {
            "id": app_id, "site_id": MAIN_SITE if i % 3 else rng.choice([1, 3]),
            "app_no": f"APP-2026{app_id:05d}",
            "merchant_code": app_merchant["merchant_code"] if app_merchant else f"MCH-{app_id + 4000:04d}",
            "merchant_id": app_merchant["id"] if app_merchant else 0,
            "company_name": f"{city} {rng.choice(['Hospitality', 'Travel', 'Resorts', 'Group'])} SARL",
            "merchant_name": f"{city} {rng.choice(['Grand', 'Central', 'Premium', 'Garden'])} Hotel",
            "company_group_name": rng.choice([g["name"] for g in ctx.groups]) if i % 3 == 0 else "",
            "reg_number": reg,
            # active_reg_number 是 GENERATED STORED 列,不能显式插入
            "country": country, "city": city,
            "address": f"{rng.randint(1, 200)} Rue de {city}",
            "business_types": bt if i % 4 else f"hotel,{bt}",
            "num_businesses": rng.randint(1, 5),
            "stage": stage,
            "assigned_ops_id": ops if stage >= 2 else 0,
            "assigned_ops_name": next(a[3] for a in zip([], [])) if False else (
                {101: "站点管理员", 102: "运营专员", 103: "财务专员",
                 104: "客服专员", 105: "只读审计员"}.get(ops, "") if stage >= 2 else ""),
            "operator_type": rng.choice(["single_unit", "chain", "franchise", "independent", "mixed"]),
            "expected_launch_date": (ctx.now + timedelta(days=rng.randint(10, 90))).date()
            if stage in (3, 4) else None,
            "operations_notes": "商户配合度高,优先处理" if stage >= 2 else "",
            "kyc_scope": 1 if i % 4 else 2,
            "kyc_template_id": rng.randint(1, 9) if stage >= 3 else 0,
            "submission_method": rng.randint(1, 2),
            "confirmation_status": 1 if stage >= 3 else 0,
            "confirmed_at": submitted,
            "reject_reason_code": rng.randint(1, 5) if stage == 6 else 0,
            "reject_note": REJECT_REASONS[rng.randint(0, len(REJECT_REASONS) - 1)] if stage == 6 else "",
            "rejected_doc_ids": json.dumps([1001, 1002]) if stage == 6 else None,
            "submitted_at": submitted,
            "last_updated_at": ctx.rand_dt(60, 1),
            "created_at": ctx.ago(rng.randint(30, 200)),
            "updated_at": ctx.rand_dt(20),
        }
        if app_merchant:
            app["site_id"] = app_merchant["site_id"]
        apps.append(app)
        app_id += 1
    f.insert(BIZ_DB, "merchant_application", apps)
    ctx.applications = apps

    f.add("入驻申请 - 注册业务单元")
    abiz, abid = [], 2001
    for a in apps:
        for k in range(a["num_businesses"]):
            bt = a["business_types"].split(",")[k % len(a["business_types"].split(","))]
            kyc_status = {1: 0, 2: 0, 3: 2, 4: 3, 5: 1, 6: 4}[a["stage"]]
            phone = f"+3361{rng.randint(1000000, 9999999)}"
            abiz.append({
                "id": abid, "site_id": a["site_id"], "application_id": a["id"],
                "business_name": f"{a['merchant_name']} - 单元{k + 1}",
                "business_type": bt,
                "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
                "contact_phone": c.encrypt(phone),
                "contact_phone_index": c.phone_index(normalize_phone(phone)),
                "contact_email": f"biz{abid}@mtrip.test",
                "city": a["city"], "kyc_scope": a["kyc_scope"],
                "kyc_template_id": a["kyc_template_id"],
                "kyc_status": kyc_status,
                "kyc_submitted_at": a["submitted_at"] if kyc_status in (2, 3) else None,
                "kyc_submitted_by": a["assigned_ops_id"] if kyc_status in (2, 3) else 0,
                "created_at": a["created_at"], "updated_at": a["updated_at"],
            })
            abid += 1
    f.insert(BIZ_DB, "merchant_application_business", abiz)

    f.add("入驻申请 - 内部备注")
    f.insert(BIZ_DB, "merchant_application_note", [
        {"id": 3001 + i, "site_id": a["site_id"], "application_id": a["id"],
         "note": rng.choice(["已电话联系,对方确认下周提交材料",
                             "补充材料已收到,等待法务复核",
                             "商户希望加快审核进度",
                             "需补充银行开户证明"]),
         "author_id": a["assigned_ops_id"] or 101, "author_name": "运营专员",
         "created_at": ctx.rand_dt(60, 1)}
        for i, a in enumerate(apps) if a["stage"] >= 2
    ])

    # ---- 资质文档 ----
    f.add("商户资质文档(覆盖 1核验通过 2待审 3已驳回 4已过期 5需重交)")
    docs, doc_id = [], ID_BASE
    doc_status_plan = [1, 1, 2, 2, 2, 3, 4, 5]
    for m in merchants:
        for k, st in enumerate(doc_status_plan[:rng.randint(3, 6)]):
            dtype = DOC_TYPES[k % len(DOC_TYPES)]
            docs.append({
                "id": doc_id, "site_id": m["site_id"], "merchant_id": m["id"],
                "application_id": 0, "biz_unit": f"unit-{k + 1}",
                "doc_type": dtype,
                "name": {"business_license": "营业执照", "operating_license": "经营许可证",
                         "owner_id": "法人身份证", "bank_cert": "银行开户证明",
                         "tax_cert": "税务登记证", "business_reg": "公司注册证书",
                         "hotel_license": "酒店经营许可证", "id_doc": "身份证件",
                         "bank_letter": "银行证明函", "premises_lease": "场所租赁合同"}[dtype],
                "file_url": f"https://cdn.mtrip.test/prod/merchant/doc_{doc_id}.pdf",
                "file_size": f"{rng.randint(200, 4000)}KB",
                "status": st,
                "expiry_date": (ctx.now + timedelta(days=rng.choice([-40, -10, 25, 200]))).date(),
                "last_verified_at": ctx.rand_dt(90) if st in (1, 3) else None,
                "reviewer_id": 101 if st in (1, 3) else 0,
                "reviewer_name": "站点管理员" if st in (1, 3) else "",
                "reject_reason": REJECT_REASONS[rng.randint(0, 4)] if st in (3, 5) else "",
                "revision_count": rng.randint(0, 3) if st in (3, 5) else 0,
                "document_version": rng.randint(1, 3),
                "remark": "测试数据",
                "uploaded_at": ctx.rand_dt(120, 10),
                "created_at": ctx.rand_dt(120, 10), "updated_at": ctx.rand_dt(30),
            })
            doc_id += 1
    f.insert(BIZ_DB, "merchant_verify_document", docs)

    f.add("资质文档 - 重交版本历史")
    f.insert(BIZ_DB, "merchant_verify_document_revision", [
        {"id": 1001 + i, "site_id": d["site_id"], "doc_id": d["id"],
         "merchant_id": d["merchant_id"], "version": 1,
         "file_url": d["file_url"], "file_size": d["file_size"],
         "status": d["status"] if d["status"] in (1, 2, 3) else 2,
         "reject_reason": d["reject_reason"], "reviewer_name": d["reviewer_name"],
         "lifecycle_version": d["document_version"], "file_sha256": None, "source": "legacy",
         "uploader_id": d["merchant_id"], "expiry_date": d["expiry_date"],
         "file_name": f"{d['name']}.pdf",
         "uploaded_at": d["uploaded_at"], "created_at": d["created_at"]}
        for i, d in enumerate(docs) if d["status"] in (3, 5)
    ])

    f.add("资质文档 - 事件流水")
    f.insert(BIZ_DB, "merchant_document_event", [
        {"id": 1001 + i, "site_id": d["site_id"], "merchant_id": d["merchant_id"],
         "doc_id": d["id"], "version": d["document_version"],
         "action": {1: "verified", 2: "uploaded", 3: "rejected", 4: "expired", 5: "resubmit_required"}[d["status"]],
         "status": d["status"], "reason": d["reject_reason"],
         "actor_type": "admin", "actor_id": 101, "actor_name": "站点管理员",
         "created_at": d["created_at"]}
        for i, d in enumerate(docs)
    ])

    # ---- 审核时间线 ----
    f.add("商户审核时间线")
    tl, tlid = [], ID_BASE
    for a in apps:
        events = ["submitted"]
        if a["stage"] >= 2:
            events.append("assigned")
        if a["stage"] >= 3:
            events.append("kyc_sent")
        if a["stage"] >= 4:
            events.append("doc_verified")
        if a["stage"] == 5:
            events.append("approved")
        if a["stage"] == 6:
            events.append("rejected")
        for ev in events:
            tl.append({
                "id": tlid, "site_id": a["site_id"], "merchant_id": a["merchant_id"],
                "application_id": a["id"], "action": ev,
                "actor_type": 2 if ev in ("assigned", "doc_verified", "approved", "rejected") else 3,
                "operator_id": a["assigned_ops_id"] or 0,
                "operator_name": a["assigned_ops_name"] or "",
                "note": f"阶段流转:{ev}", "is_exception": 1 if ev == "rejected" else 0,
                "created_at": a["updated_at"],
            })
            tlid += 1
    f.insert(BIZ_DB, "merchant_verify_timeline", tl)

    # ---- 黑名单 ----
    f.add("商户黑名单(与 merchant_info.status=4 配对)")
    suspended = [m for m in merchants if m["status"] == 4][:2]
    f.insert(BIZ_DB, "merchant_blacklist", [
        {"id": ID_BASE + i, "site_id": m["site_id"], "merchant_id": m["id"],
         "reason": rng.choice(["多次到店无房投诉", "资质造假", "恶意刷单"]),
         "evidence": "https://cdn.mtrip.test/prod/evidence/evi_001.pdf",
         "operator_id": 101, "operator_name": "站点管理员", "status": 1,
         "removed_at": None, "removed_by": 0,
         "created_at": ctx.rand_dt(60), "updated_at": ctx.rand_dt(10)}
        # active_merchant_id 是 GENERATED STORED 列,不能显式插入
        for i, m in enumerate(suspended)
    ])

    # ---- 状态历史 ----
    f.add("商户状态历史")
    f.insert(BIZ_DB, "merchant_status_history", [
        {"site_id": m["site_id"], "merchant_id": m["id"],
         "action": "activate" if m["status"] == 3 else "suspend",
         "from_status": "pending" if m["status"] == 3 else "active",
         "to_status": "active" if m["status"] == 3 else "suspended",
         "note": "测试数据状态流转", "evidence": "",
         "suspended_until": m["suspended_until"],
         "from_version": 1, "to_version": m["status_version"],
         "actor_type": "admin", "actor_id": 101, "actor_name": "站点管理员",
         "ip_address": "10.0.0.1", "request_id": f"req-{m['id']}",
         "request_hash": hashlib.sha256(f"req-{m['id']}".encode()).hexdigest(),
         "result_json": json.dumps({"ok": True}, ensure_ascii=False),
         "created_at": m["updated_at"]}
        for m in merchants if m["status"] in (3, 4)
    ], clean=f"merchant_id >= {ID_BASE}")

    # ---- 活动日志 ----
    f.add("商户活动日志")
    activity, alid = [], ID_BASE
    for m in merchants:
        for _ in range(rng.randint(1, 3)):
            at = rng.choice(["login", "profile_update", "document_upload", "verification",
                             "booking", "warning", "impersonation"])
            activity.append({
                "id": alid, "site_id": m["site_id"], "merchant_id": m["id"],
                "activity_type": at,
                "description": {"login": "商户登录后台", "profile_update": "更新商户资料",
                                "document_upload": "上传资质文件", "verification": "资质审核状态变更",
                                "booking": "新增订单", "warning": "收到平台警告",
                                "impersonation": "平台代入会话"}[at],
                "performed_by": m["contact_name"], "performed_by_id": m["id"],
                "ip_address": f"{rng.randint(1, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
                "status": rng.choices([1, 2, 3], weights=[90, 6, 4])[0],
                "actor_type": "merchant", "target_account_id": None,
                "entity_type": "merchant", "entity_id": m["id"],
                "created_at": ctx.rand_dt(45),
            })
            alid += 1
    f.insert(BIZ_DB, "merchant_activity_log", activity)

    # ---- 通知 ----
    f.add("商户通知")
    notifies, nid = [], ID_BASE
    cats = [("booking", "新订单提醒", "您有一笔新的酒店订单,请及时处理。", "booking_detail"),
            ("promotion", "促销审核通过", "您的促销活动已通过审核并上线。", "promotion"),
            ("refund", "退款已处理", "一笔订单退款已完成处理。", "wallet"),
            ("system", "系统维护通知", "平台将于本周日凌晨进行例行维护。", "none"),
            ("security", "安全提醒", "检测到异地登录,如非本人操作请及时修改密码。", "user_profile")]
    for m in merchants[:ctx.n(10)]:
        for k in range(rng.randint(1, 3)):
            cat, title, msg, link = cats[rng.randint(0, len(cats) - 1)]
            read = rng.random() < 0.4
            notifies.append({
                "id": nid, "site_id": m["site_id"], "merchant_id": m["id"],
                "category": cat, "title": title, "message": msg,
                "deep_link_type": link, "deep_link_value": "",
                "channels": "inapp,email", "send_type": 1, "send_at": None,
                "status": 1, "read_at": ctx.rand_dt(10) if read else None,
                "read_by": m["id"] if read else 0,
                "operator_id": 101, "operator_name": "站点管理员",
                "request_id": f"ntf-{nid}",
                "payload_hash": hashlib.sha256(f"ntf-{nid}".encode()).hexdigest(),
                "template_id": None, "delivered_at": ctx.rand_dt(15),
                "created_at": ctx.rand_dt(20), "updated_at": ctx.rand_dt(5),
            })
            nid += 1
    f.insert(BIZ_DB, "merchant_notify", notifies)

    f.add("通知 - 已读(按账号)")
    f.insert(BIZ_DB, "merchant_notify_read", [
        {"notify_id": n["id"], "account_id": n["read_by"], "read_at": n["read_at"]}
        for n in notifies if n["read_at"] and n["read_by"]
    ], clean=f"notify_id >= {ID_BASE}")

    f.add("通知 - 下发记录")
    f.insert(BIZ_DB, "merchant_notify_delivery", [
        {"notify_id": n["id"], "channel": ch, "status": "delivered", "attempts": 1,
         "error_code": "", "scheduled_at": None, "delivered_at": n["delivered_at"],
         "receipt": f"rcpt-{n['id']}"}
        for n in notifies for ch in ["inapp", "email"]
    ], clean=f"notify_id >= {ID_BASE}")

    # ---- 代入会话 & 访问码日志 ----
    f.add("商户代入会话 + 访问码操作审计")
    f.insert(BIZ_DB, "merchant_impersonation_session", [
        {"id": ID_BASE + i, "site_id": m["site_id"], "merchant_id": m["id"],
         "operator_id": 101, "operator_name": "站点管理员",
         "reason": rng.choice(["technical_support", "booking_investigation", "customer_complaint"]),
         "session_key": hashlib.sha256(f"imp-{m['id']}".encode()).hexdigest(),
         "status": 2, "started_at": ctx.rand_dt(20), "ended_at": ctx.rand_dt(19),
         "target_account_id": m["id"], "auth_version": 1,
         "exchange_hash": f"exh-{m['id']}", "exchange_expires_at": ctx.rand_dt(19),
         "exchanged_at": ctx.rand_dt(20), "expires_at": ctx.rand_dt(19),
         "created_at": ctx.rand_dt(20)}
        for i, m in enumerate(merchants[:ctx.n(4)])
    ])
    f.add("商户访问码操作审计")
    acl_rows = []
    _acl_id = ID_BASE
    for i, m in enumerate(merchants[:ctx.n(8)]):
        for act in (["generate", "resend"] if i % 2 else ["generate"]):
            acl_rows.append({
                "id": _acl_id, "site_id": m["site_id"], "merchant_id": m["id"],
                "action": act, "channels": "email,sms", "operator_id": 101,
                "operator_name": "站点管理员", "created_at": ctx.rand_dt(30)})
            _acl_id += 1
    f.insert(BIZ_DB, "merchant_access_code_log", acl_rows)

    # ---- 市场排名 ----
    f.add("市场排名 - 商家条目(接入真实商户/门店/商品)")
    listings, lid2 = [], ID_BASE
    for i, m in enumerate(merchants[:ctx.n(8)]):
        store = next((s for s in ctx.stores if s["merchant_id"] == m["id"]), None)
        listings.append({
            "id": lid2, "site_id": m["site_id"], "business_type": "hotel",
            "business_id": store["id"] if store else 0,
            "business_name": m["merchant_short_name"],
            "merchant_id": m["id"], "merchant_name": m["merchant_name"],
            "city": ctx.stores[0]["city_key"].capitalize() if store else "Paris",
            "price_from": money(rng.randint(80, 400)),
            "rating": money(rng.uniform(3.5, 5.0)),
            "rank": i + 1, "featured": 1 if i == 0 else 0, "pinned": 0,
            "status": 1, "published_version": 1, "publisher_id": 101,
            "market_id": None, "property_id": store["id"] if store else None,
            "goods_id": None,
            "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10),
        })
        lid2 += 1
    f.insert(BIZ_DB, "ranking_listing", listings)

    f.add("市场排名 - 热门目的地 + 操作审计")
    dests = [
        ("Paris", "Ile-de-France", "Light City"),
        ("Nice", "Provence", "French Riviera"),
        ("Lyon", "Auvergne", "Gastronomy Capital"),
        ("Bordeaux", "Nouvelle-Aquitaine", "Wine Capital"),
    ]
    f.insert(BIZ_DB, "ranking_destination", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "name": n, "region": r, "tagline": t,
         "image_url": f"https://cdn.mtrip.test/prod/dest/{n.lower()}.jpg",
         "rank": i + 1, "featured": 1 if i == 0 else 0, "status": 1,
         "published_version": 1, "last_updated_by": 101,
         "market_id": None, "country_code": "FR", "city_key": n.lower(),
         "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10)}
        for i, (n, r, t) in enumerate(dests)
    ])
    f.insert(BIZ_DB, "ranking_history", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "entity_type": "listing",
         "entity_id": l["id"], "entity_name": l["business_name"],
         "action": rng.choice(["reorder", "publish", "status_change"]),
         "from_rank": l["rank"], "to_rank": l["rank"], "note": "测试数据初始化",
         "operator_id": 101, "operator_name": "站点管理员",
         "market_id": None, "version": 1, "before_json": None, "after_json": None,
         "created_at": ctx.ago(30)}
        for i, l in enumerate(listings)
    ])
    f.insert(BIZ_DB, "ranking_market", [
        {"id": ID_BASE, "site_id": MAIN_SITE, "entity_type": "listing",
         "business_type": "hotel", "country_code": "FR", "market_key": "paris",
         "version": 1, "published_version": 1,
         "published_json": json.dumps([{"id": l["id"], "rank": l["rank"]} for l in listings],
                                      ensure_ascii=False),
         "updated_by": "站点管理员", "published_by": "站点管理员",
         "published_at": ctx.ago(30), "updated_at": ctx.ago(30)},
    ])


def build_goods(ctx: Ctx, f: SqlFile) -> None:
    """商品域:分类、商品、房型、票种、库存日历、退改规则、评价"""
    rng = ctx.rng

    f.add("商品分类")
    cats = [
        (ID_BASE + 0, 0, "高端酒店", 1), (ID_BASE + 1, 0, "精品酒店", 1),
        (ID_BASE + 2, 0, "经济连锁", 1), (ID_BASE + 3, 0, "主题乐园", 2),
        (ID_BASE + 4, 0, "博物馆/景点", 2),
    ]
    f.insert(BIZ_DB, "goods_category", [
        {"id": cid, "site_id": MAIN_SITE, "parent_id": pid, "category_name": nm,
         "goods_type": gt, "icon": "", "sort": i + 1, "status": 1,
         "created_at": ctx.ago(200), "updated_at": ctx.ago(200)}
        for i, (cid, pid, nm, gt) in enumerate(cats)
    ])

    f.add("商品(酒店 + 门票,覆盖 0~5 全部状态)")
    enabled_merchants = [m for m in ctx.merchants if m["status"] in (1, 3)]
    goods, gid = [], ID_BASE
    # status: 0草稿 1待审核 2审核驳回 3已上架 4已下架 5已删除
    gstatus = [3] * ctx.n(10) + [1] * 3 + [0] * 2 + [2] * 2 + [4] * 2 + [5] * 1
    for i, st in enumerate(gstatus):
        m = enabled_merchants[i % len(enabled_merchants)]
        is_hotel = m["merchant_type"] != 2
        city, country, lat, lng = rng.choice(CITY_POOL)
        goods.append({
            "id": gid, "site_id": m["site_id"], "merchant_id": m["id"], "supplier_id": 0,
            "goods_type": 1 if is_hotel else 2,
            "category_id": rng.choice(cats)[0],
            "goods_name": f"{m['merchant_short_name']} - {rng.choice(['豪华大床房', '行政套房', '标准双床房', '家庭房', '亲子套房'])}"
            if is_hotel else f"{m['merchant_short_name']} - {rng.choice(['成人票', '儿童票', '家庭套票', '快速通道票'])}",
            "goods_brief": f"{city} 中心位置,交通便利,设施完善。",
            "goods_detail": f"<p>{m['merchant_short_name']} 位于 {city} 市中心,提供优质服务。</p>",
            "cover_image": f"https://cdn.mtrip.test/prod/goods/cover_{gid}.jpg",
            "images": json.dumps([f"https://cdn.mtrip.test/prod/goods/{gid}_{k}.jpg" for k in range(1, 4)],
                                 ensure_ascii=False),
            "address": m["address"], "longitude": m["longitude"], "latitude": m["latitude"],
            "star_level": rng.randint(3, 5) if is_hotel else 0,
            "facilities": json.dumps(["wifi", "parking", "pool", "gym"][:rng.randint(1, 4)]),
            "open_time": "00:00" if is_hotel else "09:00",
            "close_time": "23:59" if is_hotel else "18:00",
            "status": st,
            "audit_remark": "" if st in (0, 1) else ("审核通过" if st == 3 else "图片不符合规范"),
            "audit_by": 101 if st in (2, 3) else None,
            "audit_time": ctx.rand_dt(60) if st in (2, 3) else None,
            "sort_weight": rng.randint(1, 100),
            "is_recommend": 1 if i % 4 == 0 else 0,
            "is_hot": 1 if i % 5 == 0 else 0,
            "sales_count": rng.randint(0, 800),
            "created_at": ctx.ago(rng.randint(30, 200)), "updated_at": ctx.rand_dt(20),
        })
        gid += 1
    f.insert(BIZ_DB, "goods_info", goods)
    ctx.goods = goods

    f.add("酒店房型")
    rooms, rid = [], ID_BASE
    for g in [x for x in goods if x["goods_type"] == 1][:ctx.n(8)]:
        for k in range(rng.randint(2, 3)):
            base = money(rng.choice([89, 129, 189, 259, 399, 599]))
            rooms.append({
                "id": rid, "site_id": g["site_id"], "goods_id": g["id"],
                "room_name": rng.choice(["豪华大床房", "行政套房", "标准双床房", "家庭房"]),
                "room_code": f"RM{g['id']}{k}",
                "description": "宽敞舒适,含免费 WiFi。",
                "bed_type": rng.choice(["1张大床", "2张单人床", "1张大床+1张沙发床"]),
                "bed_count": rng.randint(1, 2), "area": f"{rng.randint(22, 80)}㎡",
                "max_adults": rng.randint(2, 4), "max_children": rng.randint(0, 2),
                "max_guests": rng.randint(2, 5), "floor_name": f"{rng.randint(3, 18)}F",
                "room_view": rng.choice(["城市景观", "河景", "花园景"]),
                "smoking": 0, "breakfast": rng.randint(0, 2),
                "meal_plan": rng.choice(["", "含双早", "含午餐"]),
                "cancellation_policy": "入住前 24 小时可免费取消",
                "checkin_notes": "请携带有效证件办理入住",
                "base_price": base, "base_price_citizen": money(base * Decimal("0.8")),
                "weekend_price": money(base * Decimal("1.25")),
                "extra_bed_price": money(35),
                "base_stock": rng.randint(5, 40), "launch_stock": rng.randint(3, 30),
                "images": None, "video_url": "",
                "facilities": json.dumps(["wifi", "tv", "minibar", "safe"]),
                "status": 1 if rng.random() < 0.85 else 2,
                "publish_status": rng.choice([2, 2, 2, 1, 0, 3]),
                "submitted_at": ctx.rand_dt(60), "sort": k + 1,
                "created_at": g["created_at"], "updated_at": ctx.rand_dt(20),
            })
            rid += 1
    f.insert(BIZ_DB, "hotel_room_type", rooms)
    ctx.room_types = rooms

    f.add("门票票种")
    tickets, tid = [], ID_BASE
    for g in [x for x in goods if x["goods_type"] == 2][:ctx.n(3)]:
        for k in range(rng.randint(1, 2)):
            base = money(rng.choice([18, 25, 38, 55]))
            tickets.append({
                "id": tid, "site_id": g["site_id"], "goods_id": g["id"],
                "ticket_name": rng.choice(["成人票", "儿童票", "家庭套票", "快速通道票"]),
                "ticket_kind": rng.randint(1, 3),
                "base_price": base, "base_stock": rng.randint(50, 500),
                "time_slots": json.dumps([{"start": "09:00", "end": "12:00"},
                                          {"start": "13:00", "end": "17:00"}], ensure_ascii=False)
                if k == 0 else None,
                "valid_days": 1, "book_limit": 0, "advance_hours": rng.choice([0, 2, 24]),
                "verify_times": 1, "status": 1, "sort": k + 1,
                "created_at": g["created_at"], "updated_at": ctx.rand_dt(20),
            })
            tid += 1
    f.insert(BIZ_DB, "ticket_type", tickets)
    ctx.ticket_types = tickets

    f.add("库存价格日历(未来 30 天)")
    stock, stid = [], STOCK_ID_BASE
    skus = [(1, r["id"], r["base_price"], r["base_stock"]) for r in rooms[:12]] + \
           [(2, t["id"], t["base_price"], t["base_stock"]) for t in tickets[:4]]
    for sku_type, sku_id, price, total in skus:
        base_date = ctx.now.date()
        for d in range(30):
            day = base_date + timedelta(days=d)
            weekend = day.weekday() >= 5
            p = money(price * (Decimal("1.25") if weekend else Decimal("1")))
            sold = rng.randint(0, max(1, total // 3))
            stock.append({
                "id": stid, "site_id": MAIN_SITE, "goods_id": 0,
                "sku_type": sku_type, "sku_id": sku_id, "stock_date": day,
                "price": p, "price_citizen": money(p * Decimal("0.8")),
                "stock_total": total, "stock_sold": sold, "stock_locked": rng.randint(0, 2),
                "is_closed": 1 if (d % 17 == 0) else 0,
                "min_stay": 1, "max_stay": 30,
                "closed_to_arrival": 0, "closed_to_departure": 0,
                "source": "manual", "note": "",
                "created_at": ctx.ago(5), "updated_at": ctx.ago(1),
            })
            stid += 1
    f.insert(BIZ_DB, "goods_daily_stock", stock)

    f.add("退改规则")
    f.insert(BIZ_DB, "goods_refund_rule", [
        {"id": ID_BASE + i, "site_id": g["site_id"], "goods_id": g["id"],
         "sku_type": 0, "sku_id": 0, "rule_type": rng.choice([1, 2, 2, 3]),
         "rules": json.dumps([{"hours_before": 24, "refund_rate": 100},
                              {"hours_before": 2, "refund_rate": 50}], ensure_ascii=False),
         "remark": "测试数据", "created_at": g["created_at"], "updated_at": g["updated_at"]}
        for i, g in enumerate(goods)
    ])

    f.add("库存变动流水")
    f.insert(BIZ_DB, "goods_stock_log", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "goods_id": 0,
         "sku_type": 1, "sku_id": s["sku_id"], "stock_date": s["stock_date"],
         "change_type": rng.choice([1, 2, 3, 4, 5]), "change_qty": rng.randint(1, 3),
         "order_id": 0, "operator_id": 101, "remark": "测试数据",
         "created_at": ctx.rand_dt(30)}
        for i, s in enumerate(rng.sample(stock, min(ctx.n(40), len(stock))))
    ])

    f.add("商品评价(覆盖 0待审 1显示 2隐藏 与商户标记)")


def build_user(ctx: Ctx, f: SqlFile) -> None:
    """用户域:C 端用户、会员等级、余额/积分流水、反馈、风控、会话、黑名单"""
    rng, c = ctx.rng, ctx.c

    f.add("会员等级")
    levels = [
        (ID_BASE + 0, "普通会员", 1, 0, 100.00),
        (ID_BASE + 1, "银卡会员", 2, 1000, 98.00),
        (ID_BASE + 2, "金卡会员", 3, 5000, 95.00),
        (ID_BASE + 3, "铂金会员", 4, 20000, 92.00),
    ]
    f.insert(BIZ_DB, "user_member_level", [
        {"id": lid, "site_id": 0, "level_name": nm, "level_order": order,
         "upgrade_amount": money(amt), "discount_rate": money(disc),
         "benefits": json.dumps(["生日礼券", "免费取消", "专属客服"][:order], ensure_ascii=False),
         "icon": "", "status": 1, "created_at": ctx.ago(200), "updated_at": ctx.ago(200)}
        for lid, nm, order, amt, disc in levels
    ])

    f.add("C 端用户(覆盖 1正常 2冻结 3注销 4拉黑)")
    users, uid = [], ID_BASE
    # 每个手机号必须唯一 -> mobile_hash 唯一
    used_mobiles: set[str] = set()
    for i in range(ctx.n(40)):
        while True:
            mobile = f"+3362{rng.randint(1000000, 9999999)}"
            if mobile not in used_mobiles:
                used_mobiles.add(mobile)
                break
        status = rng.choices([1, 1, 1, 1, 1, 1, 2, 3, 4], weights=[60, 5, 5, 5, 5, 5, 8, 4, 4])[0]
        reg = ctx.ago(rng.randint(20, 400))
        if i == 0:
            ctx.verify_samples[("mtrip_business", "user_info", uid, "mobile_hash")] = mobile
        users.append({
            "id": uid, "site_id": rng.choice(SITE_IDS),
            "nickname": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)[:1]}.",
            "avatar": f"https://cdn.mtrip.test/prod/avatar/{uid}.png",
            "mobile": c.encrypt(mobile),
            "mobile_hash": c.mobile_hash(mobile),
            "email": c.encrypt(f"user{uid}@mtrip.test"),
            "password": bcrypt_hash("User@123456"),
            "register_source": rng.randint(1, 4),
            "register_time": reg,
            "last_login_at": ctx.rand_dt(30) if status == 1 else None,
            "last_login_ip": f"{rng.randint(1, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
            "member_level_id": rng.choice(levels)[0],
            "member_expire_time": ctx.ago(-180),
            "balance": money(rng.choice([0, 0, 25, 120, 480, 1500])),
            "points": rng.randint(0, 8000),
            "real_name_status": rng.choices([0, 1, 2], weights=[50, 45, 5])[0],
            "real_name": c.encrypt(f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}"),
            "id_card": c.encrypt(f"ID{rng.randint(10000000, 99999999)}"),
            "user_status": status,
            "tags": json.dumps(rng.sample(["高频用户", "价格敏感", "商旅", "家庭出行", "新客"],
                                          rng.randint(1, 2)), ensure_ascii=False),
            "remark": "测试数据",
            "referral_code": f"REF{uid:06d}",
            "created_at": reg, "updated_at": ctx.rand_dt(20),
        })
        uid += 1
    f.insert(BIZ_DB, "user_info", users)
    ctx.users = users

    f.add("常旅客")
    f.insert(BIZ_DB, "user_traveler", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "nationality": rng.choice(["FR", "CN", "US", "GB", "DE"]),
         "first_name": rng.choice(FIRST_NAME), "last_name": rng.choice(LAST_NAME),
         "id_type": rng.choice([1, 2, 3]),
         "id_no": c.encrypt(f"P{rng.randint(1000000, 9999999)}"),
         "id_expire_date": (ctx.now + timedelta(days=rng.randint(200, 2000))).date(),
         "is_default": 1 if i == 0 else 0,
         "created_at": u["created_at"], "updated_at": u["updated_at"]}
        for i, u in enumerate(users[:ctx.n(15)])
    ])

    f.add("余额流水 / 积分流水")
    f.insert(BIZ_DB, "user_balance_log", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "change_type": ct,
         "amount": money(amt if ct in (1, 3) else -amt),
         "before_balance": money(before), "after_balance": money(
             before + (amt if ct in (1, 3) else -amt)),
         "order_id": 0, "operator_id": 101 if ct in (4, 5) else 0,
         "remark": {1: "在线充值", 2: "订单消费", 3: "订单退款", 4: "平台调账", 5: "用户提现"}[ct],
         "created_at": ctx.rand_dt(60)}
        for i, u in enumerate(users[:ctx.n(20)])
        for ct, amt, before in [(rng.choice([1, 2, 3, 4, 5]),
                                 money(rng.randint(10, 500)), money(rng.randint(0, 2000)))]
    ])
    f.insert(BIZ_DB, "user_points_log", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "change_type": rng.choice([1, 2, 3, 4, 5]),
         "points": rng.randint(-500, 1000), "after_points": u["points"],
         "order_id": 0, "remark": "测试数据", "created_at": ctx.rand_dt(60)}
        for i, u in enumerate(users[:ctx.n(20)])
    ])

    f.add("用户反馈与投诉(覆盖 0~3 全部状态)")
    f.insert(BIZ_DB, "user_feedback", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "feedback_type": rng.randint(1, 4),
         "content": FEEDBACK_POOL[rng.randint(0, len(FEEDBACK_POOL) - 1)],
         "images": None, "order_id": 0, "status": st,
         "reply_content": "已收到您的反馈,我们会尽快处理。" if st in (1, 2) else "",
         "handler_id": 104 if st in (1, 2) else 0,
         "handled_at": ctx.rand_dt(20) if st in (2, 3) else None,
         "created_at": ctx.rand_dt(60), "updated_at": ctx.rand_dt(10)}
        for i, (u, st) in enumerate(
            [(u, rng.choice([0, 1, 2, 3])) for u in users[:ctx.n(12)]])
    ])

    f.add("用户操作日志")
    f.insert(BIZ_DB, "user_action_log", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "action_type": rng.randint(1, 5),
         "content": "测试数据", "client_ip": f"10.1.{rng.randint(0, 9)}.{rng.randint(1, 254)}",
         "device_info": rng.choice(["Pixel 8", "iPhone 15", "H5"]),
         "created_at": ctx.rand_dt(45)}
        for i, u in enumerate(users[:ctx.n(30)])
    ])

    f.add("收藏 / 推荐返利 / 站内通知")
    f.insert(BIZ_DB, "user_favorite", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "goods_id": g["id"], "created_at": ctx.rand_dt(60)}
        for i, (u, g) in enumerate(zip(users[:ctx.n(10)],
                                       [ctx.goods[i % len(ctx.goods)] for i in range(ctx.n(10))]))
        if ctx.goods
    ])
    f.insert(BIZ_DB, "user_referral", [
        {"id": ID_BASE + i, "site_id": users[i]["site_id"],
         "inviter_user_id": users[i]["id"],
         "invitee_user_id": users[i + 1]["id"],
         "reward_status": rng.randint(0, 2),
         "reward_amount": money(rng.choice([0, 10, 20])),
         "reward_order_id": 0,
         "bind_time": ctx.rand_dt(90),
         "reward_time": ctx.rand_dt(30) if rng.random() < 0.5 else None,
         "created_at": ctx.rand_dt(90), "updated_at": ctx.rand_dt(30)}
        for i in range(min(ctx.n(8), len(users) - 1))
    ])
    f.insert(BIZ_DB, "notify_record", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "event_key": rng.choice(["booking_confirmed", "booking_cancelled", "review_request"]),
         "title": rng.choice(["订单已确认", "订单已取消", "期待您的评价"]),
         "content": "测试数据通知内容",
         "biz_type": rng.randint(1, 3), "biz_id": 0,
         "is_read": 1 if rng.random() < 0.5 else 0,
         "read_at": ctx.rand_dt(10) if rng.random() < 0.5 else None,
         "created_at": ctx.rand_dt(30)}
        for i, u in enumerate(users[:ctx.n(20)])
    ])

    f.add("风控态 / 申诉 / 黑名单")
    f.insert(BIZ_DB, "user_fraud", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "fraud_score": score, "level": (0 if score < 30 else 1 if score < 60 else 2 if score < 85 else 3),
         "last_reason": "异常下单行为" if score >= 60 else "",
         "last_eval_at": ctx.rand_dt(15),
         "created_at": u["created_at"], "updated_at": ctx.rand_dt(15)}
        for i, u in enumerate(users[:ctx.n(15)])
        for score in [rng.randint(0, 95)]
    ])
    f.insert(BIZ_DB, "user_appeal", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "content": "我的账号被误判为风险用户,请求复核。",
         "attachments": None, "status": st,
         "handler_id": 104 if st in (1, 2, 3) else 0,
         "handle_remark": "复核后解除限制" if st == 1 else "",
         "handled_at": ctx.rand_dt(10) if st in (1, 2, 3) else None,
         "created_at": ctx.rand_dt(30), "updated_at": ctx.rand_dt(5)}
        for i, (u, st) in enumerate(
            [(u, rng.choice([0, 1, 2, 3])) for u in users[:ctx.n(8)]])
    ])
    blacklisted = [u for u in users if u["user_status"] == 4]
    f.insert(BIZ_DB, "user_blacklist", [
        {"id": ID_BASE + i, "site_id": u["site_id"], "user_id": u["id"],
         "reason": rng.choice(["恶意退款", "虚假下单", "辱骂客服"]),
         "evidence": "", "operator_id": 104, "operator_name": "客服专员",
         "status": 1, "removed_at": None, "removed_by": 0,
         "created_at": ctx.rand_dt(30), "updated_at": ctx.rand_dt(5)}
        for i, u in enumerate(blacklisted)
    ])

    f.add("客服会话与消息")
    convs, cid = [], ID_BASE
    for u in users[:ctx.n(8)]:
        convs.append({
            "id": cid, "site_id": u["site_id"], "user_id": u["id"],
            "type": rng.choice([1, 2]), "target_id": 0,
            "title": "订单咨询", "status": rng.choice([0, 0, 1]),
            "last_message": "好的,感谢您的帮助!", "last_time": ctx.rand_dt(7),
            "rating": rng.choice([0, 4, 5]),
            "created_at": ctx.rand_dt(20), "updated_at": ctx.rand_dt(7),
        })
        cid += 1
    f.insert(BIZ_DB, "chat_conversation", convs)
    f.add("会话消息(每会话 2~3 条)")
    msg_rows = []
    _msg_id = ID_BASE
    for i, cv in enumerate(convs):
        for st in ([1, 2] if i % 2 else [1, 3, 2]):
            msg_rows.append({
                "id": _msg_id, "site_id": cv["site_id"], "conversation_id": cv["id"],
                "sender_type": st, "content": "你好,我想咨询一下订单退款进度。",
                "msg_type": 1, "created_at": ctx.rand_dt(7)})
            _msg_id += 1
    f.insert(BIZ_DB, "chat_message", msg_rows)


def build_order(ctx: Ctx, f: SqlFile) -> None:
    """订单域:订单、退款单、核销日志、Trip、核销设备与规则"""
    rng, c = ctx.rng, ctx.c

    if not ctx.goods or not ctx.users:
        return

    f.add("核销设备与规则")
    devices, did = [], ID_BASE
    for m in ctx.merchants[:ctx.n(5)]:
        devices.append({
            "id": did, "site_id": m["site_id"], "merchant_id": m["id"],
            "device_name": f"{m['merchant_short_name']}-前台POS-{did}",
            "device_sn": f"SN{did:08d}",
            "device_secret": c.encrypt(f"dev-secret-{did}"),
            "bind_goods": None, "status": 1,
            "online_status": rng.choice([0, 1, 1]),
            "last_heartbeat": ctx.rand_dt(1),
            "remark": "测试设备", "created_at": ctx.ago(90), "updated_at": ctx.rand_dt(1),
        })
        did += 1
    f.insert(BIZ_DB, "verify_device", devices)

    f.insert(BIZ_DB, "verify_rule", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "rule_name": nm,
         "goods_type": gt, "valid_days": vd, "per_user_limit": pl,
         "expire_forbid": 1, "time_range": json.dumps([{"start": "09:00", "end": "21:00"}],
                                                      ensure_ascii=False),
         "status": 1, "remark": "测试数据", "created_at": ctx.ago(90), "updated_at": ctx.ago(90)}
        for i, (nm, gt, vd, pl) in enumerate([
            ("酒店入住核销规则", 1, 1, 1),
            ("门票当日核销规则", 2, 1, 5),
            ("多日票核销规则", 2, 3, 3),
        ])
    ])

    f.add("订单主表(覆盖 0~7 全部订单状态)")
    # order_status: 0待支付 1已支付 2已入住/已核销 3已完成 4已取消 5退款中 6已退款 7已过期
    ostatus_plan = ([1] * ctx.n(15) + [3] * ctx.n(20) + [2] * ctx.n(8) + [0] * ctx.n(6) +
                    [6] * ctx.n(8) + [5] * ctx.n(6) + [4] * ctx.n(6) + [7] * ctx.n(4))
    orders, oid = [], ID_BASE
    for i, st in enumerate(ostatus_plan):
        g = ctx.goods[i % len(ctx.goods)]
        u = ctx.users[i % len(ctx.users)]
        m = next((x for x in ctx.merchants if x["id"] == g["merchant_id"]), ctx.merchants[0])
        is_hotel = g["goods_type"] == 1
        sku_list = ctx.room_types if is_hotel else ctx.ticket_types
        sku = sku_list[i % len(sku_list)] if sku_list else None
        nights = rng.randint(1, 5) if is_hotel else 1
        qty = rng.randint(1, 3)
        unit = money(sku["base_price"] if sku else rng.randint(80, 400))
        original = money(unit * qty * (nights if is_hotel else 1))
        discount = money(original * Decimal(rng.choice(["0", "0", "0.1", "0.15"])))
        total = money(original - discount)
        rate = Decimal(str(m["commission_rate"])) / Decimal("100")
        commission = money(total * rate)
        created = ctx.rand_dt(90, 1)
        use_date = (created + timedelta(days=rng.randint(1, 30))).date()
        end_date = (use_date + timedelta(days=nights)) if is_hotel else use_date
        paid = st in (1, 2, 3, 5, 6)
        phone = f"+3363{rng.randint(1000000, 9999999)}"
        orders.append({
            "id": oid, "order_no": f"NO{created.strftime('%Y%m%d')}{oid:06d}",
            "site_id": g["site_id"], "user_id": u["id"], "trip_id": 0,
            "order_type": 1 if is_hotel else 2, "is_citizen": 1 if rng.random() < 0.3 else 0,
            "merchant_id": m["id"], "supplier_id": 0, "goods_id": g["id"],
            "goods_name": g["goods_name"],
            "goods_image": g["cover_image"],
            "sku_id": sku["id"] if sku else 0,
            "sku_name": (sku["room_name"] if is_hotel and sku else
                         (sku["ticket_name"] if sku else "标准")),
            "quantity": qty, "unit_price": unit, "original_price": original,
            "total_amount": total, "discount_amount": discount,
            "longstay_discount": money(0), "coupon_id": 0, "coupon_discount": money(0),
            "alloc_coupon_discount": money(0), "points_discount": money(0),
            "pay_amount": total, "platform_fee": money(0),
            "platform_commission": commission,
            "merchant_receivable": money(total - commission),
            "supplier_cost": money(0),
            "pay_method": rng.choice([1, 2]) if paid else 0,
            "pay_trade_no": f"pi_{rng.randint(10 ** 15, 10 ** 16 - 1)}" if paid else "",
            "pay_time": created + timedelta(minutes=rng.randint(1, 30)) if paid else None,
            "order_status": st,
            "refund_status": {5: 1, 6: 3}.get(st, 0),
            "use_date": use_date, "end_date": end_date,
            "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
            "contact_phone": c.encrypt(phone),
            "guests": json.dumps([{"firstName": rng.choice(FIRST_NAME),
                                   "lastName": rng.choice(LAST_NAME),
                                   "phone": phone, "email": f"guest{oid}@mtrip.test"}],
                                 ensure_ascii=False),
            "verify_code": f"{rng.randint(100000000000, 999999999999)}",
            "cancel_reason": "用户主动取消" if st in (4, 7) else "",
            "cancel_time": created + timedelta(hours=rng.randint(1, 48)) if st in (4, 7) else None,
            "remark": "测试数据",
            "created_at": created, "updated_at": created + timedelta(hours=rng.randint(1, 24)),
        })
        oid += 1
    f.insert(BIZ_DB, "order_main", orders)
    ctx.orders = orders

    f.add("Trip 主单 + 订单挂接")
    trips, tid = [], ID_BASE
    hotel_orders = [o for o in orders if o["order_type"] == 1][:ctx.n(6)]
    for i in range(0, len(hotel_orders) - 1, 2):
        o1, o2 = hotel_orders[i], hotel_orders[i + 1]
        amt = money(o1["pay_amount"] + o2["pay_amount"])
        trips.append({
            "id": tid, "trip_no": f"TRIP{ctx.now.strftime('%Y%m%d')}{tid:05d}",
            "site_id": o1["site_id"], "user_id": o1["user_id"],
            "total_amount": amt, "coupon_id": 0, "coupon_discount": money(0),
            "pay_amount": amt, "booking_count": 2,
            "pay_status": 1 if o1["order_status"] in (1, 2, 3) else 0,
            "pay_method": o1["pay_method"], "pay_trade_no": o1["pay_trade_no"],
            "pay_time": o1["pay_time"],
            "created_at": o1["created_at"], "updated_at": o1["updated_at"],
        })
        o1["trip_id"] = tid
        o2["trip_id"] = tid
        tid += 1
    f.insert(BIZ_DB, "order_trip", trips)
    if trips:
        # 回填 trip_id
        f.parts.append(
            "UPDATE `order_main` SET `trip_id` = CASE `id`\n  "
            + "\n  ".join(f"WHEN {o['id']} THEN {o['trip_id']}" for o in orders if o["trip_id"])
            + "\nEND WHERE `id` IN ("
            + ",".join(str(o["id"]) for o in orders if o["trip_id"]) + ");\n"
        )

    f.add("退款单(覆盖 0~5 全部状态)")
    # status: 0待商户审核 1待平台审核 2退款中 3已退款 4已驳回 5已撤销
    refund_orders = [o for o in orders if o["order_status"] in (5, 6)]
    refunds, rid = [], ID_BASE
    for i, o in enumerate(refund_orders):
        st = 3 if o["order_status"] == 6 else rng.choice([0, 1, 2, 4, 5])
        full = rng.random() < 0.7
        amt = money(o["pay_amount"] if full else o["pay_amount"] * Decimal("0.5"))
        refunds.append({
            "id": rid, "refund_no": f"RF{ctx.now.strftime('%Y%m%d')}{rid:06d}",
            "site_id": o["site_id"], "order_id": o["id"], "order_no": o["order_no"],
            "user_id": o["user_id"], "merchant_id": o["merchant_id"],
            "refund_type": 1 if full else 2,
            "apply_amount": amt, "refund_amount": amt if st == 3 else money(0),
            "refund_channel": rng.randint(1, 2), "deduct_amount": money(0),
            "reason": rng.choice(["行程变更", "房间与描述不符", "重复下单", "不可抗力"]),
            "images": None, "status": st,
            "merchant_audit_by": 101 if st in (1, 2, 3, 4) else None,
            "merchant_audit_time": ctx.rand_dt(20) if st in (1, 2, 3, 4) else None,
            "platform_audit_by": 103 if st in (2, 3, 4) else None,
            "platform_audit_time": ctx.rand_dt(15) if st in (2, 3, 4) else None,
            "audit_remark": "同意退款" if st in (2, 3) else ("不符合退款政策" if st == 4 else ""),
            "refund_trade_no": f"re_{rng.randint(10 ** 15, 10 ** 16 - 1)}" if st == 3 else "",
            "refund_time": ctx.rand_dt(10) if st == 3 else None,
            "created_at": o["created_at"] + timedelta(days=rng.randint(1, 10)),
            "updated_at": ctx.rand_dt(8),
        })
        rid += 1
    f.insert(BIZ_DB, "order_refund", refunds)

    f.add("核销日志")
    verified = [o for o in orders if o["order_status"] in (2, 3)][:ctx.n(20)]
    f.insert(BIZ_DB, "order_verify_log", [
        {"id": ID_BASE + i, "site_id": o["site_id"], "order_id": o["id"],
         "order_no": o["order_no"], "verify_code": o["verify_code"],
         "merchant_id": o["merchant_id"],
         "device_id": rng.choice(devices)["id"] if devices else 0,
         "operator_id": 0, "operator_name": "",
         "verify_type": rng.choice([1, 1, 2, 3]),
         "status": 1, "fail_reason": "", "revoke_reason": "", "revoke_by": None,
         "created_at": (o["use_date"] and datetime.combine(
             o["use_date"], datetime.min.time())) or o["created_at"]}
        for i, o in enumerate(verified)
    ])

    f.add("商品评价(关联已完成订单)")
    completed = [o for o in orders if o["order_status"] == 3][:ctx.n(15)]
    f.insert(BIZ_DB, "goods_review", [
        {"id": ID_BASE + i, "site_id": o["site_id"], "goods_id": o["goods_id"],
         "user_id": o["user_id"], "order_id": o["id"],
         "rating": rng.randint(3, 5),
         "content": rng.choice(["房间干净整洁,位置很好!", "服务态度不错,下次还来。",
                                "设施略旧但性价比高。", "非常满意的一次入住体验。"]),
         "images": None, "reply_content": "感谢您的评价!" if rng.random() < 0.4 else "",
         "merchant_flag_status": 1 if rng.random() < 0.15 else 0,
         "merchant_flag_reason": "疑似虚假评价" if rng.random() < 0.15 else "",
         "merchant_flagged_at": ctx.rand_dt(20) if rng.random() < 0.15 else None,
         "merchant_flagged_by": 101 if rng.random() < 0.15 else 0,
         "status": rng.choices([0, 1, 2], weights=[20, 70, 10])[0],
         "created_at": o["created_at"] + timedelta(days=rng.randint(1, 15)),
         "updated_at": ctx.rand_dt(20)}
        for i, o in enumerate(completed)
    ])


def build_finance(ctx: Ctx, f: SqlFile) -> None:
    """财务域:资金流水、商户结算单、提现、税费配置、分账分录"""
    rng, c = ctx.rng, ctx.c

    f.add("税费配置")
    f.insert(BIZ_DB, "finance_tax_config", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "tax_name": nm, "goods_type": gt,
         "tax_rate": money(rate), "calc_type": ct, "status": 1,
         "remark": "测试数据", "created_at": ctx.ago(200), "updated_at": ctx.ago(200)}
        for i, (nm, gt, rate, ct) in enumerate([
            ("法国增值税 VAT", 0, 0.2000, 1),
            ("巴黎城市税", 1, 2.5000, 2),
            ("门票服务税", 2, 0.1000, 1),
        ])
    ])

    if not ctx.orders:
        return

    paid_orders = [o for o in ctx.orders if o["order_status"] in (1, 2, 3, 5, 6)]

    f.add("资金流水(与已支付订单一一对应)")
    flows, flid = [], ID_BASE
    for i, o in enumerate(paid_orders):
        flows.append({
            "id": flid, "flow_no": f"FL{ctx.now.strftime('%Y%m%d')}{flid:06d}",
            "site_id": o["site_id"], "flow_type": 1, "biz_type": 1,
            "amount": o["pay_amount"], "order_id": o["id"],
            "merchant_id": o["merchant_id"], "supplier_id": 0, "user_id": o["user_id"],
            "pay_channel": o["pay_method"] or 1, "trade_no": o["pay_trade_no"],
            "flow_status": 1, "remark": "订单支付", "operator_id": 0,
            "created_at": o["pay_time"] or o["created_at"],
        })
        flid += 1
    # 退款支出流水
    for o in [x for x in ctx.orders if x["order_status"] == 6][:ctx.n(8)]:
        flows.append({
            "id": flid, "flow_no": f"FL{ctx.now.strftime('%Y%m%d')}{flid:06d}",
            "site_id": o["site_id"], "flow_type": 2, "biz_type": 2,
            "amount": o["pay_amount"], "order_id": o["id"],
            "merchant_id": o["merchant_id"], "supplier_id": 0, "user_id": o["user_id"],
            "pay_channel": o["pay_method"] or 1, "trade_no": f"re_{rng.randint(10 ** 15, 10 ** 16 - 1)}",
            "flow_status": 1, "remark": "订单退款", "operator_id": 103,
            "created_at": ctx.rand_dt(20),
        })
        flid += 1
    f.insert(BIZ_DB, "finance_flow", flows)

    f.add("按订单结算分录")
    f.insert(BIZ_DB, "finance_account_entry", [
        {"id": ID_BASE + i, "site_id": o["site_id"], "order_id": o["id"],
         "order_no": o["order_no"], "merchant_id": o["merchant_id"], "coupon_id": 0,
         "order_amount": o["pay_amount"], "commission": o["platform_commission"],
         "discount_amount": o["discount_amount"],
         "funding_source": rng.choice([1, 2, 4]),
         "mtrip_pays": money(o["discount_amount"] * Decimal("0.5")),
         "merchant_pays": money(o["discount_amount"] * Decimal("0.5")),
         "partner_pays": money(0),
         # 口径: merchant_settlement = order_amount - commission - merchant_pays
         "merchant_settlement": money(o["pay_amount"] - o["platform_commission"]
                                      - money(o["discount_amount"] * Decimal("0.5"))),
         # platform_revenue = commission - mtrip_pays
         "platform_revenue": money(o["platform_commission"]
                                   - money(o["discount_amount"] * Decimal("0.5"))),
         "created_at": o["pay_time"] or o["created_at"]}
        for i, o in enumerate(paid_orders)
    ])

    f.add("商户结算单(覆盖 0待确认 1已确认 2已打款 3有争议)")
    merchant_ids = sorted({o["merchant_id"] for o in paid_orders})[:ctx.n(10)]
    settles, seid = [], ID_BASE
    for i, mid in enumerate(merchant_ids):
        mos = [o for o in paid_orders if o["merchant_id"] == mid]
        m = next((x for x in ctx.merchants if x["id"] == mid), ctx.merchants[0])
        order_amt = money(sum(o["pay_amount"] for o in mos))
        commission = money(sum(o["platform_commission"] for o in mos))
        refund_amt = money(sum(o["pay_amount"] for o in mos if o["order_status"] == 6))
        tax = money(commission * Decimal("0.2"))
        st = rng.choice([0, 1, 1, 2, 3])
        cycle = (ctx.now - timedelta(days=30 * (i % 3))).strftime("%Y-%m")
        settles.append({
            "id": seid, "settle_no": f"ST{cycle.replace('-', '')}{seid:05d}",
            "site_id": m["site_id"], "merchant_id": mid, "settle_cycle": cycle,
            "order_count": len(mos), "order_amount": order_amt,
            "refund_amount": refund_amt, "commission": commission,
            "tax_amount": tax,
            "settle_amount": money(order_amt - commission - tax - refund_amt),
            "status": st,
            "confirm_by": 103 if st in (1, 2, 3) else None,
            "confirm_time": ctx.rand_dt(20) if st in (1, 2, 3) else None,
            "pay_time": ctx.rand_dt(10) if st == 2 else None,
            "pay_voucher": f"https://cdn.mtrip.test/prod/voucher/{seid}.pdf" if st == 2 else "",
            "remark": "争议:金额与商户账目不符" if st == 3 else "",
            "created_at": ctx.rand_dt(60, 20), "updated_at": ctx.rand_dt(10),
        })
        seid += 1
    f.insert(BIZ_DB, "finance_merchant_settle", settles)

    f.add("商户提现申请(覆盖 0~4 全部状态)")
    f.insert(BIZ_DB, "finance_withdraw", [
        {"id": ID_BASE + i, "withdraw_no": f"WD{ctx.now.strftime('%Y%m%d')}{ID_BASE + i:05d}",
         "site_id": s["site_id"], "merchant_id": s["merchant_id"],
         "amount": money(s["settle_amount"] * Decimal(rng.choice(["0.5", "0.8", "1"]))),
         "fee": money(2.50),
         "actual_amount": money(s["settle_amount"] * Decimal(rng.choice(["0.5", "0.8", "1"])) - Decimal("2.50")),
         "account_type": rng.randint(1, 3),
         "account_info": c.encrypt(f"FR76{rng.randint(100000000000, 999999999999)}"),
         "status": st,
         "audit_by": 103 if st in (1, 2, 3, 4) else None,
         "audit_time": ctx.rand_dt(15) if st in (1, 2, 3, 4) else None,
         "audit_remark": "已打款" if st == 2 else ("账户信息有误" if st in (3, 4) else ""),
         "trade_no": f"tr_{rng.randint(10 ** 15, 10 ** 16 - 1)}" if st == 2 else "",
         "pay_time": ctx.rand_dt(8) if st == 2 else None,
         "created_at": ctx.rand_dt(45, 5), "updated_at": ctx.rand_dt(5)}
        for i, (s, st) in enumerate([(s, rng.choice([0, 1, 2, 2, 3, 4])) for s in settles])
    ])


def build_marketing(ctx: Ctx, f: SqlFile) -> None:
    """营销域:优惠券、活动、Banner、代金券、促销码、新客奖励、积分/长住规则"""
    rng = ctx.rng

    f.add("优惠券模板(覆盖 0~3 全部状态)")
    coupons, cid = [], ID_BASE
    for i in range(ctx.n(8)):
        name, ctype, value, minamt, gscope = COUPON_POOL[i % len(COUPON_POOL)]
        st = rng.choice([1, 1, 1, 0, 2, 3])
        total = rng.choice([0, 500, 2000])
        received = rng.randint(0, total or 800)
        coupons.append({
            "id": cid, "site_id": MAIN_SITE,
            "merchant_id": ctx.merchants[i]["id"] if (ctx.merchants and i % 3 == 0) else 0,
            "created_by_merchant_admin": 0,
            "coupon_name": f"{name}-{i + 1}", "coupon_type": ctype,
            "discount_value": money(value), "min_amount": money(minamt),
            "max_discount": money(value if ctype != 2 else 100),
            "funding_source": rng.choice([1, 2, 4]),
            "funding_rules": json.dumps({"mtrip": 50, "merchant": 50, "partner": 0}),
            "goods_scope": gscope,
            "goods_ids": json.dumps([g["id"] for g in ctx.goods[:2]]) if (gscope == 3 and ctx.goods) else None,
            "total_count": total, "received_count": received,
            "used_count": rng.randint(0, received),
            "per_user_limit": rng.randint(1, 3),
            "valid_type": rng.randint(1, 2),
            "valid_start": ctx.ago(30), "valid_end": ctx.ago(-60), "valid_days": 30,
            "status": st, "remark": "测试数据",
            "created_at": ctx.ago(rng.randint(20, 120)), "updated_at": ctx.rand_dt(10),
        })
        cid += 1
    f.insert(BIZ_DB, "marketing_coupon", coupons)
    ctx.coupons = coupons

    f.add("用户领券记录")
    receives, rid = [], ID_BASE
    for cp in coupons:
        for k in range(min(ctx.n(5), 5)):
            u = ctx.users[rng.randint(0, len(ctx.users) - 1)] if ctx.users else None
            if not u:
                break
            st = rng.choice([0, 0, 1, 2, 3])
            receives.append({
                "id": rid, "site_id": cp["site_id"], "coupon_id": cp["id"],
                "user_id": u["id"], "coupon_code": f"CP{rid:010d}",
                "status": st,
                "valid_start": ctx.ago(20), "valid_end": ctx.ago(-40),
                "order_id": 0, "used_time": ctx.rand_dt(15) if st == 1 else None,
                "created_at": ctx.rand_dt(40), "updated_at": ctx.rand_dt(10),
            })
            rid += 1
    f.insert(BIZ_DB, "marketing_coupon_receive", receives)

    f.add("限时活动 + 活动商品")
    acts, aid = [], ID_BASE
    for i in range(ctx.n(5)):
        st = rng.choice([1, 1, 0, 2, 3])
        acts.append({
            "id": aid, "site_id": MAIN_SITE,
            "activity_name": rng.choice(["夏季大促", "早鸟特惠", "周末闪购", "长住优惠", "开学季"]),
            "activity_type": rng.randint(1, 3),
            "banner_image": f"https://cdn.mtrip.test/prod/act/banner_{aid}.jpg",
            "start_time": ctx.ago(20), "end_time": ctx.ago(-40),
            "rules": json.dumps({"discount": 15, "limit": 2}, ensure_ascii=False),
            "status": st, "remark": "测试数据",
            "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10),
        })
        aid += 1
    f.insert(BIZ_DB, "marketing_activity", acts)
    f.insert(BIZ_DB, "marketing_activity_goods", [
        {"id": ID_BASE + i, "activity_id": a["id"], "site_id": a["site_id"],
         "goods_id": g["id"], "sku_type": 0, "sku_id": 0,
         "activity_price": money(g and 100 or 100),
         "activity_stock": rng.randint(0, 200), "sold_count": rng.randint(0, 80),
         "per_user_limit": rng.randint(1, 5), "sort": i + 1,
         "created_at": a["created_at"], "updated_at": a["updated_at"]}
        for i, (a, g) in enumerate(zip(acts, [ctx.goods[i % len(ctx.goods)] for i in range(len(acts))]))
        if ctx.goods
    ])

    f.add("首页 Banner")
    f.insert(BIZ_DB, "marketing_banner", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "position": rng.randint(1, 3),
         "title": rng.choice(["夏季大促", "新客立减", "长住特惠", "巴黎玩乐指南"]),
         "image": f"https://cdn.mtrip.test/prod/banner/{ID_BASE + i}.jpg",
         "link_type": rng.randint(0, 3),
         "link_value": f"/goods/{ctx.goods[0]['id']}" if (rng.randint(0, 3) == 1 and ctx.goods) else "",
         "start_time": ctx.ago(30), "end_time": ctx.ago(-60),
         "sort": i + 1, "status": 1 if rng.random() < 0.8 else 2,
         "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10)}
        for i in range(ctx.n(6))
    ])

    f.add("促销中心活动 / 代金券 / 促销码 / 新客奖励")
    campaigns, cmid = [], ID_BASE
    for i in range(ctx.n(5)):
        campaigns.append({
            "id": cmid, "site_id": MAIN_SITE,
            "title": rng.choice(["夏日狂欢季", "新客首单礼", "长住省心计划", "周末微度假"]),
            "subtitle": "限时优惠,先到先得",
            "banner": f"https://cdn.mtrip.test/prod/campaign/{cmid}.jpg",
            "landing_url": "",
            "coupon_ids": json.dumps([c["id"] for c in coupons[:2]], ensure_ascii=False),
            "start_time": ctx.ago(30), "end_time": ctx.ago(-60),
            "sort": i + 1, "status": rng.choice([1, 1, 0, 2]),
            "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10),
        })
        cmid += 1
    f.insert(BIZ_DB, "marketing_campaign", campaigns)

    f.insert(BIZ_DB, "marketing_voucher", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE,
         "name": f"{rng.choice(['新客代金券', '节日代金券', '补偿代金券'])}-{i + 1}",
         "campaign_id": campaigns[i % len(campaigns)]["id"] if campaigns else 0,
         "voucher_type": rng.choice(["fixed", "percentage", "free_night"]),
         "value": money(rng.choice([10, 20, 50, 15])),
         "value_display": f"€{rng.choice([10, 20, 50, 15])}",
         "status": rng.choice([1, 1, 2, 3, 4, 5]),
         "start_date": ctx.ago(30).date(), "end_date": ctx.ago(-60).date(),
         "quantity": rng.randint(100, 5000), "claimed": rng.randint(0, 800),
         "redeemed": rng.randint(0, 200),
         "min_spend": rng.choice([0, 5000, 10000]),
         "per_user_limit": rng.randint(1, 3),
         "total_redemption_limit": rng.randint(100, 5000),
         "merchant_scope": "all" if rng.random() < 0.7 else "selected",
         "merchant_count": 0 if rng.random() < 0.7 else rng.randint(1, 5),
         "created_by": "运营专员",
         "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10)}
        for i in range(ctx.n(6))
    ])

    f.insert(BIZ_DB, "marketing_promo_code", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE,
         "code": f"PROMO{i + 1:04d}",
         "name": f"促销码-{i + 1}",
         "campaign_id": campaigns[i % len(campaigns)]["id"] if campaigns else 0,
         "discount_type": rng.choice(["percentage", "fixed", "cashback"]),
         "discount_value": money(rng.choice([10, 15, 25])),
         "discount_display": f"{rng.choice([10, 15, 25])}% OFF",
         "status": rng.choice([1, 1, 2, 3, 4, 5]),
         "start_date": ctx.ago(30).date(), "end_date": ctx.ago(-60).date(),
         "usage_limit": rng.randint(100, 3000), "usage_count": rng.randint(0, 500),
         "per_user_limit": rng.randint(1, 3),
         "min_spend": rng.choice([0, 5000, 20000]),
         "stackable": rng.randint(0, 1),
         "merchant_scope": "all", "merchant_count": 0,
         "created_by": "运营专员",
         "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10)}
        for i in range(ctx.n(8))
    ])

    f.insert(BIZ_DB, "marketing_welcome_reward", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE,
         "name": nm, "reward_type": rt, "discount_type": dt,
         "discount_value": money(val), "discount_display": disp,
         "status": rng.choice([1, 1, 2, 3]), "validity_days": rng.choice([14, 30, 60]),
         "usage_limit": rng.randint(500, 5000), "usage_count": rng.randint(0, 800),
         "min_spend": rng.choice([0, 5000]),
         "new_users_converted": rng.randint(0, 500),
         "revenue": rng.randint(0, 500000),
         "created_by": "运营专员",
         "created_at": ctx.ago(60), "updated_at": ctx.rand_dt(10)}
        for i, (nm, rt, dt, val, disp) in enumerate([
            ("新客注册礼", "new_user", "fixed", 15, "€15"),
            ("首单立减", "first_booking", "percentage", 10, "10% OFF"),
            ("注册送积分", "registration", "fixed", 5, "€5"),
        ])
    ])

    f.add("积分规则 / 长住梯度")
    f.insert(BIZ_DB, "marketing_points_rule", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "rule_key": rk, "rule_name": rn,
         "points_type": pt, "points_value": pv, "points_rate": money(pr),
         "daily_limit": dl, "deduct_rate": money(dr), "status": 1,
         "remark": "测试数据", "created_at": ctx.ago(120), "updated_at": ctx.ago(120)}
        for i, (rk, rn, pt, pv, pr, dl, dr) in enumerate([
            ("order_paid", "下单送积分", 2, 0, 0.0100, 0, 0),
            ("sign_in", "每日签到", 1, 5, 0.0000, 1, 0),
            ("register", "注册赠送", 1, 100, 0.0000, 0, 0),
            ("points_deduct", "积分抵扣", 1, 0, 0.0000, 0, 100),
        ])
    ])
    f.insert(BIZ_DB, "marketing_longstay_tier", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE, "min_nights": mn,
         "discount_rate": money(dr), "status": 1, "remark": "测试数据",
         "created_at": ctx.ago(120), "updated_at": ctx.ago(120)}
        for i, (mn, dr) in enumerate([(7, 5.00), (14, 10.00), (21, 15.00), (30, 20.00)])
    ])


def build_affiliate(ctx: Ctx, f: SqlFile) -> None:
    """达人域:合作方、入驻申请、联盟计划、折扣码、佣金、提现、反欺诈"""
    rng, c = ctx.rng, ctx.c

    f.add("带货达人/合作方(覆盖 1活跃 2待审 3暂停 4已拒绝)")
    partners, pid = [], ID_BASE
    for i in range(ctx.n(10)):
        name, handle, ptype, platform = AFFILIATE_POOL[i % len(AFFILIATE_POOL)]
        st = rng.choice([1, 1, 1, 2, 3, 4])
        earnings = rng.randint(0, 500000)
        partners.append({
            "id": pid, "site_id": MAIN_SITE, "name": f"{name}-{i + 1}", "handle": f"{handle}{i}",
            "type": ptype, "platform": platform,
            "followers": rng.randint(1000, 500000), "country": rng.choice(["FR", "US", "CN", "GB"]),
            "status": st, "commission_rate": money(rng.choice([5, 8, 10, 12, 15])),
            "total_earnings": earnings, "withdrawable": int(earnings * rng.uniform(0.1, 0.6)),
            "total_referrals": rng.randint(0, 3000),
            "conversions": rng.randint(0, 800),
            "fraud_score": rng.randint(0, 95),
            "join_date": ctx.ago(rng.randint(30, 300)).date(),
            "last_activity": ctx.rand_dt(30) if st == 1 else None,
            "created_at": ctx.ago(rng.randint(30, 300)), "updated_at": ctx.rand_dt(15),
        })
        pid += 1
    f.insert(BIZ_DB, "affiliate_partner", partners)
    ctx.partners = partners

    f.add("达人入驻申请(覆盖 1待审 2通过 3拒绝)")
    f.insert(BIZ_DB, "affiliate_application", [
        {"id": ID_BASE + i, "site_id": MAIN_SITE,
         "name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
         "handle": f"applicant_{ID_BASE + i}", "type": rng.choice(["influencer", "blogger", "kol"]),
         "platform": rng.choice(["Instagram", "YouTube", "TikTok"]),
         "followers": rng.randint(1000, 200000),
         "contact_email": f"applicant{ID_BASE + i}@mtrip.test",
         "contact_phone": c.encrypt(f"+3364{rng.randint(1000000, 9999999)}"),
         "audience": "欧洲旅行爱好者", "materials": None,
         "status": st,
         "reviewer_id": 104 if st in (2, 3) else 0,
         "reviewer_name": "客服专员" if st in (2, 3) else "",
         "review_note": "资料齐全,通过" if st == 2 else ("粉丝质量不达标" if st == 3 else ""),
         "partner_id": partners[i % len(partners)]["id"] if st == 2 else 0,
         "created_at": ctx.rand_dt(60), "updated_at": ctx.rand_dt(20)}
        for i, st in enumerate([rng.choice([1, 1, 2, 3]) for _ in range(ctx.n(6))])
    ])

    f.add("联盟计划配置")
    f.insert(BIZ_DB, "affiliate_program", [
        {"id": ID_BASE + 0, "site_id": MAIN_SITE, "kind": 1, "name": "酒店佣金规则",
         "config": json.dumps({"commission": {"affiliateType": "hotel", "rate": 10,
                                              "minBookingValue": 50}}, ensure_ascii=False),
         "enabled": 1, "sort": 1, "created_at": ctx.ago(120), "updated_at": ctx.ago(120)},
        {"id": ID_BASE + 1, "site_id": MAIN_SITE, "kind": 2, "name": "新客首单奖励",
         "config": json.dumps({"reward": {"trigger": "first_booking", "target": "new_user",
                                          "rewardType": "fixed", "rewardValue": 20}},
                              ensure_ascii=False),
         "enabled": 1, "sort": 2, "created_at": ctx.ago(120), "updated_at": ctx.ago(120)},
        {"id": ID_BASE + 2, "site_id": MAIN_SITE, "kind": 3, "name": "结算周期参数",
         "config": json.dumps({"setting": {"key": "settle_cycle_days", "value": 30}},
                              ensure_ascii=False),
         "enabled": 1, "sort": 3, "created_at": ctx.ago(120), "updated_at": ctx.ago(120)},
    ])

    f.add("联盟折扣码")
    codes, cid = [], ID_BASE
    for i in range(ctx.n(12)):
        p = partners[i % len(partners)]
        codes.append({
            "id": cid, "site_id": p["site_id"], "code": f"AFF{cid:05d}",
            "partner_id": p["id"], "partner_name": p["name"], "partner_handle": p["handle"],
            "promotion_type": rng.choice(["percentage", "fixed", "cashback"]),
            "discount_value": money(rng.choice([8, 10, 15, 20])),
            "discount_display": f"{rng.choice([8, 10, 15, 20])}% OFF",
            "referral_link": f"https://mtrip.test/r/AFF{cid:05d}",
            "status": rng.choice([1, 1, 2, 3, 4]),
            "start_date": ctx.ago(60).date(), "end_date": ctx.ago(-90).date(),
            "usage_limit": rng.randint(100, 2000), "usage_count": rng.randint(0, 300),
            "per_user_limit": rng.randint(1, 3), "min_spend": rng.choice([0, 5000]),
            "eligible_merchants": "all", "merchant_count": 0,
            "bookings": rng.randint(0, 500), "conversions": rng.randint(0, 200),
            "revenue": rng.randint(0, 300000), "commission": rng.randint(0, 30000),
            "commission_rate": p["commission_rate"],
            "last_used_at": ctx.rand_dt(20), "created_by": "运营专员",
            "created_at": ctx.ago(90), "updated_at": ctx.rand_dt(10),
        })
        cid += 1
    f.insert(BIZ_DB, "affiliate_code", codes)

    f.add("佣金流水 / 提现 / 反欺诈案件")
    f.insert(BIZ_DB, "affiliate_commission_log", [
        {"id": ID_BASE + i, "site_id": cd["site_id"], "partner_id": cd["partner_id"],
         "code_id": cd["id"], "order_id": 0,
         "amount": rng.randint(500, 20000), "commission_rate": cd["commission_rate"],
         "status": rng.choice([1, 1, 2, 3]),
         "created_at": ctx.rand_dt(60), "updated_at": ctx.rand_dt(10)}
        for i, cd in enumerate(codes)
    ])
    f.insert(BIZ_DB, "affiliate_withdraw", [
        {"id": ID_BASE + i, "site_id": p["site_id"], "partner_id": p["id"],
         "amount": rng.randint(5000, 100000), "status": st,
         "bank_info": c.encrypt(f"FR76{rng.randint(100000000000, 999999999999)}"),
         "operator_id": 103 if st in (2, 3, 4) else 0,
         "paid_at": ctx.rand_dt(10) if st == 3 else None,
         "remark": "测试数据",
         "created_at": ctx.rand_dt(45), "updated_at": ctx.rand_dt(5)}
        for i, (p, st) in enumerate(
            [(p, rng.choice([1, 2, 2, 3, 4])) for p in partners[:ctx.n(6)]])
    ])
    f.insert(BIZ_DB, "affiliate_fraud_flag", [
        {"id": ID_BASE + i, "site_id": p["site_id"], "partner_id": p["id"],
         "partner_name": p["name"], "handle": p["handle"],
         "fraud_score": score,
         "risk_level": 1 if score >= 70 else 2 if score >= 40 else 3,
         "suspicious_activity": rng.choice(["自买自卖", "异常集中下单", "虚假流量", "优惠券套现"]),
         "evidence_summary": "近 7 天订单集中在同一 IP 段",
         "investigation_status": rng.choice([1, 1, 2, 3, 4]),
         "reviewer": "运营专员", "detection_date": ctx.rand_dt(30).date(),
         "created_at": ctx.rand_dt(30), "updated_at": ctx.rand_dt(5)}
        for i, (p, score) in enumerate(
            [(p, rng.randint(30, 95)) for p in partners[:ctx.n(5)]])
    ])


def build_compliance(ctx: Ctx, f: SqlFile) -> None:
    """合规域:平台规则、违规工单、警告、合规历史"""
    rng = ctx.rng

    f.add("平台规则库(覆盖 1生效 2草稿 3归档)")
    rules, rid = [], ID_BASE
    for i in range(ctx.n(10)):
        cat, title, sev = RULE_POOL[i % len(RULE_POOL)]
        st = rng.choice([1, 1, 1, 2, 3])
        rules.append({
            "id": rid, "site_id": 0, "title": f"{title}-{i + 1}", "category": cat,
            "severity": sev, "status": st,
            "applies": "All Merchants",
            "body": f"<p>{title}。违反者将按平台规则处理。</p>",
            "version": rng.randint(1, 4),
            "exceptions_json": None,
            "created_by": "运营专员",
            "created_at": ctx.ago(rng.randint(30, 200)), "updated_at": ctx.rand_dt(20),
        })
        rid += 1
    f.insert(BIZ_DB, "platform_rule", rules)
    ctx.rules = rules

    f.add("规则版本快照")
    f.insert(BIZ_DB, "platform_rule_revision", [
        {"id": ID_BASE + i, "rule_id": r["id"], "site_id": r["site_id"],
         "version": max(1, r["version"] - 1), "action": "publish",
         "snapshot_json": json.dumps({"title": r["title"], "severity": r["severity"]},
                                     ensure_ascii=False),
         "effective_at": ctx.rand_dt(90), "note": "历史版本",
         "actor_id": 101, "actor_name": "站点管理员", "created_at": ctx.rand_dt(90)}
        for i, r in enumerate(rules) if r["version"] > 1
    ])

    f.add("商户违规工单")
    violations, vid = [], ID_BASE
    for i in range(ctx.n(12)):
        title, cat, sev = VIOLATION_POOL[i % len(VIOLATION_POOL)]
        m = ctx.merchants[i % len(ctx.merchants)] if ctx.merchants else None
        if not m:
            break
        st = rng.choice([1, 1, 2])
        violations.append({
            "id": vid, "site_id": m["site_id"], "merchant_id": m["id"],
            "merchant_name": m["merchant_name"],
            "rule_id": rules[i % len(rules)]["id"],
            "rule_title": rules[i % len(rules)]["title"],
            "severity": sev, "status": st,
            "action": "已要求整改并警告" if st == 2 else "",
            "assigned_to": "运营专员",
            "detected_date": ctx.rand_dt(60).date(),
            "rule_revision_id": None, "category_code": cat,
            "details": f"商户 {m['merchant_short_name']} 于近期被判定为「{title}」。",
            "created_at": ctx.rand_dt(60), "updated_at": ctx.rand_dt(10),
        })
        vid += 1
    f.insert(BIZ_DB, "merchant_violation", violations)

    f.add("商户警告(覆盖 1有效 2已撤销)")
    f.insert(BIZ_DB, "merchant_warning", [
        {"id": ID_BASE + i, "site_id": v["site_id"], "merchant_id": v["merchant_id"],
         "merchant_name": v["merchant_name"],
         "reason": v["rule_title"], "level": rng.randint(1, 3),
         "issued_by": "运营专员",
         "expires_at": (ctx.now + timedelta(days=rng.randint(-60, 90))).date(),
         "status": st, "violation_id": v["id"],
         "rule_revision_id": None, "category_code": v["category_code"],
         "created_at": v["created_at"], "updated_at": ctx.rand_dt(10)}
        for i, (v, st) in enumerate([(v, rng.choice([1, 1, 2])) for v in violations])
    ])

    f.add("合规审计历史")
    f.insert(BIZ_DB, "compliance_history", [
        {"id": ID_BASE + i, "site_id": v["site_id"], "merchant_id": v["merchant_id"],
         "merchant_name": v["merchant_name"],
         "event": v["rule_title"], "result": rng.choice([1, 2, 2, 3]),
         "score": rng.randint(40, 100), "reviewer": "运营专员",
         "event_date": v["detected_date"],
         "violation_id": v["id"], "warning_id": None, "rule_revision_id": None,
         "category_code": v["category_code"], "action": "record",
         "note": "定期合规巡检", "case_version": 1, "case_status": v["status"],
         "actor_id": 101, "actor_type": "admin", "ip_address": "10.0.0.1",
         "request_id": f"cmp-{v['id']}",
         "request_hash": hashlib.sha256(f"cmp-{v['id']}".encode()).hexdigest(),
         "result_json": json.dumps({"ok": True}, ensure_ascii=False),
         "merchant_status_history_id": None,
         "created_at": v["created_at"]}
        for i, v in enumerate(violations)
    ])


def build_supplier(ctx: Ctx, f: SqlFile) -> None:
    """供应商域:供应商、登录账号、供货商品、结算账单"""
    rng, c = ctx.rng, ctx.c
    pw = bcrypt_hash("Supplier@123456")

    f.add("供应商(覆盖 0~3 全部状态)")
    suppliers, sid = [], ID_BASE
    for i in range(ctx.n(5)):
        name, en, stype = SUPPLIER_POOL[i % len(SUPPLIER_POOL)]
        st = rng.choice([1, 1, 0, 2, 3])
        suppliers.append({
            "id": sid, "site_id": MAIN_SITE, "supplier_name": f"{name}-{i + 1}",
            "supplier_short_name": en, "supplier_type": stype,
            "credit_code": f"SUP{rng.randint(100000000, 999999999)}{i:02d}",
            "business_license": f"https://cdn.mtrip.test/prod/supplier/license_{sid}.jpg",
            "contact_name": f"{rng.choice(FIRST_NAME)} {rng.choice(LAST_NAME)}",
            "contact_phone": c.encrypt(f"+3365{rng.randint(1000000, 9999999)}"),
            "contact_email": f"supplier{sid}@mtrip.test",
            "share_rate": money(rng.choice([5, 8, 10, 12])),
            "settle_type": rng.randint(1, 3),
            "bank_name": rng.choice(BANKS), "account_name": name,
            "account_no": c.encrypt(f"FR76{rng.randint(100000000000, 999999999999)}"),
            "contract_file": f"https://cdn.mtrip.test/prod/supplier/contract_{sid}.pdf",
            "status": st,
            "coop_start_at": ctx.ago(rng.randint(60, 400)) if st in (1, 2, 3) else None,
            "coop_end_at": ctx.ago(-365) if st == 3 else None,
            "remark": "测试数据",
            "created_at": ctx.ago(rng.randint(60, 400)), "updated_at": ctx.rand_dt(20),
        })
        sid += 1
    f.insert(BIZ_DB, "supplier_info", suppliers)
    ctx.suppliers = suppliers

    f.add("供应商登录账号(口令统一 Supplier@123456)")
    f.insert(BIZ_DB, "supplier_admin", [
        {"id": ID_BASE + i, "site_id": s["site_id"], "supplier_id": s["id"],
         "username": f"s{s['id']}", "password": pw,
         "real_name": s["contact_name"],
         "mobile": c.encrypt(f"+3365{rng.randint(1000000, 9999999)}"),
         "is_owner": 1, "status": 1 if s["status"] == 1 else 2,
         "last_login_at": ctx.rand_dt(30) if s["status"] == 1 else None,
         "created_at": s["created_at"], "updated_at": ctx.rand_dt(20)}
        for i, s in enumerate(suppliers)
    ])
    f.insert(BIZ_DB, "supplier_admin_role", [
        {"admin_id": ID_BASE + i, "role_id": 1} for i in range(len(suppliers))
    ], clean="admin_id >= 1001")

    f.add("供货商品")
    f.insert(BIZ_DB, "supplier_goods", [
        {"id": ID_BASE + i, "site_id": s["site_id"], "supplier_id": s["id"],
         "goods_id": g["id"] if ctx.goods else 0,
         "goods_name": g["goods_name"] if ctx.goods else f"供货商品-{i + 1}",
         "goods_type": (g["goods_type"] if ctx.goods else rng.randint(1, 2)),
         "supply_price": money(supply),
         "retail_price": money(supply * Decimal("1.35")),
         "sync_type": rng.randint(1, 3),
         "status": 1 if rng.random() < 0.8 else 2,
         "remark": "测试数据",
         "created_at": s["created_at"], "updated_at": ctx.rand_dt(20)}
        for i, (s, g, supply) in enumerate([
            (suppliers[i % len(suppliers)],
             ctx.goods[i % len(ctx.goods)] if ctx.goods else None,
             rng.randint(50, 300))
            for i in range(ctx.n(12))])
    ])

    f.add("供应商结算账单")
    f.insert(BIZ_DB, "supplier_settle", [
        {"id": ID_BASE + i, "settle_no": f"SS{cycle.replace('-', '')}{ID_BASE + i:05d}",
         "site_id": s["site_id"], "supplier_id": s["id"], "settle_month": cycle,
         "order_count": rng.randint(5, 300),
         "supply_amount": money(supply),
         "share_amount": money(supply * Decimal("0.1")),
         "settle_amount": money(supply * Decimal("1.1")),
         "status": st,
         "audit_by": 103 if st in (1, 2, 3) else None,
         "audit_time": ctx.rand_dt(20) if st in (1, 2, 3) else None,
         "pay_time": ctx.rand_dt(10) if st == 2 else None,
         "pay_voucher": f"https://cdn.mtrip.test/prod/voucher/ss{ID_BASE + i}.pdf" if st == 2 else "",
         "remark": "测试数据",
         "created_at": ctx.rand_dt(60, 20), "updated_at": ctx.rand_dt(10)}
        for i, (s, cycle, st, supply) in enumerate([
            (suppliers[i % len(suppliers)],
             (ctx.now - timedelta(days=30 * i)).strftime("%Y-%m"),
             rng.choice([0, 1, 1, 2, 3]),
             rng.randint(5000, 80000))
            for i in range(ctx.n(8))])
    ])


def build_helpcenter(ctx: Ctx, f: SqlFile) -> None:
    """帮助中心:分类、FAQ、公告、搜索日志"""
    rng = ctx.rng

    f.add("帮助中心分类")
    cats = [
        (ID_BASE + 0, "预订与支付", "💳", "下单、支付相关问题"),
        (ID_BASE + 1, "退款与取消", "↩️", "退改签政策与进度"),
        (ID_BASE + 2, "账号与安全", "🔒", "登录、实名、隐私"),
        (ID_BASE + 3, "商户入驻", "🏨", "入驻流程与资质要求"),
    ]
    f.insert(SYSTEM_DB, "help_category", [
        {"id": cid, "site_id": 0, "name": nm, "icon": ic, "description": desc,
         "sort": i + 1, "visible": 1, "created_at": ctx.ago(150), "updated_at": ctx.ago(150)}
        for i, (cid, nm, ic, desc) in enumerate(cats)
    ])

    f.add("FAQ 文章(覆盖 1已发布 2草稿 3已归档)")
    articles = [
        ("如何修改订单入住日期?", 0, "customer"),
        ("支持哪些支付方式?", 0, "customer"),
        ("退款多久能到账?", 1, "customer"),
        ("免费取消的截止时间怎么算?", 1, "customer"),
        ("忘记密码怎么办?", 2, "customer"),
        ("如何注销账号?", 2, "customer"),
        ("商户入驻需要哪些材料?", 3, "merchant"),
        ("入驻审核需要多久?", 3, "merchant"),
        ("如何绑定结算账户?", 3, "merchant"),
        ("达人佣金如何结算?", 3, "affiliate"),
    ]
    f.insert(SYSTEM_DB, "help_article", [
        {"id": ID_BASE + i, "site_id": 0, "title": t,
         "category_id": cats[ci][0], "audience": aud,
         "content": f"<h3>{t}</h3><p>这里是「{t}」的解答正文,用于测试富文本展示。</p>",
         "attachments": None, "views": rng.randint(0, 5000),
         "author": "运营专员", "status": rng.choice([1, 1, 1, 2, 3]),
         "created_at": ctx.ago(rng.randint(30, 150)), "updated_at": ctx.rand_dt(20)}
        for i, (t, ci, aud) in enumerate(articles)
    ])

    f.add("公告(覆盖 1生效 2待生效 3已过期 4草稿)")
    f.insert(SYSTEM_DB, "help_announcement", [
        {"id": ID_BASE + i, "site_id": 0, "title": t, "audience": aud,
         "content": f"<p>{t}——用于测试公告展示。</p>",
         "priority": pri, "start_time": st, "end_time": et, "status": status,
         "created_at": ctx.ago(30), "updated_at": ctx.rand_dt(10)}
        for i, (t, aud, pri, st, et, status) in enumerate([
            ("平台将于本周日进行例行维护", "all", 2, ctx.ago(5), ctx.ago(-10), 1),
            ("新功能:长住折扣梯度上线", "merchant", 1, ctx.ago(3), ctx.ago(-30), 1),
            ("春节假期客服排班调整", "all", 3, ctx.ago(-20), ctx.ago(-40), 2),
            ("2025 年终大促活动回顾", "all", 3, ctx.ago(120), ctx.ago(90), 3),
            ("(草稿)节后返程出行提示", "customer", 2, None, None, 4),
        ])
    ])

    f.add("帮助中心搜索日志")
    f.insert(SYSTEM_DB, "help_search_log", [
        {"id": ID_BASE + i, "site_id": 0, "keyword": kw,
         "result_count": rng.randint(0, 12),
         "user_id": 0, "created_at": ctx.rand_dt(30)}
        for i, kw in enumerate(["退款", "发票", "取消订单", "入驻", "优惠券", "修改手机号"])
    ])


def build_property_history(ctx: Ctx, f: SqlFile) -> None:
    """物业关联历史(merchant/28)"""
    if not ctx.stores:
        return
    f.add("酒店物业关联历史")
    f.insert(BIZ_DB, "merchant_property_history", [
        {"id": ID_BASE + i, "site_id": s["site_id"], "merchant_id": s["merchant_id"],
         "store_id": s["id"], "source_business_id": s["id"], "version": 1,
         "before_json": None,
         "after_json": json.dumps({"store_name": s["store_name"], "city_key": s["city_key"],
                                   "country_code": s["country_code"]}, ensure_ascii=False),
         "note": "测试数据初始化关联", "actor_id": 101, "actor_name": "站点管理员",
         "created_at": ctx.rand_dt(30)}
        for i, s in enumerate(ctx.stores[:ctx.n(6)])
    ])


# ============================================================================
# 五之二、缅甸(MMK)市场:与 EUR 数据完全隔离的跨域样例
# ============================================================================

def build_mmk_market(ctx: Ctx, mch_f: SqlFile, gds_f: SqlFile, usr_f: SqlFile,
                     ord_f: SqlFile, fin_f: SqlFile, mkt_f: SqlFile) -> None:
    """
    仰光(site_id=7,货币 MMK)一条完整业务链:商户→门店→账号(含子账号)→
    商品→房型→库存→用户→订单→资金/结算→优惠券。
    金额用 MMK 大额整数;所有行 site_id=7,ID 走高位段(7001+/4701+/2000001+),
    与 EUR(1001+/4001+/1000001+)不冲突,且被既有 id>=... 清理规则一并覆盖。
    列结构严格对齐各 EUR builder,保证 validate_testdata.py 通过。
    """
    rng, c = ctx.rng, ctx.c
    pw_m = bcrypt_hash("Merchant@123456")
    pw_u = bcrypt_hash("User@123456")

    def mm_name() -> str:
        return f"{rng.choice(MM_FIRST_NAME)} {rng.choice(MM_LAST_NAME)}"

    def mm_phone() -> str:
        return f"+959{rng.randint(100000000, 999999999)}"

    # ---- 商户(4 家:3 启用 + 1 待审)----
    mch_f.add("【MMK 仰光站】商户主体(site_id=7)")
    mm_merchants, mid = [], MMK_ID_BASE
    mm_status_plan = [3, 3, 3, 0]
    for i, st in enumerate(mm_status_plan):
        name, en, star = MM_HOTEL_POOL[i % len(MM_HOTEL_POOL)]
        city, country, lat, lng = MM_CITY_POOL[i % len(MM_CITY_POOL)]
        phone = mm_phone()
        if i == 0:
            ctx.verify_samples[("mtrip_business", "merchant_info", mid, "contact_phone_index")] = phone
        mm_merchants.append({
            "id": mid, "merchant_code": f"MCH-{mid}", "site_id": MMK_SITE, "group_id": 0,
            "merchant_name": name, "merchant_short_name": en, "merchant_type": 1,
            "credit_code": f"MM{rng.randint(100000000, 999999999)}00{i:02d}",
            "business_license": f"https://cdn.mtrip.test/prod/merchant/license_{mid}.jpg",
            "legal_person": mm_name(),
            "legal_id_card": c.encrypt(f"MM{rng.randint(10000000, 99999999)}"),
            "legal_id_images": json.dumps([
                f"https://cdn.mtrip.test/prod/merchant/id_front_{mid}.jpg",
                f"https://cdn.mtrip.test/prod/merchant/id_back_{mid}.jpg"], ensure_ascii=False),
            "contact_name": mm_name(),
            "contact_phone": c.encrypt(phone),
            "contact_phone_index": c.phone_index(normalize_phone(phone)),
            "contact_email": f"merchant{mid}@mtrip.test",
            "address": f"{rng.randint(1, 200)} Pyay Road, {city}, {country}",
            "longitude": money(lng + rng.uniform(-0.05, 0.05)),
            "latitude": money(lat + rng.uniform(-0.05, 0.05)),
            "commission_rate": money(rng.choice([10.00, 12.00, 15.00])),
            "settlement_cycle": rng.choice([7, 14, 30]),
            "status": st, "status_version": rng.randint(1, 3),
            "suspended_until": None, "reactivation_requires_super": 0,
            "audit_remark": "资料齐全,审核通过" if st == 3 else "",
            "audit_by": 101 if st == 3 else None,
            "audit_time": ctx.rand_dt(60) if st == 3 else None,
            "access_code": f"MTRP-HOTEL-{rng.randint(100000, 999999)}",
            "credential_channels": "email,sms",
            "reject_reason_code": 0,
            "two_fa_enabled": 0, "two_fa_method": "", "two_fa_status": 0,
            "two_fa_secret_enc": "", "access_status": 0,
            "logo": f"https://cdn.mtrip.test/prod/merchant/logo_{mid}.png",
            "cover_image": f"https://cdn.mtrip.test/prod/merchant/cover_{mid}.jpg",
            "last_login_at": ctx.rand_dt(30) if st == 3 else None,
            "remark": "MMK 测试数据",
            "commission_plan": rng.choice(["premium", "standard"]),
            "created_at": ctx.ago(rng.randint(60, 300)), "updated_at": ctx.rand_dt(30),
        })
        mid += 1
    mch_f.insert(BIZ_DB, "merchant_info", mm_merchants)
    mm_enabled = [m for m in mm_merchants if m["status"] == 3]

    # ---- 门店 ----
    mch_f.add("【MMK 仰光站】门店")
    mm_stores, sid_no = [], MMK_ID_BASE + 500
    for m in mm_merchants:
        if m["status"] == 0:
            continue
        for k in range(rng.randint(1, 2)):
            city, country, lat, lng = MM_CITY_POOL[k % len(MM_CITY_POOL)]
            mm_stores.append({
                "id": sid_no, "site_id": MMK_SITE, "merchant_id": m["id"],
                "store_name": f"{m['merchant_short_name']} - {city} {k + 1}号店",
                "contact_name": mm_name(), "contact_phone": c.encrypt(mm_phone()),
                "address": f"{rng.randint(1, 200)} Strand Road, {city}",
                "longitude": money(lng + rng.uniform(-0.05, 0.05)),
                "latitude": money(lat + rng.uniform(-0.05, 0.05)),
                "business_license": f"https://cdn.mtrip.test/prod/store/license_{sid_no}.jpg",
                "business_hours": "08:00-22:00", "images": None,
                "is_main": 1 if k == 0 else 0, "status": 1,
                "business_type": "hotel", "country_code": country, "city_key": city.lower(),
                "display_enabled": 1, "mapping_version": 1, "remark": "MMK 测试数据",
                "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
            })
            sid_no += 1
    mch_f.insert(BIZ_DB, "merchant_store", mm_stores)

    # ---- 结算账户 ----
    mch_f.add("【MMK 仰光站】结算账户")
    mch_f.insert(BIZ_DB, "merchant_account", [
        {"id": MMK_ID_BASE + 600 + i, "site_id": MMK_SITE, "merchant_id": m["id"],
         "bank_name": rng.choice(MM_BANKS), "account_name": m["merchant_name"],
         "account_no": c.encrypt(f"MM{rng.randint(10 ** 11, 10 ** 12 - 1)}"),
         "swift_code": rng.choice(["KBZMMMY", "AYARMMMY", "CBAKMMMY"]),
         "currency": "MMK", "is_default": 1, "status": 1, "remark": "MMK 测试账户",
         "created_at": m["created_at"], "updated_at": m["created_at"]}
        for i, m in enumerate(mm_merchants)
    ])

    # ---- 商户登录账号(owner + 部分子账号)----
    mch_f.add("【MMK 仰光站】商户登录账号(口令 Merchant@123456)")
    mm_admins, maid = [], MMK_ADMIN_BASE
    for m in mm_merchants:
        mm_admins.append({
            "id": maid, "site_id": MMK_SITE, "account_type": 2, "merchant_id": m["id"],
            "group_id": 0, "store_id": 0, "username": f"m{m['id']}", "password": pw_m,
            "real_name": m["contact_name"], "mobile": c.encrypt(mm_phone()),
            "is_owner": 1, "role_perms": None, "status": 1 if m["status"] == 3 else 2,
            "last_login_at": m["last_login_at"], "auth_version": 1,
            "last_accepted_totp_step": -1, "two_fa_status": 0, "security_fail_count": 0,
            "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
        })
        maid += 1
    mm_sub_links: list[tuple[int, str]] = []
    for m in mm_enabled[:2]:
        mm_admins.append({
            "id": maid, "site_id": MMK_SITE, "account_type": 2, "merchant_id": m["id"],
            "group_id": 0, "store_id": 0, "username": f"m{m['id']}_ops", "password": pw_m,
            "real_name": mm_name(), "mobile": c.encrypt(mm_phone()),
            "is_owner": 0, "role_perms": None, "status": 1,
            "last_login_at": ctx.rand_dt(20), "auth_version": 1,
            "last_accepted_totp_step": -1, "two_fa_status": 0, "security_fail_count": 0,
            "created_at": m["created_at"], "updated_at": ctx.rand_dt(20),
        })
        mm_sub_links.append((maid, "merchant_ops"))
        maid += 1
    mch_f.insert(BIZ_DB, "merchant_admin", mm_admins)
    mch_f.insert(BIZ_DB, "merchant_admin_role",
                 [{"admin_id": a["id"], "role_id": 2} for a in mm_admins if a["is_owner"] == 1],
                 clean="admin_id >= 4001")
    for aid, role_code in mm_sub_links:
        mch_f.parts.append(
            f"INSERT IGNORE INTO `merchant_admin_role` (`admin_id`, `role_id`)\n"
            f"SELECT {aid}, `r`.`id` FROM `merchant_role` `r` "
            f"WHERE `r`.`is_builtin` = 1 AND `r`.`role_code` = '{role_code}' LIMIT 1;\n"
        )

    # ---- 商品 + 房型 + 库存 ----
    gds_f.add("【MMK 仰光站】商品(酒店)")
    mm_goods, gid = [], MMK_ID_BASE
    g_status = [3, 3, 3, 1, 4]
    for i, st in enumerate(g_status):
        m = mm_enabled[i % len(mm_enabled)]
        city, country, lat, lng = MM_CITY_POOL[i % len(MM_CITY_POOL)]
        mm_goods.append({
            "id": gid, "site_id": MMK_SITE, "merchant_id": m["id"], "supplier_id": 0,
            "goods_type": 1, "category_id": 0,
            "goods_name": f"{m['merchant_short_name']} - {rng.choice(MM_ROOM_NAMES)}",
            "goods_brief": f"{city} 市中心,近大金塔/湖景,设施完善。",
            "goods_detail": f"<p>{m['merchant_short_name']} 位于 {city},提供优质服务。</p>",
            "cover_image": f"https://cdn.mtrip.test/prod/goods/cover_{gid}.jpg",
            "images": json.dumps([f"https://cdn.mtrip.test/prod/goods/{gid}_{k}.jpg" for k in range(1, 4)],
                                 ensure_ascii=False),
            "address": m["address"], "longitude": m["longitude"], "latitude": m["latitude"],
            "star_level": rng.randint(3, 5),
            "facilities": json.dumps(["wifi", "parking", "pool", "gym"][:rng.randint(1, 4)]),
            "open_time": "00:00", "close_time": "23:59", "status": st,
            "audit_remark": "" if st in (0, 1) else ("审核通过" if st == 3 else "已下架"),
            "audit_by": 101 if st in (3, 4) else None,
            "audit_time": ctx.rand_dt(60) if st in (3, 4) else None,
            "sort_weight": rng.randint(1, 100), "is_recommend": 1 if i == 0 else 0,
            "is_hot": 1 if i == 1 else 0, "sales_count": rng.randint(0, 500),
            "created_at": ctx.ago(rng.randint(30, 200)), "updated_at": ctx.rand_dt(20),
        })
        gid += 1
    gds_f.insert(BIZ_DB, "goods_info", mm_goods)
    mm_enabled_goods = [g for g in mm_goods if g["status"] == 3]

    gds_f.add("【MMK 仰光站】酒店房型")
    mm_rooms, rid = [], MMK_ID_BASE
    for g in mm_enabled_goods:
        for k in range(2):
            base = money(rng.choice([80000, 120000, 180000, 250000, 350000]))
            mm_rooms.append({
                "id": rid, "site_id": MMK_SITE, "goods_id": g["id"],
                "room_name": rng.choice(MM_ROOM_NAMES), "room_code": f"RM{g['id']}{k}",
                "description": "宽敞舒适,含免费 WiFi。",
                "bed_type": rng.choice(["1张大床", "2张单人床"]), "bed_count": rng.randint(1, 2),
                "area": f"{rng.randint(24, 70)}㎡", "max_adults": rng.randint(2, 3),
                "max_children": rng.randint(0, 2), "max_guests": rng.randint(2, 4),
                "floor_name": f"{rng.randint(3, 15)}F", "room_view": rng.choice(["城市景观", "湖景", "花园景"]),
                "smoking": 0, "breakfast": rng.randint(0, 2),
                "meal_plan": rng.choice(["", "含双早"]),
                "cancellation_policy": "入住前 24 小时可免费取消",
                "checkin_notes": "请携带有效证件办理入住",
                "base_price": base, "base_price_citizen": money(base * Decimal("0.8")),
                "weekend_price": money(base * Decimal("1.25")), "extra_bed_price": money(30000),
                "base_stock": rng.randint(5, 30), "launch_stock": rng.randint(3, 20),
                "images": None, "video_url": "",
                "facilities": json.dumps(["wifi", "tv", "minibar", "safe"]),
                "status": 1, "publish_status": rng.choice([2, 2, 1, 0]),
                "submitted_at": ctx.rand_dt(60), "sort": k + 1,
                "created_at": g["created_at"], "updated_at": ctx.rand_dt(20),
            })
            rid += 1
    gds_f.insert(BIZ_DB, "hotel_room_type", mm_rooms)

    gds_f.add("【MMK 仰光站】库存价格日历(未来 14 天)")
    mm_stock, stid = [], 2000001
    for r in mm_rooms[:4]:
        base_date = ctx.now.date()
        for d in range(14):
            day = base_date + timedelta(days=d)
            weekend = day.weekday() >= 5
            p = money(r["base_price"] * (Decimal("1.25") if weekend else Decimal("1")))
            mm_stock.append({
                "id": stid, "site_id": MMK_SITE, "goods_id": 0, "sku_type": 1,
                "sku_id": r["id"], "stock_date": day, "price": p,
                "price_citizen": money(p * Decimal("0.8")), "stock_total": r["base_stock"],
                "stock_sold": rng.randint(0, max(1, r["base_stock"] // 3)),
                "stock_locked": rng.randint(0, 2), "is_closed": 0,
                "min_stay": 1, "max_stay": 30, "closed_to_arrival": 0,
                "closed_to_departure": 0, "source": "manual", "note": "",
                "created_at": ctx.ago(5), "updated_at": ctx.ago(1),
            })
            stid += 1
    gds_f.insert(BIZ_DB, "goods_daily_stock", mm_stock)

    # ---- 用户 ----
    usr_f.add("【MMK 仰光站】C 端用户(site_id=7,+959)")
    mm_users, uid = [], MMK_ID_BASE
    for i in range(6):
        mobile = mm_phone()
        status = rng.choices([1, 1, 1, 1, 2, 4], weights=[60, 10, 10, 10, 6, 4])[0]
        reg = ctx.ago(rng.randint(20, 300))
        mm_users.append({
            "id": uid, "site_id": MMK_SITE, "nickname": f"{rng.choice(MM_FIRST_NAME)} {rng.choice(MM_LAST_NAME)[:1]}.",
            "avatar": f"https://cdn.mtrip.test/prod/avatar/{uid}.png",
            "mobile": c.encrypt(mobile), "mobile_hash": c.mobile_hash(mobile),
            "email": c.encrypt(f"user{uid}@mtrip.test"), "password": pw_u,
            "register_source": rng.randint(1, 4), "register_time": reg,
            "last_login_at": ctx.rand_dt(30) if status == 1 else None,
            "last_login_ip": f"{rng.randint(1, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
            "member_level_id": ID_BASE, "member_expire_time": ctx.ago(-180),
            "balance": money(rng.choice([0, 0, 20000, 80000, 200000])), "points": rng.randint(0, 5000),
            "real_name_status": rng.choices([0, 1], weights=[55, 45])[0],
            "real_name": c.encrypt(mm_name()), "id_card": c.encrypt(f"MM{rng.randint(10000000, 99999999)}"),
            "user_status": status, "tags": json.dumps(["新客"], ensure_ascii=False),
            "remark": "MMK 测试数据", "referral_code": f"REF{uid:06d}",
            "created_at": reg, "updated_at": ctx.rand_dt(20),
        })
        uid += 1
    usr_f.insert(BIZ_DB, "user_info", mm_users)

    # ---- 订单 ----
    ord_f.add("【MMK 仰光站】订单(MMK 金额,状态铺开)")
    mm_orders, oid = [], MMK_ID_BASE
    o_status_plan = [1, 3, 3, 2, 0, 6, 5, 4, 1, 3]
    for i, st in enumerate(o_status_plan):
        g = mm_enabled_goods[i % len(mm_enabled_goods)]
        u = mm_users[i % len(mm_users)]
        m = next(x for x in mm_merchants if x["id"] == g["merchant_id"])
        sku = mm_rooms[i % len(mm_rooms)] if mm_rooms else None
        nights = rng.randint(1, 4)
        qty = 1
        unit = money(sku["base_price"] if sku else 120000)
        original = money(unit * qty * nights)
        discount = money(original * Decimal(rng.choice(["0", "0", "0.1"])))
        total = money(original - discount)
        rate = Decimal(str(m["commission_rate"])) / Decimal("100")
        commission = money(total * rate)
        created = ctx.rand_dt(90, 1)
        use_date = (created + timedelta(days=rng.randint(1, 30))).date()
        end_date = use_date + timedelta(days=nights)
        paid = st in (1, 2, 3, 5, 6)
        phone = mm_phone()
        mm_orders.append({
            "id": oid, "order_no": f"NO{created.strftime('%Y%m%d')}{oid:06d}",
            "site_id": MMK_SITE, "user_id": u["id"], "trip_id": 0, "order_type": 1,
            "is_citizen": 1 if rng.random() < 0.3 else 0, "merchant_id": m["id"],
            "supplier_id": 0, "goods_id": g["id"], "goods_name": g["goods_name"],
            "goods_image": g["cover_image"], "sku_id": sku["id"] if sku else 0,
            "sku_name": sku["room_name"] if sku else "标准", "quantity": qty,
            "unit_price": unit, "original_price": original, "total_amount": total,
            "discount_amount": discount, "longstay_discount": money(0), "coupon_id": 0,
            "coupon_discount": money(0), "alloc_coupon_discount": money(0),
            "points_discount": money(0), "pay_amount": total, "platform_fee": money(0),
            "platform_commission": commission, "merchant_receivable": money(total - commission),
            "supplier_cost": money(0), "pay_method": rng.choice([1, 2]) if paid else 0,
            "pay_trade_no": f"pi_{rng.randint(10 ** 15, 10 ** 16 - 1)}" if paid else "",
            "pay_time": created + timedelta(minutes=rng.randint(1, 30)) if paid else None,
            "order_status": st, "refund_status": {5: 1, 6: 3}.get(st, 0),
            "use_date": use_date, "end_date": end_date, "contact_name": mm_name(),
            "contact_phone": c.encrypt(phone),
            "guests": json.dumps([{"firstName": rng.choice(MM_FIRST_NAME),
                                   "lastName": rng.choice(MM_LAST_NAME),
                                   "phone": phone, "email": f"guest{oid}@mtrip.test"}],
                                 ensure_ascii=False),
            "verify_code": f"{rng.randint(100000000000, 999999999999)}",
            "cancel_reason": "用户主动取消" if st == 4 else "",
            "cancel_time": created + timedelta(hours=rng.randint(1, 48)) if st == 4 else None,
            "remark": "MMK 测试数据", "created_at": created,
            "updated_at": created + timedelta(hours=rng.randint(1, 24)),
        })
        oid += 1
    ord_f.insert(BIZ_DB, "order_main", mm_orders)

    # ---- 财务:税配置 / 资金流水 / 分录 / 结算 ----
    fin_f.add("【MMK 仰光站】税费配置")
    fin_f.insert(BIZ_DB, "finance_tax_config", [
        {"id": MMK_ID_BASE + i, "site_id": MMK_SITE, "tax_name": nm, "goods_type": gt,
         "tax_rate": money(rate), "calc_type": ct, "status": 1, "remark": "MMK 测试数据",
         "created_at": ctx.ago(200), "updated_at": ctx.ago(200)}
        for i, (nm, gt, rate, ct) in enumerate([
            ("缅甸商业税", 0, 0.0500, 1),
            ("仰光住宿税", 1, 0.0300, 1),
        ])
    ])

    mm_paid = [o for o in mm_orders if o["order_status"] in (1, 2, 3, 5, 6)]
    fin_f.add("【MMK 仰光站】资金流水")
    fin_f.insert(BIZ_DB, "finance_flow", [
        {"id": MMK_ID_BASE + i, "flow_no": f"FL{ctx.now.strftime('%Y%m%d')}{MMK_ID_BASE + i:06d}",
         "site_id": MMK_SITE, "flow_type": 1, "biz_type": 1, "amount": o["pay_amount"],
         "order_id": o["id"], "merchant_id": o["merchant_id"], "supplier_id": 0,
         "user_id": o["user_id"], "pay_channel": o["pay_method"] or 1,
         "trade_no": o["pay_trade_no"], "flow_status": 1, "remark": "订单支付",
         "operator_id": 0, "created_at": o["pay_time"] or o["created_at"]}
        for i, o in enumerate(mm_paid)
    ])
    fin_f.add("【MMK 仰光站】按订单结算分录")
    fin_f.insert(BIZ_DB, "finance_account_entry", [
        {"id": MMK_ID_BASE + i, "site_id": MMK_SITE, "order_id": o["id"], "order_no": o["order_no"],
         "merchant_id": o["merchant_id"], "coupon_id": 0, "order_amount": o["pay_amount"],
         "commission": o["platform_commission"], "discount_amount": o["discount_amount"],
         "funding_source": 1, "mtrip_pays": money(0), "merchant_pays": money(0),
         "partner_pays": money(0),
         "merchant_settlement": money(o["pay_amount"] - o["platform_commission"]),
         "platform_revenue": o["platform_commission"],
         "created_at": o["pay_time"] or o["created_at"]}
        for i, o in enumerate(mm_paid)
    ])
    fin_f.add("【MMK 仰光站】商户结算单")
    mm_settles, seid = [], MMK_ID_BASE
    for i, m in enumerate(mm_enabled):
        mos = [o for o in mm_paid if o["merchant_id"] == m["id"]]
        if not mos:
            continue
        order_amt = money(sum(o["pay_amount"] for o in mos))
        commission = money(sum(o["platform_commission"] for o in mos))
        refund_amt = money(sum(o["pay_amount"] for o in mos if o["order_status"] == 6))
        tax = money(commission * Decimal("0.05"))
        st = rng.choice([0, 1, 2])
        cycle = (ctx.now - timedelta(days=30 * (i % 2))).strftime("%Y-%m")
        mm_settles.append({
            "id": seid, "settle_no": f"ST{cycle.replace('-', '')}{seid:05d}",
            "site_id": MMK_SITE, "merchant_id": m["id"], "settle_cycle": cycle,
            "order_count": len(mos), "order_amount": order_amt, "refund_amount": refund_amt,
            "commission": commission, "tax_amount": tax,
            "settle_amount": money(order_amt - commission - tax - refund_amt), "status": st,
            "confirm_by": 103 if st in (1, 2) else None,
            "confirm_time": ctx.rand_dt(20) if st in (1, 2) else None,
            "pay_time": ctx.rand_dt(10) if st == 2 else None,
            "pay_voucher": f"https://cdn.mtrip.test/prod/voucher/{seid}.pdf" if st == 2 else "",
            "remark": "", "created_at": ctx.rand_dt(60, 20), "updated_at": ctx.rand_dt(10),
        })
        seid += 1
    fin_f.insert(BIZ_DB, "finance_merchant_settle", mm_settles)

    # ---- 营销:优惠券 ----
    mkt_f.add("【MMK 仰光站】优惠券(MMK)")
    mkt_f.insert(BIZ_DB, "marketing_coupon", [
        {"id": MMK_ID_BASE + i, "site_id": MMK_SITE,
         "merchant_id": mm_enabled[i % len(mm_enabled)]["id"] if i == 0 else 0,
         "created_by_merchant_admin": 0, "coupon_name": nm, "coupon_type": ct,
         "discount_value": money(val), "min_amount": money(minv),
         "max_discount": money(val if ct != 2 else 50000),
         "funding_source": 1, "funding_rules": json.dumps({"mtrip": 100, "merchant": 0, "partner": 0}),
         "goods_scope": 0, "goods_ids": None, "total_count": 1000, "received_count": rng.randint(0, 600),
         "used_count": rng.randint(0, 300), "per_user_limit": 1, "valid_type": 1,
         "valid_start": ctx.ago(30), "valid_end": ctx.ago(-60), "valid_days": 30,
         "status": 1, "remark": "MMK 测试数据", "created_at": ctx.ago(40), "updated_at": ctx.rand_dt(10)}
        for i, (nm, ct, val, minv) in enumerate([
            ("仰光新客立减 2 万", 3, 20000.00, 0.00),
            ("住宿满 15 万减 3 万", 1, 30000.00, 150000.00),
        ])
    ])


# ============================================================================
# 六、主流程
# ============================================================================

def read_aes_key_from_env_file(repo_root: str) -> str | None:
    path = os.path.join(repo_root, "deploy", ".env")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if line.startswith("MTRIP_AES_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    return None


def main() -> int:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_key = os.environ.get("MTRIP_AES_KEY") or read_aes_key_from_env_file(repo_root) or ""

    ap = argparse.ArgumentParser(description="生成 Mtrip admin-web 测试数据 SQL")
    ap.add_argument("--scale", choices=["small", "medium", "large"], default="medium",
                    help="数据规模(默认 medium)")
    ap.add_argument("--out-dir", default=os.path.join(repo_root, "test", "sql"),
                    help="SQL 输出目录")
    ap.add_argument("--aes-key", default=default_key,
                    help="AES 密钥,必须与运行环境的 MTRIP_AES_KEY 一致")
    ap.add_argument("--seed", type=int, default=20260830, help="随机种子(保证可复现)")
    args = ap.parse_args()

    scale = {"small": 0.4, "medium": 1.0, "large": 2.0}[args.scale]
    crypto = Crypto(args.aes_key)
    rng = random.Random(args.seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ctx = Ctx(crypto, rng, scale, now)

    files: list[SqlFile] = []
    sys_f = SqlFile("系统域:管理员 / 角色 / 日志 / 平台配置", SYSTEM_DB)
    mch_f = SqlFile("商户域:集团 / 商户 / 门店 / 入驻 / 资质 / 排名", BIZ_DB)
    gds_f = SqlFile("商品域:分类 / 商品 / 房型 / 票种 / 库存 / 评价", BIZ_DB)

    # 商品域依赖商户,用户域依赖商品,订单域依赖用户+商品
    build_system(ctx, sys_f)
    build_merchant(ctx, mch_f)
    build_goods(ctx, gds_f)

    usr_f = SqlFile("用户域:C 端用户 / 会员 / 风控 / 会话", BIZ_DB)
    build_user(ctx, usr_f)

    ord_f = SqlFile("订单域:订单 / 退款 / 核销 / Trip", BIZ_DB)
    build_order(ctx, ord_f)

    fin_f = SqlFile("财务域:资金流水 / 结算 / 提现 / 分账", BIZ_DB)
    build_finance(ctx, fin_f)

    mkt_f = SqlFile("营销域:优惠券 / 活动 / Banner / 促销码", BIZ_DB)
    build_marketing(ctx, mkt_f)

    aff_f = SqlFile("达人域:合作方 / 申请 / 折扣码 / 佣金 / 反欺诈", BIZ_DB)
    build_affiliate(ctx, aff_f)

    cpl_f = SqlFile("合规域:平台规则 / 违规 / 警告 / 审计", BIZ_DB)
    build_compliance(ctx, cpl_f)

    sup_f = SqlFile("供应商域:供应商 / 供货商品 / 结算", BIZ_DB)
    build_supplier(ctx, sup_f)

    ph_f = SqlFile("物业关联历史", BIZ_DB)
    build_property_history(ctx, ph_f)

    hc_f = SqlFile("帮助中心:分类 / FAQ / 公告", SYSTEM_DB)
    build_helpcenter(ctx, hc_f)

    # 缅甸(MMK)市场:把 site_id=7 的跨域样例追加进对应域文件(用于多币种/站点隔离验证)
    build_mmk_market(ctx, mch_f, gds_f, usr_f, ord_f, fin_f, mkt_f)

    files = [sys_f, mch_f, gds_f, usr_f, ord_f, fin_f, mkt_f, aff_f, cpl_f, sup_f, ph_f, hc_f]

    os.makedirs(args.out_dir, exist_ok=True)

    # ---- 00-clean.sql:按保留 ID 段删除,不碰种子数据 ----
    clean_lines = [
        "-- ============================================================",
        "-- 清理本脚本生成的测试数据",
        "-- 只删除测试保留 ID 段内的行(商户/用户等 >=1001,系统配置类 >=101),",
        "-- 不会触碰 database/seed/ 下的种子数据(菜单、角色、KYC 模板、站点等)。",
        "-- ============================================================",
        "SET NAMES utf8mb4;",
        "",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]
    all_clean: dict[str, str] = {}
    for fl in files:
        all_clean.update(fl.clean)
    cur_db = None
    for key in sorted(all_clean):
        db, table = key.split(".", 1)
        if db != cur_db:
            clean_lines.append(f"USE `{db}`;")
            clean_lines.append("")
            cur_db = db
        clean_lines.append(f"DELETE FROM `{table}` WHERE {all_clean[key]};")
    clean_lines += ["", "SET FOREIGN_KEY_CHECKS = 1;", ""]
    with open(os.path.join(args.out_dir, "00-clean.sql"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(clean_lines))

    # ---- 各域 SQL ----
    total_rows = 0
    for i, fl in enumerate(files, start=1):
        name = f"{i:02d}-{fl.name.split(':')[0].strip()}.sql"
        path = os.path.join(args.out_dir, name)
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(fl.render())
        rows = sum(p.count("INSERT INTO") for p in fl.parts)
        total_rows += rows
        print(f"  写入 {name:<28} {rows:>3} 条 INSERT 语句")

    print()
    print(f"完成:规模={args.scale}  密钥={args.aes_key[:8]}...(来自 deploy/.env)")
    print(f"输出目录: {args.out_dir}")
    print(f"共 {len(files)} 个数据文件 + 1 个清理脚本")

    # ---- 校验清单:供 verify_testdata.php 抽样回解 ----
    manifest = {
        "aes_key": args.aes_key,
        "samples": [
            {"db": db, "table": tbl, "id": _id, "col": col, "plaintext": pt}
            for (db, tbl, _id, col), pt in ctx.verify_samples.items()
        ],
    }
    with open(os.path.join(args.out_dir, ".verify_manifest.json"), "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
    print("  已写入 .verify_manifest.json(校验样本)")
    print()
    print("下一步:")
    print(f"  test/apply.sh            # 先清理再导入")
    print(f"  php test/verify_testdata.php   # 用后端同款解密算法抽样校验")
    return 0


if __name__ == "__main__":
    sys.exit(main())
