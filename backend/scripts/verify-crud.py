#!/usr/bin/env python
"""
JagoBridge runtime verification.

1. Exercises every management CRUD endpoint against a running backend.
2. Calls one model from every provider present in the catalog through the
   OpenAI-compatible gateway (/v1/chat/completions).

Usage: python backend/scripts/verify-crud.py
Requires: backend at http://localhost:5000, seeded admin (admin@jago.com / jagoai5758).
"""
import json
import sys
import time
import uuid

import requests

BASE = "http://localhost:5000"
API = BASE + "/api/v1"
GW = BASE + "/v1"

ADMIN_EMAIL = "admin@jago.com"
ADMIN_PASSWORD = "jagoai5758"
NEW_PASSWORD = "Str0ngTempPass!"

results = []
failures = []


def record(label, method, path, status, ok, detail=""):
    results.append((label, f"{method} {path}", status, "PASS" if ok else "FAIL", detail))
    if not ok:
        failures.append(f"{label} :: {method} {path} -> {status} {detail}")


def call(label, method, path, session, expect=200, expect_any=None, **kw):
    url = path if path.startswith("http") else API + path
    try:
        r = session.request(method, url, timeout=120, **kw)
        status = r.status_code
        try:
            body = r.json()
        except Exception:
            body = r.text[:300]
    except Exception as exc:  # noqa: BLE001
        record(label, method, path, "ERR", False, str(exc))
        return None
    ok = status in expect_any if expect_any is not None else status == expect
    detail = json.dumps(body)[:300] if not isinstance(body, str) else body
    record(label, method, path, status, ok, detail)
    return r


def data_of(r):
    try:
        return r.json().get("data")
    except Exception:  # noqa: BLE001
        return None


def check(label, condition, detail=""):
    """Records an assertion about a response body."""
    results.append((label, "ASSERT", "-", "PASS" if condition else "FAIL", detail))
    if not condition:
        failures.append(f"{label} :: {detail}")


