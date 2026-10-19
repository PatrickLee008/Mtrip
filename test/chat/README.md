# Guest messaging regression

These tests use schema-only clones of the local development databases and synthetic fixtures. They do not copy customer data. Docker and installed `client-app` dependencies (including Expo's `ws`) are required. Ports 19500/19502/19504/19506/19512/19591/19593 must be available; browser QA additionally uses 19501 and a temporary frontend port.

Run from the repository root:

```sh
CHAT_QA_KEEP=1 python3 test/chat/run-integration.py
```

Use the printed `QA_SESSION` path as the final argument below. Do not print its contents: it holds short-lived synthetic authentication tokens.

```sh
node test/chat/realtime-attachments.cjs <QA_SESSION>
python3 test/chat/start-ui-qa.py <QA_SESSION>
python3 test/chat/extended-integration.py <QA_SESSION>
python3 test/chat/start-gateway-qa.py <QA_SESSION>
node test/chat/gateway.cjs <QA_SESSION>
node test/chat/platform.cjs <QA_SESSION>
python3 test/chat/cleanup.py <QA_SESSION>
```

For property access and frontend reconnect regressions, run these immediately after the base runner and before realtime tests revoke the employee grant:

```sh
python3 test/chat/property-access.py <QA_SESSION>
node test/chat/store-retry.cjs
```

The 9 property checks cover closed-property history, replies, tickets, unchanged consumer consultation rules, and denied cross-merchant/unassigned/deleted-property access. The 10 store checks cover terminal authorization errors, transient recovery, cancellation, and stale startup failures. Property fixtures are restored after the checks.

Expected counts: 17 + 21 + 23 + 7 + 6 = 74 checks. The gateway tests also exercise the merchant/client static servers' second proxy hop through 19591/19593. Use this order: realtime tests revoke the employee property grant, and extended tests exercise the resulting release plus role revocation. Recreate fixtures to repeat the complete suite. The migration is executed twice against an empty schema clone to verify repeatability.

`start-ui-qa.py` starts real merchant/order services and sets up a synthetic merchant login for browser QA. `qa-proxy.cjs` optionally routes local frontend requests to these isolated services. Its default port is 19501. Frontends are started separately and must be stopped after QA. Consumers need a synthetic password fixture for browser login; no external SMS is sent by these tests.

Always run cleanup after retained runs, including failures. Cleanup validates the exact random resource names and temporary directory, removes only task resources, and deletes private test files and credentials. Without `CHAT_QA_KEEP=1`, the base integration runner cleans up automatically. Redis connection tickets expire naturally; no shared Redis flush is used.

Passing these tests does not migrate or publish the normal development environment. The full 2026-10-15 run is recorded in `docs/plans/audits/2026-10-15-guest-messaging.md`. The subsequent migration repair, local rollout, and 24-check rerun (17 base + 7 gateway) are recorded in `docs/plans/audits/2026-10-16-guest-messaging-local-rollout.md`.
