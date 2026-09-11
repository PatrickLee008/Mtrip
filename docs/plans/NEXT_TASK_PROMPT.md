# 下一步任务提示词：Merchant App 首次扫码绑定与本机快速解锁

继续完成 `merchant-app` 的首次 2FA 扫码绑定和本机生物识别快速解锁。先阅读根 `AGENTS.md`、`docs/plans/HANDOFF.md`、`backend/services/AGENTS.md` 与当前未提交改动；不要回退其他任务的修改。

已有基础：`MerchantAccountSecurityService` 已有 Access Code challenge、`createAppPairing()`、`exchangeAppPairing()`。配对二维码必须是 Redis 中 120 秒有效、原子一次性消费的随机不透明值；二维码和日志绝不能包含 JWT、Merchant Access Code、TOTP secret 或明文 challenge token。M9-M11 Access Code -> setup -> verify 已接真实接口。`expo-camera`、`expo-local-authentication`、`expo-secure-store` 已安装，但尚未启用真实相机或生物识别。

任务：

1. merchant-web 在首次 2FA enrollment 的 Web challenge 有效期内调用 `POST /api/v1/merchant/auth/2fa/pairing/create`，显示 `mtripmerchant://2fa/pair/{pairingCode}` 二维码并明确 120 秒有效；保留手动 Authenticator 设置作为兜底。
2. merchant-app 的 Figma `839:6224` 扫码页申请相机权限，用 `expo-camera` 读取 QR，严格验证 scheme/path/code 格式后调用 `POST /api/v1/app/merchant/auth/2fa/pairing-exchange`。只在成功后进入 setup/verify；失效、重复或非法码必须停留当前页提示。保留 Figma 2 秒扫描线、边框呼吸和 reduced-motion 降级。
3. 完成 Figma `1603:13873`：仅在本机使用 `expo-local-authentication`；使用 `expo-secure-store` 保存会话和非敏感启用标记，使后续启动必须本机解锁。不得上传、日志记录或放入 AsyncStorage：生物信息、TOTP secret、Access Code、配对码。Web 端优雅降级为稍后设置；退出必须清除 SecureStore 会话和开关。
4. 更新原生权限/插件配置。新增后端接口时，显式写入 `config/routes.php`，统一响应 `{code,message,data}`；安全状态变更复用 account/auth_version/challenge 校验。
5. 同步 API 契约、`17-商户移动端merchant-app.md`、plans README、HANDOFF、根 README；不要把未实现能力写成已完成。
6. 验证：`npm run typecheck --prefix merchant-app`、`npm run build:web --prefix merchant-app`、`npm run build --prefix merchant-web`、可用时 PHP 8.1 容器 lint、`bash scripts/db-migrate.sh --validate`、`git diff --check`；删除生成的 `merchant-app/dist`。
