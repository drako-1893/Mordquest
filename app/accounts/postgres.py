import psycopg


class PostgresCursor(psycopg.Cursor):
    """Accept the same placeholders as SQLite in the app's SQL statements."""

    def execute(self, query, params=None, **kwargs):
        return super().execute(query.replace("?", "%s"), params, **kwargs)

    def executemany(self, query, params_seq, **kwargs):
        return super().executemany(query.replace("?", "%s"), params_seq, **kwargs)


def connect(url):
    return psycopg.connect(url, cursor_factory=PostgresCursor, connect_timeout=5)