def main():
    admin = requests.Session()

    r = call("auth.login", "POST", "/auth/login", admin, 200,
             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if not r or r.status_code != 200:
        print("Cannot log in as admin; aborting.")
        print_report()
        sys.exit(1)

    call("users.me", "GET", "/users/me", admin, 200)
    call("auth.refresh", "POST", "/auth/refresh", admin, 200)

    # ---------------------------------------------------------- catalog/ids
    r = call("access_profiles.list", "GET", "/access-profiles", admin, 200)
    profiles = data_of(r) or []
    check("access_profiles.list.has_package_fields",
          all("price_idr" in p and "tier_label" in p and "overage_action" in p for p in profiles),
          "packages must expose price_idr, tier_label and overage_action")
    member_profile_id = next((p["id"] for p in profiles if p.get("is_default")),
                             next((p["id"] for p in profiles if p.get("name") == "Free"),
                                  profiles[0]["id"] if profiles else None))

    r = call("models.list", "GET", "/models", admin, 200)
    models_payload = data_of(r) or {}
    models = models_payload.get("models", []) if isinstance(models_payload, dict) else models_payload
    app_model = next((m for m in models if m["public_name"] == "app"), None)

    call("models.available", "GET", "/models/available", admin, 200)
    call("access_profiles.models", "GET", "/access-profiles/models", admin, 200)

    r = call("features.list", "GET", "/features", admin, 200)
    features = data_of(r) or []
    streaming_feature = next((f for f in features if f.get("code") == "streaming"),
                             features[0] if features else None)

    # ------------------------------------------------------------- features
    if streaming_feature:
        original = streaming_feature["is_enabled"]
        call("features.update.toggle", "PATCH", f"/features/{streaming_feature['id']}", admin, 200,
             json={"is_enabled": not original})
        call("features.update.restore", "PATCH", f"/features/{streaming_feature['id']}", admin, 200,
             json={"is_enabled": original})

    # ------------------------------------------------------- model catalog
    call("models.sync", "POST", "/models/sync", admin, 200)
    if app_model:
        call("models.update.enable_app", "PATCH", f"/models/{app_model['id']}", admin, 200,
             json={"is_enabled": True, "display_name": "App (combo)", "token_multiplier": 1.0})

    # ------------------------------------------------- access profile CRUD
    r = call("access_profiles.create", "POST", "/access-profiles", admin, 201,
             json={
                 "name": f"CRUD Sweep {uuid.uuid4().hex[:6]}",
                 "description": "temporary profile from verify-crud",
                 "allow_all_models": False,
                 "limit_5h_tokens": 1000,
                 "limit_weekly_tokens": 5000,
                 "limit_rpm": 10,
                 "max_output_tokens_per_request": 512,
                 "price_idr": 12345,
                 "tier_label": "Sweep Tier",
                 "overage_action": "allow",
                 "is_default": False,
                 "model_ids": [models[0]["id"]] if models else [],
                 "feature_ids": [f["id"] for f in features[:2]],
             })
    temp_profile = data_of(r)
    temp_profile = temp_profile.get("profile", temp_profile) if isinstance(temp_profile, dict) else temp_profile
    temp_profile_id = temp_profile["id"] if temp_profile else None
    if temp_profile:
        check("access_profiles.create.package_fields",
              temp_profile.get("price_idr") == 12345
              and temp_profile.get("tier_label") == "Sweep Tier"
              and temp_profile.get("overage_action") == "allow",
              json.dumps({k: temp_profile.get(k) for k in
                          ("price_idr", "tier_label", "overage_action")}))

    if temp_profile_id:
        call("access_profiles.get", "GET", f"/access-profiles/{temp_profile_id}", admin, 200)
        r = call("access_profiles.update", "PATCH", f"/access-profiles/{temp_profile_id}", admin, 200,
                 json={"description": "updated by verify-crud", "limit_rpm": 15,
                       "price_idr": 54321, "tier_label": "Sweep Tier 2", "overage_action": "cutoff"})
        updated = data_of(r)
        updated = updated.get("profile", updated) if isinstance(updated, dict) else updated
        if updated:
            check("access_profiles.update.package_fields",
                  updated.get("price_idr") == 54321
                  and updated.get("tier_label") == "Sweep Tier 2"
                  and updated.get("overage_action") == "cutoff",
                  json.dumps({k: updated.get(k) for k in
                              ("price_idr", "tier_label", "overage_action")}))
        call("access_profiles.set_models", "PUT", f"/access-profiles/{temp_profile_id}/models", admin, 200,
             json={"allow_all_models": False, "model_ids": [models[0]["id"]] if models else []})
        call("access_profiles.set_features", "PUT", f"/access-profiles/{temp_profile_id}/features", admin, 200,
             json={"feature_ids": [f["id"] for f in features[:3]]})

    # ---------------------------------------------------------- api keys CRUD
    call("api_keys.list", "GET", "/api-keys", admin, 200)
    r = call("api_keys.create_revoke", "POST", "/api-keys", admin, 201,
             json={"name": f"sweep-throwaway-{uuid.uuid4().hex[:6]}"})
    throwaway = data_of(r) or {}
    if throwaway.get("id"):
        call("api_keys.revoke", "DELETE", f"/api-keys/{throwaway['id']}", admin, 200)

    r = call("api_keys.create_gateway", "POST", "/api-keys", admin, 201,
             json={"name": f"sweep-gateway-{uuid.uuid4().hex[:6]}"})
    gateway = data_of(r) or {}
    gateway_key = gateway.get("key")
    gateway_key_id = gateway.get("id")

    # ------------------------------------------------------------- settings
    r = call("settings.get", "GET", "/settings", admin, 200)
    settings = data_of(r) or {}
    call("settings.update", "PATCH", "/settings", admin, 200,
         json={"default_timezone": settings.get("default_timezone") or "UTC"})
    call("settings.test_upstream", "POST", "/settings/test-upstream", admin, 200)

    # ------------------------------------------------------------ audit logs
    call("audit_logs.list", "GET", "/audit-logs?limit=5", admin, 200)

    # ---------------------------------------------------------------- usage
    call("usage.summary", "GET", "/usage/summary", admin, 200)
    call("usage.events", "GET", "/usage/events?limit=5", admin, 200)
    call("usage.stats", "GET", "/usage/stats?range=7d", admin, 200)
    r = admin.get(API + "/usage/export?range=7d", timeout=60)
    record("usage.export", "GET", "/usage/export", r.status_code, r.status_code == 200,
           r.headers.get("Content-Type", ""))

    # -------------------------------------------------- users + invitations
    profile_for_invite = temp_profile_id or member_profile_id
    invite_email = f"sweep-{uuid.uuid4().hex[:8]}@team.example"
    r = call("invitations.create", "POST", "/users/invitations", admin, 201,
             json={"email": invite_email, "role": "member", "access_profile_id": profile_for_invite})
    inv = data_of(r) or {}
    invite_token = inv["invite_url"].split("token=")[1] if inv.get("invite_url") and "token=" in inv["invite_url"] else None

    call("invitations.list", "GET", "/users/invitations", admin, 200)

    # invitation B: resent then revoked
    r = call("invitations.create_b", "POST", "/users/invitations", admin, 201,
             json={"email": f"sweep-{uuid.uuid4().hex[:8]}@team.example", "role": "member",
                   "access_profile_id": member_profile_id})
    inv_b = data_of(r) or {}
    if inv_b.get("id"):
        r = call("invitations.resend", "POST", f"/users/invitations/{inv_b['id']}/resend", admin, 200)
        resent = data_of(r) or {}
        if resent.get("id"):
            call("invitations.revoke", "DELETE", f"/users/invitations/{resent['id']}", admin, 200)

    new_user_id = None
    if invite_token:
        invitee = requests.Session()
        r = call("auth.accept_invite", "POST", "/auth/accept-invite", invitee, 200,
                 json={"token": invite_token, "name": "Sweep User", "password": NEW_PASSWORD})
        u = data_of(r) or {}
        new_user_id = (u.get("user") or {}).get("id") if isinstance(u, dict) else None

    call("users.list", "GET", "/users?limit=100", admin, 200)
    if new_user_id:
        call("users.get", "GET", f"/users/{new_user_id}", admin, 200)
        call("users.update", "PATCH", f"/users/{new_user_id}", admin, 200, json={"name": "Sweep User Renamed"})
        if models:
            call("users.model_access", "PUT", f"/users/{new_user_id}/model-access", admin, 200,
                 json={"overrides": [{"model_id": models[0]["id"], "effect": "allow"}]})
        if features:
            call("users.feature_access", "PUT", f"/users/{new_user_id}/feature-access", admin, 200,
                 json={"overrides": [{"feature_id": features[0]["id"], "effect": "allow"}]})

        # in-use delete guard: the temp profile now has this user assigned -> 409
        if temp_profile_id:
            call("access_profiles.delete_in_use_guard", "DELETE", f"/access-profiles/{temp_profile_id}",
                 admin, expect=409)

        r = call("users.reset_password", "POST", f"/users/{new_user_id}/reset-password", admin, 200)
        temp_pw = (data_of(r) or {}).get("temporary_password")

        invitee = requests.Session()
        if temp_pw:
            rr = call("auth.login.invitee", "POST", "/auth/login", invitee, 200,
                      json={"email": invite_email, "password": temp_pw})
            if rr and rr.status_code == 200:
                call("auth.change_password", "POST", "/auth/change-password", invitee, 200,
                     json={"current_password": temp_pw, "new_password": NEW_PASSWORD + "9"})

        call("users.delete", "DELETE", f"/users/{new_user_id}", admin, 200)
        call("users.get.deleted", "GET", f"/users/{new_user_id}", admin, expect=404)

        # now that no user is assigned, the profile can be deleted
        if temp_profile_id:
            call("access_profiles.delete", "DELETE", f"/access-profiles/{temp_profile_id}", admin, 200)

    call("users.me.usage_notice", "PATCH", "/users/me/usage-notice", admin, 200, json={})

    # --------------------------------------------------------------- logout
    call("auth.logout", "POST", "/auth/logout", admin, 200)
    admin2 = requests.Session()
    call("auth.relogin", "POST", "/auth/login", admin2, 200,
         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})

    # ------------------------------------------------- gateway: one per provider
    print("\n=== Gateway per-provider calls ===")
    provider_choice = {
        "combo": "app",
        "kc": "kc/poolside/laguna-xs-2.1:free",
        "groq": "groq/openai/gpt-oss-120b",
        "cmc": "cmc/deepseek/deepseek-v4-flash",
        "ocg": "ocg/glm-5.2",
        "vyce-ai": "vyce-ai/claude-sonnet-4-6",
    }
    for provider, model_name in provider_choice.items():
        call_gateway(provider, model_name, gateway_key)

    # cleanup: revoke the dedicated gateway key
    if gateway_key_id:
        call("api_keys.revoke_gateway", "DELETE", f"/api-keys/{gateway_key_id}", admin2, 200)

    print_report()
    sys.exit(1 if failures else 0)


