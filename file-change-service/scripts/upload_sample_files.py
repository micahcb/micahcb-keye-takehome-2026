from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.config import PROJECT_ROOT, SAMPLE_FILES_BUCKET, SAMPLE_FILES_PREFIX, required_env
from app.services.storage import upload_to_supabase


def build_public_object_url(bucket: str, path: str) -> str:
    base_url = required_env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    return f"{base_url}/storage/v1/object/{bucket}/{path}"


def upload_samples(
    source_dir: Path,
    bucket: str,
    prefix: str,
    output_manifest: Path,
) -> dict:
    if not source_dir.exists() or not source_dir.is_dir():
        raise ValueError(f"Source directory not found: {source_dir}")

    uploaded: list[dict] = []
    parquet_files = sorted(source_dir.glob("*.parquet"))
    for parquet_file in parquet_files:
        content = parquet_file.read_bytes()
        object_path = f"{prefix}/{parquet_file.name}" if prefix else parquet_file.name
        upload_to_supabase(
            object_path,
            content,
            "application/octet-stream",
            bucket=bucket,
        )
        uploaded.append(
            {
                "file_name": parquet_file.name,
                "bucket": bucket,
                "storage_path": object_path,
                "object_url": build_public_object_url(bucket, object_path),
            }
        )

    manifest = {
        "source_dir": str(source_dir),
        "bucket": bucket,
        "prefix": prefix,
        "count": len(uploaded),
        "files": uploaded,
    }
    output_manifest.write_text(json.dumps(manifest, indent=2))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload local sample parquet files to Supabase Storage and output manifest."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=PROJECT_ROOT / "frontend" / "test_files",
        help="Local directory containing sample parquet files.",
    )
    parser.add_argument(
        "--bucket",
        default=SAMPLE_FILES_BUCKET,
        help="Supabase bucket for sample files.",
    )
    parser.add_argument(
        "--prefix",
        default=SAMPLE_FILES_PREFIX,
        help="Object path prefix in bucket (e.g. samples).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "file-change-service" / "sample-files.manifest.json",
        help="Path for output manifest JSON file.",
    )
    args = parser.parse_args()

    manifest = upload_samples(args.source_dir, args.bucket, args.prefix, args.output)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
