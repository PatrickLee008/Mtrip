# Mtrip admin-web 测试手册与测试数据

本目录用于 **在不污染种子数据的前提下**,为 `admin-web` 管理后台生成一批可复现的测试数据,
并提供导入 / 清理 / 密文校验脚本。测试数据全部使用 **保留 ID 段**,与 `database/seed/` 下的
种子数据(菜单、角色、KYC 模板、站点等)**互不冲突**,可随时一键清空。

> 本目录是「测试脚手架」,不是业务代码,请勿纳入发布包。

---

## 1. 目录结构

```
test/
├── gen_testdata.py        # 测试数据生成器(Python,复刻后端加密算法)
├── validate_testdata.py   # 列名/约束静态校验(导入前自检)
├── apply.sh               # 一键清理 + 导入
├── verify_testdata.php    # 用后端同款算法抽样回解密文/校验口令
├── sql/                   # 生成的 SQL
│   ├── 00-clean.sql       #   清理脚本(只删保留 ID 段)
│   ├── 01-系统域.sql
│   ├── 02-商户域.sql
│   ├── ...                #   各业务域,共 12 个数据文件
│   └── .verify_manifest.json  # 校验样本(明文),供 verify_testdata.php 使用
└── README.md              # 本手册
```

---

## 2. 环境依赖

| 依赖 | 用途 | 说明 |
|---|---|---|
| Python 3.10+ | 生成器 | 需 `cryptography` + `bcrypt`,安装:`pip install cryptography bcrypt`(必要时加 `--break-system-packages`) |
| PHP 7.4+ | 密文校验 | 需 `openssl` 扩展(`aes-256-gcm`) |
| MySQL 客户端 | 导入 | 连 `127.0.0.1:3307` |
| 运行库 | 读写 | `mtrip_system` / `mtrip_business` 已存在且已 seed |

连接参数取自 `deploy/.env` 的 `DB_*`,也可被环境变量 `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD` 覆盖。

---

## 3. 使用流程

### 3.1 生成 SQL(可选,SQL 已随仓库生成好)

```bash
# 默认 medium 规模;可选 small(0.4x) / large(2x)
python3 test/gen_testdata.py --scale medium
```

生成前会读取 `deploy/.env` 的 `MTRIP_AES_KEY`,**必须与该值一致**,否则 admin-web 无法解密。

### 3.2 导入 / 清理

```bash
bash test/apply.sh            # 先清理(id>=保留段)再导入全部测试数据
bash test/apply.sh clean      # 只清理,不导入
bash test/apply.sh import     # 只导入(不清空,重复导入可能触发唯一键冲突)
```

### 3.3 自动化校验(强烈建议导入后执行)

```bash
# 1) 列名/约束静态校验(无需连库以外的特殊权限)
python3 test/validate_testdata.py

# 2) 密文与口令抽样回解(证明 admin-web 能正确渲染加密字段)
php test/verify_testdata.php
```

`verify_testdata.php` 会:
- 用与 `backend/shared/src/Support/CryptoHelper.php` **完全相同**的 AES-256-GCM 算法,
  回解 `sys_storage / sys_pay_channel / sys_sms_channel / sys_map_config / sys_client`
  的密钥类字段,确认与生成时明文一致;
- 按 `UserAuthService::mobileHash` / `MerchantPhoneIndex` 的算法,校验
  `user_info.mobile_hash`、`merchant_info.contact_phone_index` 的 HMAC;
- 用 `password_verify` 校验 `sys_admin / merchant_admin / user_info / supplier_admin`
  的 bcrypt 口令(已知明文)。

全部通过即代表:测试数据的加密列可被后端正确解密,admin-web 能正常展示脱敏/明文。

---

## 4. 测试账号与口令

### 4.1 后台管理员(sys_admin)

| 用户名 | 口令 | 站点(site_id) | 角色 | 备注 |
|---|---|---|---|---|
| `site_admin` | `Admin@123456` | 4(巴黎) | 站点管理员 | 全权限,用于验证站点隔离 |
| `operator` | `Admin@123456` | 4 | 运营专员 | 商户审核 + 订单运营 |
| `finance` | `Admin@123456` | 4 | 财务专员 | 结算 / 对账 / 提现 |
| `support` | `Admin@123456` | 4 | 客服专员 | 用户 / 会话 / 帮助 |
| `auditor` | `Admin@123456` | 0(全平台) | 只读审计员 | 全菜单只读 |
| `fr_admin` | `Admin@123456` | 3(法国) | 站点管理员 | 跨站点隔离对比 |
| `disabled_admin` | `Admin@123456` | 4 | 已禁用 | status=2,验证禁用账号不可登录 |

