# TikTok Web login verification

```sh
python3 test/tiktok/integration.py
```

Requires the existing local Docker stack. The suite creates random `tiktok_qa_*` schemas and a restricted DB user, starts a temporary user-service with a test-only TikTok adapter, and tracks individual credentials in Redis DB 14. `finally` removes the container, schemas, DB user and tracked keys. No real TikTok request, normal user change, or SMS is performed. Run the Facebook suite as well when changing the shared account methods.

The real TikTok adapter and configuration checks are covered by `backend/shared/tests/cases/TikTokClientTest.php` and `TikTokLoginSettingsTest.php` in the standard shared suite. They check opaque open IDs, token/profile agreement, minimal scope, expiry and missing configuration.

See [implementation, configuration and pending real authorization checks](../../docs/plans/23-TikTok-Web登录实施记录.md). Production has no mock switch or test endpoint.
