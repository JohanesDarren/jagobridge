#!/usr/bin/env python
"""
JagoBridge per-provider / per-model gateway verification.

Enables every model in the catalog, calls each one through the
OpenAI-compatible gateway (/v1/chat/completions), reports the outcome grouped
by provider, then restores the original enabled/disabled set.

Usage: python backend/scripts/verify-models.py
"""
import json
import sys
import time
from collections import defaultdict

import requests

BASE = "http://localhost:5000"
API = BASE + "/api/v1"
GW = BASE + "/v1"

ADMIN_EMAIL = "admin@jago.com"
ADMIN_PASSWORD = "jagoai5758"

MAX_ATTEMPTS = 3


def data_of(r):
    try:
        return r.json().get("data")
    except Exception:  # noqa: BLE001
        return None


def main():
    admin = requests.Session()
    r = admin.post(API + "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        print("Login failed:", r.status_code, r.text[:200])
        sys.exit(1)

    r = admin.get(API + "/models", timeout=30)
    models = data_of(r)["models"]
    original_enabled = {m["id"] for m in models if m["is_enabled"]}
    print(f"catalog={len(models)} models, originally enabled={len(original_enabled)}")

    # ---- enable everything so every model can be exercised ----
    enabled = 0
    for m in models:
        if m["is_enabled"]:
            enabled += 1
            continue
        rr = admin.patch(API + f"/models/{m['id']}", json={"is_enabled": True}, timeout=30)
        if rr.status_code == 200:
            enabled += 1
        else:
            print(f"  could not enable {m['public_name']}: {rr.status_code}")
        time.sleep(0.4)
    print(f"enabled {enabled}/{len(models)} models for the run")

    # ---- gateway key ----
    kr = admin.post(API + "/api-keys", json={"name": f"allmodels-{int(time.time())}"}, timeout=30)
    gateway_key = (data_of(kr) or {}).get("key")
    key_id = (data_of(kr) or {}).get("id")
    if not gateway_key:
        print("Could not create gateway key")
        sys.exit(1)

    # ---- call every model ----
    by_provider = defaultdict(list)
    for m in models:
        status, detail = call_model(gateway_key, m["public_name"])
        by_provider[m["provider_label"]].append((m["public_name"], status, detail))

    # ---- report ----
    print("\n================ PER-PROVIDER MODEL RESULTS ================")
    for provider in sorted(by_provider):
        rows = by_provider[provider]
        ok = sum(1 for _, s, _ in rows if s == 200)
        print(f"\n[{provider}] {ok}/{len(rows)} OK")
        for name, status, detail in rows:
            mark = "OK  " if status == 200 else "FAIL"
            print(f"   {mark} {status:>4}  {name}  {detail}")

    # ---- restore original enabled set ----
    # Re-fetch so we compare against the *current* state, not the pre-enable snapshot.
    print("\nrestoring original enabled/disabled set...")
    fresh = {m["id"]: m["is_enabled"] for m in data_of(admin.get(API + "/models", timeout=30))["models"]}
    for m in models:
        want = m["id"] in original_enabled
        if fresh.get(m["id"]) == want:
            continue
        rr = admin.patch(API + f"/models/{m['id']}", json={"is_enabled": want}, timeout=30)
        if rr.status_code != 200:
            print(f"  restore failed for {m['public_name']}: {rr.status_code}")
        time.sleep(0.3)

    if key_id:
        admin.delete(API + f"/api-keys/{key_id}", timeout=30)
    print("done.")


def call_model(gw_key, model_name):
    headers = {"Authorization": f"Bearer {gw_key}", "Content-Type": "application/json"}
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
        "max_tokens": 64,
        "stream": False,
    }
    last_detail = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            r = requests.post(GW + "/chat/completions", headers=headers, json=payload, timeout=180)
        except Exception as exc:  # noqa: BLE001
            last_detail = f"ERR {exc}"
            time.sleep(2)
            continue
        if r.status_code in (429, 502, 503) and attempt < MAX_ATTEMPTS:
            last_detail = f"{r.status_code} retrying"
            time.sleep(4)
            continue
        try:
            body = r.json()
        except Exception:  # noqa: BLE001
            body = {"raw": r.text[:150]}
        if r.status_code == 200:
            content = (body.get("choices") or [{}])[0].get("message", {}).get("content", "")
            usage = body.get("usage") or {}
            return 200, f"content={content!r} tokens={usage.get('total_tokens')}"
        msg = (body.get("error") or {}).get("message") if isinstance(body, dict) else str(body)
        return r.status_code, (msg or json.dumps(body))[:180]
    return "ERR", last_detail


if __name__ == "__main__":
    main()
