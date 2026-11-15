"""Exercise backup error handling without touching an actual database or Docker stack."""

import gzip
import io
import os
import subprocess
import tarfile
from pathlib import Path


def test_failed_database_dump_does_not_report_or_leave_successful_backup(tmp_path):
    root = Path(__file__).resolve().parents[2]
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "backup.sh").write_bytes((root / "scripts" / "backup.sh").read_bytes())
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text('#!/bin/sh\nprintf "partial dump"\nexit 1\n')
    docker.chmod(0o755)

    result = subprocess.run(
        ["sh", str(scripts / "backup.sh")],
        capture_output=True,
        text=True,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"},
        check=False,
    )
    assert result.returncode != 0
    assert "Backup complete" not in result.stdout
    assert list((tmp_path / "backups").iterdir()) == []


def test_successful_backup_publishes_both_files(tmp_path):
    root = Path(__file__).resolve().parents[2]
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "backup.sh").write_bytes((root / "scripts" / "backup.sh").read_bytes())
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text('#!/bin/sh\ncase "$*" in *pg_dump*) printf "database" ;; *) printf "archive" ;; esac\n')
    docker.chmod(0o755)
    result = subprocess.run(
        ["sh", str(scripts / "backup.sh")], capture_output=True, text=True,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, check=False,
    )
    assert result.returncode == 0, result.stderr
    backups = tmp_path / "backups"
    db_file, = backups.glob("*.dump.gz")
    uploads_file, = backups.glob("*.tar.gz")
    assert gzip.decompress(db_file.read_bytes()) == b"database"
    assert uploads_file.read_bytes() == b"archive"
    assert len(list(backups.iterdir())) == 2


def test_failed_upload_archive_does_not_publish_database_dump(tmp_path):
    root = Path(__file__).resolve().parents[2]
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "backup.sh").write_bytes((root / "scripts" / "backup.sh").read_bytes())
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text('#!/bin/sh\ncase "$*" in *pg_dump*) printf "database" ;; *) exit 1 ;; esac\n')
    docker.chmod(0o755)
    result = subprocess.run(
        ["sh", str(scripts / "backup.sh")], capture_output=True, text=True,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, check=False,
    )
    assert result.returncode != 0
    assert list((tmp_path / "backups").iterdir()) == []


def test_restore_rejects_corrupt_dump_before_stopping_backend(tmp_path):
    root = Path(__file__).resolve().parents[2]
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "restore.sh").write_bytes((root / "scripts" / "restore.sh").read_bytes())
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text('#!/bin/sh\ntouch "$(dirname "$0")/called"\nexit 0\n')
    docker.chmod(0o755)
    dump = tmp_path / "bad.dump.gz"
    dump.write_bytes(b"not a gzip file")
    result = subprocess.run(
        ["sh", str(scripts / "restore.sh"), str(dump)], capture_output=True, text=True,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, check=False,
    )
    assert result.returncode != 0
    assert not (bin_dir / "called").exists()


def test_restore_keeps_backend_stopped_until_uploads_are_restored(tmp_path):
    root = Path(__file__).resolve().parents[2]
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "restore.sh").write_bytes((root / "scripts" / "restore.sh").read_bytes())
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$(dirname "$0")/calls"\nexit 0\n')
    docker.chmod(0o755)
    dump = tmp_path / "db.gz"
    dump.write_bytes(gzip.compress(b"dump"))
    uploads = tmp_path / "uploads.tar.gz"
    with tarfile.open(uploads, "w:gz") as archive:
        info = tarfile.TarInfo("uploads/example.txt")
        info.size = 1
        archive.addfile(info, io.BytesIO(b"x"))
    result = subprocess.run(
        ["sh", str(scripts / "restore.sh"), str(dump), str(uploads)],
        capture_output=True, text=True,
        env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, check=False,
    )
    assert result.returncode == 0, result.stderr
    calls = (bin_dir / "calls").read_text().splitlines()
    stop = next(i for i, call in enumerate(calls) if call == "compose stop backend")
    upload = next(i for i, call in enumerate(calls) if "--entrypoint tar backend -xzf" in call)
    start = next(i for i, call in enumerate(calls) if call == "compose start backend")
    assert stop < upload < start
