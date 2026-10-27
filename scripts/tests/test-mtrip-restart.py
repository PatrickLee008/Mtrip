#!/usr/bin/env python3
"""Exercise the real wrapper with isolated Docker/curl substitutes."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RestartTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copy(ROOT / "deploy/mtrip.sh", self.root / "mtrip.sh")
        (self.root / ".env").write_text("")
        (self.root / "s7.env.example").write_text("")
        self.log = self.root / "calls.jsonl"
        self.env = dict(os.environ, PATH=f"{self.root}:{os.environ['PATH']}",
                        MTRIP_TEST_LOG=str(self.log))
        self.executable("docker", """
import json, os, sys
args = sys.argv[1:]
with open(os.environ['MTRIP_TEST_LOG'], 'a') as log:
    log.write(json.dumps(args) + '\\n')
if 'ps' in args:
    print('gateway-id')
if args[-2:] == ['restart', 'gateway'] and os.environ.get('FAIL_REFRESH'):
    sys.exit(1)
""")
        self.executable("curl", """
import os, sys
url = sys.argv[-1]
if '/merchant/chat/' in url:
    print('502' if url.endswith(os.environ.get('CHAT_FAILURE', '!')) else '401', end='')
else:
    print('400' if url.endswith('/auth/login') else '200', end='')
""")

    def executable(self, name, source):
        path = self.root / name
        path.write_text("#!/usr/bin/env python3\n" + source)
        path.chmod(0o755)

    def run_wrapper(self, *args, **env):
        return subprocess.run(["bash", str(self.root / "mtrip.sh"), *args],
                              env=dict(self.env, **env), text=True, capture_output=True)

    def restarts(self):
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        return [args[args.index("restart") + 1:] for args in calls if "restart" in args]

    def test_full_restart_refreshes_gateway_last(self):
        self.assertEqual(self.run_wrapper("restart").returncode, 0)
        self.assertEqual(self.restarts(), [[], ["gateway"]])

    def test_service_restart_refreshes_gateway(self):
        self.assertEqual(self.run_wrapper("restart", "user-service").returncode, 0)
        self.assertEqual(self.restarts(), [["user-service"], ["gateway"]])

    def test_explicit_gateway_with_service_still_refreshes_last(self):
        self.assertEqual(self.run_wrapper("restart", "gateway", "user-service").returncode, 0)
        self.assertEqual(self.restarts(), [["gateway", "user-service"], ["gateway"]])

    def test_gateway_only_is_not_restarted_twice(self):
        self.assertEqual(self.run_wrapper("restart", "gateway").returncode, 0)
        self.assertEqual(self.restarts(), [["gateway"]])

    def test_refresh_failure_is_not_reported_as_success(self):
        result = self.run_wrapper("restart", FAIL_REFRESH="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("[OK] 重启完成", result.stdout)

    def test_chat_failure_makes_health_fail_even_when_services_are_healthy(self):
        for endpoint in ("summary", "ticket", "preferences"):
            with self.subTest(endpoint=endpoint):
                result = self.run_wrapper("health", CHAT_FAILURE=endpoint)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(endpoint, result.stdout)

    def test_chat_unauthenticated_response_is_healthy(self):
        result = self.run_wrapper("health")
        self.assertEqual(result.returncode, 0, result.stderr)
        for endpoint in ("summary", "ticket", "preferences"):
            self.assertIn(endpoint, result.stdout)

    def test_s7_restart_reloads_gateway(self):
        self.assertEqual(self.run_wrapper("restart", "--s7").returncode, 0)
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertTrue(any(args[-3:] == ["/usr/local/openresty/nginx/sbin/nginx", "-s", "reload"]
                            for args in calls))


if __name__ == "__main__":
    unittest.main()
