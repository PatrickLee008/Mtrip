# supplier-web 供应商后台

本期占位,未开发。规划:供应商自助后台(供货商品维护、供货单、对账结算),与商家后台(merchant-web)完全独立:

- 账号体系独立:未来新建 `supplier_admin` 表(登录+权限),实体信息仍在 `supplier_info`
- 权限体系独立:供应商域权限键与商家域互不复用
- 业务域不同:供货/对账/结算,无商品销售、核销、集团、门店概念

技术选型将沿用 admin-web 同栈(Vue3 + Vite + TS + Ant Design Vue),开发时参照 `docs/plans/HANDOFF.md` 第 5 节前端页面代码模式。
