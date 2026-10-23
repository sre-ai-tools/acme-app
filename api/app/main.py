"""Incident Log API. Lambda entry point: app.main.handler."""

import logging

from fastapi import Depends, FastAPI
from mangum import Mangum

from .auth import current_user
from .errors import register_error_handlers
from .routes import action_items, events, incidents, postmortems

logging.basicConfig(level=logging.INFO)

# No interactive docs in Lambda: the API is only reachable through the authorizer anyway.
app = FastAPI(
    title="Incident Log API", version="0.1.0", docs_url=None, redoc_url=None, openapi_url=None
)
register_error_handlers(app)

for module in (incidents, events, postmortems, action_items):
    app.include_router(module.router, dependencies=[Depends(current_user)])

handler = Mangum(app, lifespan="off")