> 角色 `101~105` 已通过 `sys_role_menu` 按菜单 ID 段批量授予菜单权限;
> 验证「菜单权限」时切换不同账号即可看到不同左侧菜单。

### 4.2 商户后台(merchant_admin)

- 用户名:`m{merchant_id}`(如 `m1001`、`m1002` …)
- 口令:`Merchant@123456`
- 仅 `merchant_info.status = 3`(已启用)的商户账号 `status=1` 可登录;其余为禁用态(`status=2`)。
- 推荐用 `m1001`(首条商户,status=3)登录验证。

### 4.3 C 端用户(user_info)

- 登录手机号:测试数据中的 `+3362xxxxxxx`(库内 AES 加密存储,后台列表脱敏展示)。
- 口令:`User@123456`(用于「用户详情 / 登录态」类联调)。

### 4.4 供应商后台(supplier_admin)

- 用户名:`s{supplier_id}`(如 `s1001` … `s1005`)
- 口令:`Supplier@123456`

---

## 5. 数据覆盖范围(状态分布,适合逐 Tab 验证筛选)

| 模块 | 状态字段 | 覆盖值 | 行数(medium) |
|---|---|---|---|
| 商户 merchant_info | status | 0 待审 / 1 通过 / 2 驳回 / 3 启用 / 4 禁用 / 5 注销 / 6 待重提 | 0–6 全覆盖(共 24) |
| 订单 order_main | order_status | 0–7 全覆盖 | 73 |
| 商品 goods_info | status | 0–5 全覆盖 | 20 |
| 用户 user_info | user_status | 1 正常 / 2 冻结 / 3 注销 / 4 拉黑 | 1–4 全覆盖(40) |
| 优惠券 / 退款 / 结算 / 供应商 / 达人 / 合规 / 帮助 | 各自状态 | 均覆盖枚举全值域 | 见各域 SQL |

> 每张表的 `site_id` 已混入 `0`(超管全局)与 `1/3/4`(具体站点),便于验证站点隔离。

---

## 6. admin-web 分模块测试清单

> 通用预期:列表可分页(`data={list,total,page,pageSize}`)、可按状态/站点筛选、
> 响应结构 `{code:0,message,data}`、加密字段(手机/证件/密钥)列表脱敏、详情可解密展示。

### 6.1 系统管理
- [ ] 管理员列表:用 `site_admin`/`auditor` 分别登录,验证左侧菜单与按钮(`v-perm`)差异
- [ ] 角色管理:编辑 `operator(102)` 的菜单权限,保存后重新登录生效
- [ ] 菜单管理:对照 `sys_menu`(258 条种子)展示树形结构
- [ ] 操作日志 / 登录日志 / API 访问日志:列表 + 时间筛选
- [ ] 站点配置 / 特性开关(`sys_feature_flag` 站点 4 覆盖全局):开关切换后前端表现变化
- [ ] 存储 / 支付 / 短信 / 地图 / 客户端密钥:详情页 `access_key`/`client_secret` 等**可解密显示**,
      列表页**脱敏**(验证 `verify_testdata.php` 已通过即代表密文正确)

### 6.2 商户管理
- [ ] 商户列表:按 `status`(0–6)、站点、`merchant_type` 筛选;点击启用态商户可进商户后台
- [ ] 入驻申请:按 `stage 1~6` 走审核流(通过/驳回/打回重提)
- [ ] 资质文档:按 `status 1~5` 查看审核态;查看文档时 `legal_id_card` 解密展示
- [ ] 市场排名 / 黑名单 / 代入会话 / 访问码日志:列表与详情
- [ ] 站点隔离:用 `site_admin`(站点 4)看不到站点 3 的商户;`fr_admin` 反之

### 6.3 商品
- [ ] 商品列表:按 `status 0~5`、`business_type`(酒店/门票/综合)筛选
- [ ] 酒店房型 / 门票票种 / 每日库存(30 天日历)/ 退改规则 / 库存流水
- [ ] 商品评价:按 `0 待审 / 1 显示 / 2 隐藏` 审核

### 6.4 用户
- [ ] 用户列表:按 `user_status 1~4` 筛选;手机号脱敏,详情解密
- [ ] 会员等级 / 余额流水 / 积分流水 / 常用出行人
- [ ] 风控:欺诈标记 / 黑名单 / 申诉;冻结/拉黑后登录态变化
- [ ] 客服会话 / 反馈:列表与处理

