"""Impersonation / session-upgrade hardening.

- bootstrap_session only accepts the admin-impersonation token (impersonated_by);
  an ordinary access token can no longer be upgraded into a fresh session +
  7-day refresh token.
- The impersonation session is issued WITHOUT a refresh token.
- The raw impersonation JWT is rejected when used directly as a Bearer.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException

from packages.common.src import auth as common_auth
from packages.common.src.config import get_settings
from services import auth_service as svc
from services.auth_service import AuthServiceError

S = get_settings()


def _token(sub, **extra):
    now = datetime.now(timezone.utc)
    payload = {"sub": str(sub), "role": "user", "exp": now + timedelta(hours=1), "iat": now}
    payload.update(extra)
    return jwt.encode(payload, S.JWT_SECRET, algorithm=S.JWT_ALGORITHM)


class _DBGet:
    def __init__(self, user):
        self._user = user

    async def get(self, *a, **k):
        return self._user


@pytest.fixture
def issued(monkeypatch):
    calls = []

    async def _no_rl(*a, **k):
        return None

    async def _fake_issue(user, request, db, **kw):
        calls.append(kw)
        return "ISSUED"

    monkeypatch.setattr(svc, "rate_limit_http", _no_rl)
    monkeypatch.setattr(svc, "issue_auth_json_response", _fake_issue)
    return calls


async def test_ordinary_access_token_cannot_bootstrap(issued):
    user = SimpleNamespace(id=uuid4(), status="active")
    with pytest.raises(AuthServiceError) as ei:
        await svc.bootstrap_session(_token(user.id), None, _DBGet(user))
    assert ei.value.status_code == 401
    assert issued == []


async def test_impersonation_token_gets_session_without_refresh(issued):
    user = SimpleNamespace(id=uuid4(), status="active")
    tok = _token(user.id, type="user", impersonated_by=str(uuid4()))
    assert await svc.bootstrap_session(tok, None, _DBGet(user)) == "ISSUED"
    assert issued[0].get("issue_refresh") is False


async def test_single_purpose_token_still_rejected(issued):
    user = SimpleNamespace(id=uuid4(), status="active")
    tok = _token(user.id, type="email_verify", impersonated_by=str(uuid4()))
    with pytest.raises(AuthServiceError):
        await svc.bootstrap_session(tok, None, _DBGet(user))


async def test_raw_impersonation_token_rejected_as_bearer():
    tok = _token(uuid4(), type="user", impersonated_by=str(uuid4()))
    request = SimpleNamespace(cookies={}, headers={})
    creds = SimpleNamespace(credentials=tok, scheme="Bearer")
    with pytest.raises(HTTPException) as ei:
        await common_auth.get_current_user(request, creds)
    assert ei.value.status_code == 401
