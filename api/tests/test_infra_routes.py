"""API Gateway only forwards the routes listed in infra/api.tf. Keep them in step with FastAPI,
or a new endpoint silently 404s at the gateway."""

import re
from pathlib import Path

from app.main import app

API_TF = Path(__file__).resolve().parents[2] / "infra" / "api.tf"


def terraform_routes() -> set[str]:
    block = re.search(r"api_routes\s*=\s*toset\(\[(.*?)\]\)", API_TF.read_text(), re.DOTALL)
    assert block, "api_routes not found in infra/api.tf"
    return set(re.findall(r'"([A-Z]+ /[^"]*)"', block.group(1)))


def fastapi_routes() -> set[str]:
    # The OpenAPI schema is FastAPI's public view of its routes; app.routes internals vary
    # between versions.
    paths = app.openapi()["paths"]
    return {f"{method.upper()} {path}" for path, ops in paths.items() for method in ops}


def test_gateway_routes_match_fastapi():
    assert terraform_routes() == fastapi_routes()