def call_gateway(provider, model_name, gw_key):
    headers = {"Authorization": f"Bearer {gw_key}", "Content-Type": "application/json"}
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
        "max_tokens": 16,
        "stream": False,
    }
    for attempt in range(1, 5):
        try:
            r = requests.post(GW + "/chat/completions", headers=headers, json=payload, timeout=120)
        except Exception as exc:  # noqa: BLE001
            if attempt == 4:
                print(f"  [{provider}] {model_name}: ERR {exc}")
                failures.append(f"gateway:{provider} ERR {exc}")
            time.sleep(2)
            continue
        if r.status_code == 429 and attempt < 4:
            print(f"  [{provider}] {model_name}: 429 upstream rate-limited, retrying ({attempt})...")
            time.sleep(3)
            continue
        ok = r.status_code == 200
        try:
            body = r.json()
        except Exception:  # noqa: BLE001
            body = {"raw": r.text[:200]}
        if ok:
            content = (body.get("choices") or [{}])[0].get("message", {}).get("content", "")
            usage = body.get("usage") or {}
            detail = f"content={content!r} usage={usage}"
        else:
            detail = json.dumps(body)[:300]
        print(f"  [{provider}] {model_name}: {r.status_code} {'PASS' if ok else 'FAIL'} {detail}")
        if not ok:
            failures.append(f"gateway:{provider} {model_name} -> {r.status_code} {detail}")
        else:
            results.append((f"gateway:{provider}", model_name, r.status_code, "PASS", detail))
        return


def print_report():
    print("\n================ CRUD / GATEWAY SWEEP ================")
    print(f"{'RESULT':6} {'STATUS':6} {'METHOD PATH':50} LABEL")
    for label, route, status, verdict, detail in results:
        print(f"{verdict:6} {str(status):6} {route:50} {label}")
    print("------------------------------------------------------")
    print(f"total={len(results)}  failures={len(failures)}")
    for f in failures:
        print("  FAIL:", f)


if __name__ == "__main__":
    main()
