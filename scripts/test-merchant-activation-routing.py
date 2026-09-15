#!/usr/bin/env python3
"""Check activation routes through the gateway or Merchant Web proxy without account writes."""

import json
import os
import urllib.error
import urllib.request


base_url = os.environ.get("MTRIP_TEST_BASE_URL", "http://127.0.0.1:5174").rstrip("/")
routes = [
    ("POST", "start", 40101),
    ("GET", "profile", 40001),
    ("POST", "otp-send", 40001),
    ("POST", "otp-verify", 40001),
    ("POST", "totp/setup", 40001),
    ("POST", "totp/verify", 40001),
    ("POST", "google-link", 40001),
    ("POST", "finish", 40001),
]

for method, path, expected_code in routes:
    request = urllib.request.Request(
        f"{base_url}/api/v1/merchant/activation/{path}",
        data=b"{}" if method == "POST" else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = json.load(response)
        if response.status == 404 or body.get("code") != expected_code:
            raise RuntimeError(f"{method} {path}: HTTP {response.status}, {body}")
    print(f"PASS: {method} /merchant/activation/{path} reaches controller validation")
