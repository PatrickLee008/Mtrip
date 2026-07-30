# merchant-web 商家后台

本期占位,未开发。规划:集团/商户/门店三类账号共用的商家自助后台(商品维护、订单处理、核销、结算对账),登录后按账号类型(merchant_admin.account_type)决定菜单与数据范围:

- 集团账号:跨绑定商户的聚合查看与报表
- 商户账号:本商户全量功能
- 门店账号:本门店核销、接单等履约子集

供应商后台独立于本项目,见 `supplier-web/`。

技术选型将沿用 admin-web 同栈(Vue3 + Vite + TS + Ant Design Vue),开发时参照 `docs/plans/HANDOFF.md` 第 5 节前端页面代码模式。
