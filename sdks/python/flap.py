"""Thin Flap REST client."""
from __future__ import annotations

import json
import urllib.request


class Flap:
    def __init__(self, api_key: str, base_url: str = "https://useflap.online") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def request(self, method: str, path: str, body: dict | None = None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={
                "authorization": f"Bearer {self.api_key}",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())

    def send(self, message: dict):
        return self.request("POST", "/api/v1/send", message)

    def domains(self):
        return self.request("GET", "/api/domains")
