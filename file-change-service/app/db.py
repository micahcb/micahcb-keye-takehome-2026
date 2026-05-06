import psycopg

from app.config import required_env


def db_conn() -> psycopg.Connection:
    return psycopg.connect(required_env("DATABASE_URL"), sslmode="require")
