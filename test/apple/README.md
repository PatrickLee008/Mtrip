# Apple Web login verification

```sh
python3 test/apple/integration.py
```

Requires the existing local Docker stack. Creates random `apple_qa_*` schemas, a restricted database user and a throwaway user-service, using tracked Redis DB 14 keys. The test-only Apple adapter does not call Apple or use the real private key. Finally removes its test container, schemas, DB user and tracked keys. Normal users, schemas and SMS providers are untouched.

The standard `backend/shared/tests/run.php` suite covers AppleClient RSA token validation, ES256 client-secret signatures with generated keys, authorization parameters and fail-closed configuration. Run Facebook and TikTok integration suites after shared account changes.

HTTP tests manually send cookies. They verify response attributes, state/nonce wiring, replay/binding/account behavior and encrypted persistence; browser delivery of Secure/SameSite=None on a real Apple cross-site POST requires a separate HTTPS round trip. A test adapter success does not establish real Apple OAuth success.

Before release, use the registered HTTPS domain with same-origin API and real server-only key. Verify actual Apple consent/cancel, form_post Cookie delivery, first name/email and private relay, subsequent login without profile, session restoration and refresh/expired behavior. No mock switch or QA endpoint exists in production code.

See [implementation and deployment instructions](../../docs/plans/24-Apple-Web登录实施记录.md).
