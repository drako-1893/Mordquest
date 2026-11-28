import argparse
import os
import sqlite3
from contextlib import closing
from pathlib import Path

from ..config import DATABASE


def copy_database(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"No existe la base de datos {source}.")
    descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(descriptor)
        source_uri = source.resolve().as_uri() + "?mode=ro"
        with closing(sqlite3.connect(source_uri, uri=True)) as original, closing(sqlite3.connect(destination)) as copy:
            original.backup(copy)
            if copy.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise ValueError("La copia SQLite no pasó la comprobación de integridad.")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Copia o restaura la base SQLite de Assoku.")
    parser.add_argument("action", choices=("backup", "restore"))
    parser.add_argument("file", type=Path, help="Ruta del archivo de respaldo")
    args = parser.parse_args()
    file = args.file.expanduser()
    source, destination = (DATABASE, file) if args.action == "backup" else (file, DATABASE)
    try:
        copy_database(source, destination)
    except (OSError, sqlite3.Error, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Base verificada en {destination}.")


if __name__ == "__main__":
    main()
