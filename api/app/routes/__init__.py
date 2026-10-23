"""Route modules. Shared helpers for building updates live here."""

import psycopg
from psycopg import sql


def update_row(
    conn: psycopg.Connection, table: str, id_column: str, id: object, changes: dict, columns: str
) -> dict | None:
    """UPDATE one row and return it, or None if it doesn't exist.

    `changes` keys come from a Pydantic model's fields, never from raw input, and are quoted as
    identifiers; values are bound as parameters.
    """
    assignments = sql.SQL(", ").join(
        sql.SQL("{} = {}").format(sql.Identifier(k), sql.Placeholder(k)) for k in changes
    )
    query = sql.SQL("UPDATE {} SET {} WHERE {} = %(_id)s RETURNING {}").format(
        sql.Identifier(table), assignments, sql.Identifier(id_column), sql.SQL(columns)
    )
    return conn.execute(query, {**changes, "_id": id}).fetchone()
