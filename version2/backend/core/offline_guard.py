"""Strict Offline Mode network guard blocking outbound non-localhost calls during normal operation."""

from __future__ import annotations

import contextvars
import os
import socket
import time
from typing import Any
from urllib.parse import urlparse

_LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1", "0.0.0.0"}
_ALLOW_INSTALL_NETWORK: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "bhaios_allow_install_network", default=False
)
_BLOCKED_LOG: list[dict[str, Any]] = []
_ORIGINAL_CREATE_CONNECTION = socket.create_connection
_GUARD_INSTALLED = False


def is_offline_mode() -> bool:
    return os.environ.get("BHAIOS_OFFLINE_MODE", "1") == "1"


def is_local_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return host in _LOCAL_HOSTS or host == ""


class allow_install_network:
    """Explicit context manager used ONLY by the Model Installation Manager during downloads."""

    def __enter__(self):
        self._token = _ALLOW_INSTALL_NETWORK.set(True)
        return self

    def __exit__(self, *args):
        _ALLOW_INSTALL_NETWORK.reset(self._token)


def get_blocked_network_log() -> list[dict[str, Any]]:
    return list(_BLOCKED_LOG[-50:])


def clear_blocked_network_log() -> None:
    _BLOCKED_LOG.clear()


def _guarded_create_connection(address, *args, **kwargs):
    host = str(address[0]).lower() if isinstance(address, (tuple, list)) and address else ""
    if is_offline_mode() and not _ALLOW_INSTALL_NETWORK.get():
        if host not in _LOCAL_HOSTS and not host.startswith("127."):
            _BLOCKED_LOG.append(
                {"host": host, "port": address[1] if len(address) > 1 else None, "timestamp": time.time()}
            )
            raise ConnectionRefusedError(
                f"BhaiOS Strict Offline Mode blocked outbound connection to '{host}'. Only localhost is permitted."
            )
    return _ORIGINAL_CREATE_CONNECTION(address, *args, **kwargs)


def install_offline_socket_guard() -> None:
    """Monkeypatch socket.create_connection so no library silently phones home in Offline Mode."""
    global _GUARD_INSTALLED
    if not _GUARD_INSTALLED:
        socket.create_connection = _guarded_create_connection  # type: ignore[assignment]
        _GUARD_INSTALLED = True
