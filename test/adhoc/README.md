# test/adhoc — 一次性联调 fixture(非生成器产物)

本目录收纳模块 4(商户入驻 / 账号安全 / 到期)联调期手写的一次性脚本
(`m4-*.sql` / `m4-*.php` / `m4-*.ps1`)。

- 它们**不是** `gen_testdata.py` 的产物,也**不被** `apply.sh` 导入
  (`apply.sh` 只导入 `sql/` 下匹配 `^[0-9]+-.*\.sql$` 的域文件)。
- 写死了具体 id / 断言,仅用于当时定位问题,**不保证与当前 schema/数据一致**。
- 需要复现某个 M4 场景时可参考,但请先确认表结构未变;`m4-*-cleanup*.sql`
  会 DELETE 特定行,人工执行前务必核对。

> 正式、可复现的测试数据请用 `test/gen_testdata.py` + `test/sql/`。
