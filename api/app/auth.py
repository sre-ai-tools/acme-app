"""Caller identity from the JWT claims that API Gateway's authorizer has already verified.

The API never parses or verifies tokens itself (design D3). A request without claims did not
come through the authorizer and is rejected.
"""

from fastapi import Request

from .errors import ApiError


def current_user(request: Request) -> str:
    # Mangum puts the API Gateway event in the ASGI scope.
    event = request.scope.get("aws.event") or {}
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    if not (sub := claims.get("sub")):
        raise ApiError(401, "unauthorized", "Missing caller identity")
    return sub
