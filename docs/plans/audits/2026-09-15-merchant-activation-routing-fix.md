# 商户首次激活 404 与待激活登录提示修复

## 原因

- 商户 Web 请求 `/api/v1/merchant/activation/*`，后端已声明全部 8 个接口，但 OpenResty 的 `$merchant_module → $merchant_upstream` 映射遗漏 `activation`。请求在网关即返回 `40400/resource not found`，没有到达后端。修复前经 `http://127.0.0.1:5174` 实际复现 HTTP 404。
- 用户账号 `m000006` 为正常待激活状态：账号 status=2、申请 account_status=1、商户 status=1，未锁定。旧密码登录只查 status=1，返回“账号已失效”；普通访问码登录只允许已激活且关联 Authenticator 的账号，不能代替首次激活。
- 前次测试覆盖了服务和认证配置代理，但未覆盖 merchant-web 首次激活写请求的网关映射，因而遗漏此问题。

## 修复

- 网关登记 `activation merchant_service`，已执行 `nginx -t` 并热加载。
- 待激活主账号输入有效一次性密码进行普通登录时，明确提示到首次激活页面操作；访问码普通登录识别待激活申请并给出相同指引。仍不直接授予登录态。
- 未更改密码、访问码或激活门禁，不修改商户 App/用户 App。测试模式 `000000` 继续有效，但应在首次激活页面请求邮箱或短信 OTP 后使用。

## 验证

- 新增 `scripts/test-merchant-activation-routing.py`，默认通过商户 Web `5174` 检查全部 8 个激活接口；可用 `MTRIP_TEST_BASE_URL=http://127.0.0.1:8081` 检查网关。请求只包含空参数，验证正确业务错误码，避免修改账号。
- 商户 Web 与网关两条路径共 16 项路由检查通过，涵盖 start/profile、OTP、Authenticator、Google 和 finish，均到达控制器而非 404。
- 隔离认证测试 44 项通过，含新增待激活密码/访问码指引及原有激活、登录、OTP 测试模式和生产禁用检查。
- 对当前账号从加密投递记录读取原凭证，在容器内按商户 Web 的 AES-CBC 方式加密，通过真实 `5174 → 网关 → merchant-service` 请求：普通密码及访问码登录返回明确的 40901 激活提示；用户名＋临时密码、访问码两次 activation/start 均返回 code=0，账户匹配。
- 当前账号和申请仍待激活、原密码有效，没有执行 OTP 验证或 finish；本次生成的两个临时身份验证上下文已失效处理。验证代码未输出密码、访问码或 Token，临时脚本已清理。

用户现在刷新商户 Web，进入 `/activate`，使用原有任一激活方式继续即可。激活后若未关联 Authenticator，应选择邮箱 OTP 登录。
