# Referral verification

Run `python -I -X utf8 test/referral/integration.py` with the local MySQL and Redis
containers running. The suite clones table structures into randomly named schemas,
starts temporary user/order services with a restricted database user, and removes
them in `finally`. Normal business rows and real SMS/OAuth providers are untouched.

The suite calls the real booking lifecycle and wallet ledger. It checks positive
credits and lots, zero-value historical completion, configured offer display,
repeated/concurrent check-ins, rollback of the second credit, retry, and site scope.

Run `node test/referral/components.cjs` for English, Chinese and Burmese rendering
with controlled API data. It loads the actual screen components; native hosts and
navigation/API hooks are test doubles. These checks do not prove native rendering
or third-party login/delivery.

The 2026-11-19 local browser interaction script is at
`C:/Tools/cdp/qa-261119.cjs`; its API responses are fixtures. Test results and input
workbook corrections are recorded in `docs/plans/audits/2026-11-19-qa-fix-retest.md`.