### 6.5 订单
- [ ] 订单列表:按 `order_status 0~7` 筛选;查看 Trip 行程(`order_trip`)、明细
- [ ] 退款单:按 `status 0~5` 审核
- [ ] 核销:核销设备 / 规则 / 核销日志;用设备侧模拟核销

### 6.6 财务
- [ ] 资金流水 `finance_flow`、分账流水
- [ ] 商户结算 `finance_merchant_settle`:按 `status 0~3`(待结算/结算中/已结算/异常)
- [ ] 提现 `finance_withdraw`:按 `status 0~4` 审核
- [ ] 税率配置

### 6.7 营销
- [ ] 优惠券 `marketing_coupon`(0 待生效/1 生效/2 失效/3 作废)+ 领取记录
- [ ] 活动 / Banner / 促销码 / 积分规则 / 长住梯度

### 6.8 达人
- [ ] 合作方 `affiliate_partner`、入驻申请、折扣码、佣金流水、反欺诈标记

### 6.9 合规
- [ ] 平台规则、违规记录(`violation`)、警告、审计历史

### 6.10 供应商
- [ ] 供应商列表 `supplier_info`(0~3)、供货商品、结算账户;用 `s1001`/`Supplier@123456` 登录供应商后台

### 6.11 帮助中心
- [ ] 分类 / FAQ 文章(`help_article` 状态 1~3)/ 公告(1 生效/2 待生效/3 过期/4 草稿)/ 搜索日志

---

## 7. 关键约定与陷阱(务必阅读)

1. **加密列布局**:AES-256-GCM,密文 = `base64(IV[12] || TAG[16] || CIPHERTEXT)`,
   密钥 = `raw sha256(MTRIP_AES_KEY)`。生成器与 `verify_testdata.php` 均严格复刻
   `backend/shared/src/Support/CryptoHelper.php`,**不要用别的 AES 模式**。
2. **检索哈希**:`user_info.mobile_hash = HMAC-SHA256(mobile, key)`(hex),
   列上有 `UNIQUE(site_id, mobile_hash)`——每个站点最多一行空值,生成器已保证唯一。
   `merchant_info.contact_phone_index = HMAC-SHA256('m12-phone-v1:'+归一化手机, key)`。
3. **口令**:`password_hash($p, PASSWORD_BCRYPT)`,无 pepper,统一 `$2y$` 前缀。
4. **站点隔离**:`site_id=0` 为超管全局;普通管理员/商户强制本站点。测试数据已混入多站点用于验证。
5. **GENERATED 列禁止手工 INSERT**:如 `merchant_application.active_reg_number`、
   `merchant_blacklist.active_merchant_id`,由数据库自动计算,生成器已省略。
6. **分表未实现**:`order_main` / `finance_flow` / `sys_api_access_log` 虽在 DDL 注释里写
   「按月分表」,但后端运行态使用未加后缀的表名,数据已写入未后缀表。
7. **保留 ID 段**:业务表 `>= 1001`、系统配置类 `>= 101`、商户后台账号 `>= 4001`;
   `00-clean.sql` 只删这些段,**不会动种子数据**。重复执行 `apply.sh` 安全。
8. **入驻申请商户编号**:所有 `merchant_application` 测试记录都必须有唯一 `merchant_code`。
   尚未转正式商户的阶段使用独立的 `MCH-5xxx` 编号段且 `merchant_id=0`;阶段 5 必须关联
   同 ID 的 `merchant_info`,并保持两表 `merchant_code`、`site_id` 一致,避免批准时唯一键冲突。

---

## 8. 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| `verify_testdata.php` 解密 [FAIL] | `MTRIP_AES_KEY` 与运行环境不一致 → 用正确的 `--aes-key` 重新生成并导入 |
| 导入报 `Duplicate entry ... PRIMARY` | 多半是生成器重复 id(已修复);可先 `bash test/apply.sh clean` 再重导 |
| 列表看不到某模块数据 | 确认用对应站点/角色账号登录;检查 `site_id` 过滤 |
| 加密字段显示为空/乱码 | 后端解密失败,优先核对 `MTRIP_AES_KEY` 与密文布局 |

---

生成与校验命令速记:

```bash
python3 test/gen_testdata.py --scale medium
python3 test/validate_testdata.py
bash test/apply.sh
php test/verify_testdata.php
# 清理:
bash test/apply.sh clean
```
