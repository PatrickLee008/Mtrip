# test/adhoc — 一次性联调 fixture(非生成器产物)

本目录收纳模块 4(商户入驻 / 账号安全 / 到期)联调期手写的一次性脚本
(`m4-*.sql` / `m4-*.php` / `m4-*.ps1`)。

- 它们**不是** `gen_testdata.py` 的产物,也**不被** `apply.sh` 导入
  (`apply.sh` 只导入 `sql/` 下匹配 `^[0-9]+-.*\.sql$` 的域文件)。
- 写死了具体 id / 断言,仅用于当时定位问题,**不保证与当前 schema/数据一致**。
- 需要复现某个 M4 场景时可参考,但请先确认表结构未变;`m4-*-cleanup*.sql`
  会 DELETE 特定行,人工执行前务必核对。

> 正式、可复现的测试数据请用 `test/gen_testdata.py` + `test/sql/`。

## M8 演示数据(`m8-promotion-demo.sql`)

开发库没有已知密码的商户账号,`merchant-web` 的 `/promotions`、`/campaigns`、`/promotions/analytics`
在没有数据时只能看到空态。`m8-promotion-demo.sql` 往开发库现有商户 6 / 物业 7(site 7)插入一批
带 `[M8 Demo]` / `DEMO` 记号的促销、曝光、领券、结算、平台活动与券码镜像,覆盖稿面
WELCOME26 / VIP5000 / SUMMER20 / LOYALTY10 / NEWYEAR 与 Early Bird / Stay 3 Nights 卡片样例。

**导入**(幂等,可重复执行):

```bash
docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026 --default-character-set=utf8mb4 < test/adhoc/m8-promotion-demo.sql
```

**清空**:

```bash
docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026 -e "USE mtrip_business;
DELETE FROM marketing_promotion_impression WHERE coupon_id IN (SELECT id FROM marketing_coupon WHERE coupon_name LIKE '[M8 Demo]%');
DELETE FROM finance_account_entry WHERE coupon_id IN (SELECT r.id FROM marketing_coupon_receive r JOIN marketing_coupon c ON c.id=r.coupon_id WHERE c.coupon_name LIKE '[M8 Demo]%');
DELETE FROM marketing_coupon_receive WHERE coupon_id IN (SELECT id FROM marketing_coupon WHERE coupon_name LIKE '[M8 Demo]%');
DELETE FROM marketing_promo_code WHERE coupon_id IN (SELECT id FROM marketing_coupon WHERE coupon_name LIKE '[M8 Demo]%');
DELETE FROM marketing_coupon WHERE coupon_name LIKE '[M8 Demo]%';
DELETE FROM marketing_campaign_participant WHERE campaign_id IN (SELECT id FROM marketing_campaign WHERE title LIKE '[M8 Demo]%');
DELETE FROM marketing_campaign WHERE title LIKE '[M8 Demo]%';"
```

⚠ 与上文的 `m4-*` 一样:写给具体 id,不登记 `deploy/docker-compose.yml` 的 initdb 挂载列表,
也不被 `apply.sh` 导入,不属于发布包。`test/sql/07-营销域.sql` 才是正式、可复现的营销测试数据。
