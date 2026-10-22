# Facebook Web login verification

## Automated checks

```bash
python3 test/facebook/integration.py
npm run typecheck --prefix client-app
npm run build:web --prefix client-app
```

The HTTP suite requires the existing local Docker stack. It clones only table structures into random `facebook_qa_*` schemas, creates a restricted temporary database user and user-service container, and uses Redis DB 14 with individual random credentials. `finally` removes its container, schemas, DB user and tracked Redis keys. It never changes normal users, sends SMS, or calls Facebook. The temporary service injects a fake Facebook transport through a copied test-only DI configuration; production has no mock flag or mock endpoint.

Tests cover migration preflight/idempotency, policy configuration, allowed HTTPS origins, site validity, consent version, cookie attributes, state/browser binding and TTL, cancellation, provider failure, ticket/browser/site binding and atomic consumption, usable Mtrip JWT/profile, two phone-less users, nickname preservation, concurrent identity uniqueness/transaction rollback, restricted/deleted users, and phone/password/SMS-ticket regressions. SMS tickets are synthetic; no SMS is sent.

`backend/shared/tests/cases/FacebookClientTest.php` tests the real provider adapter with transport responses replaced, including app ID, subject, permissions and expiration verification. `FacebookLoginSettingsTest.php` verifies disabled/incomplete configuration fails closed. Run with the standard shared suite.

## Real browser acceptance (pending)

1. Resolve the existing migration history issue through the documented audited migration process, back up, then apply `database/migrations/V20261021010000__add-facebook-user-identities.sql` with `scripts/db-migrate.sh`. Do not skip its out-of-order protection.
2. Provide the real Terms and Privacy Policy HTTPS URLs; no placeholder text or test URLs may be substituted for actual consent.
3. Prepare a Meta-accepted HTTPS development origin with a browser-trusted certificate. Proxy H5 and `/api/v1/app/*` plus the exact `/api/v1/auth/facebook/callback` under that origin. If using a tunnel, restrict the upstream proxy to these consumer routes; do not expose administrative APIs, MySQL, Redis or private uploads.
4. Set the backend variables below in ignored `deploy/.env`; the App Secret is already supplied locally. Keep secrets out of chat, command output and the frontend.

```dotenv
MTRIP_FACEBOOK_ENABLED=true
MTRIP_FACEBOOK_APP_ID=2501430997012589
MTRIP_FACEBOOK_APP_SECRET=<existing server-side value>
MTRIP_FACEBOOK_GRAPH_VERSION=v24.0
MTRIP_FACEBOOK_WEB_ORIGINS=https://<actual-development-host>
MTRIP_FACEBOOK_TERMS_URL=https://<actual-policy-host>/terms
MTRIP_FACEBOOK_PRIVACY_URL=https://<actual-policy-host>/privacy
MTRIP_FACEBOOK_CONSENT_VERSION=2026-10-21
```

5. In Meta, register the Website platform/domain and exact `https://<actual-development-host>/api/v1/auth/facebook/callback`; keep HTTPS/Web OAuth enabled. This implementation uses authorization code and `public_profile`, not JS SDK or email permission. Use an account allowed to access the unpublished app.
6. Recreate the two user-service pools using the project wrapper so environment changes take effect (`cd deploy && ./mtrip.sh start user-service user-service-app`), validate/reload the gateway through the wrapper, and publish the built H5 with a backup. Restart alone does not load changed container environment variables. Follow the wrapper's dependency checks; MySQL health must be fixed before recreation if it blocks startup.
7. Build H5 with `EXPO_PUBLIC_API_BASE_URL=/` and the correct site/client configuration. Do not disable deployment client authentication to make OAuth work. Only the exact external callback is exempt from the App headers.
8. In desktop/mobile browsers: first authorization, repeat authorization, cancellation/retry, page refresh, sign out/relogin; verify account ID, phone/password state, profile prompt, normal user pages and required booking contact fields. Real provider authorization and secure-cookie behavior remain unverified until this step passes.
9. Repeat independently at `https://m.myanmartrip.com`; preserve local callback configuration. Public release additionally needs Meta's applicable publishing/review requirements, data deletion handling and the PRD contact-verification decision.

For a tunnel whose address changes, update both `MTRIP_FACEBOOK_WEB_ORIGINS` and Meta's exact callback. The browser navigates to the OAuth callback, while future Meta-initiated deletion/deauthorization callbacks need public reachability.

## Rollback

Disable Facebook login first; retain the normal phone login. Preserve created accounts and identity links. Do not restore the old `mobile_hash NOT NULL` constraint once phone-less users exist. Update the consent version whenever the displayed agreement changes. The frontend bundle contains no App Secret or Facebook Access Token.
