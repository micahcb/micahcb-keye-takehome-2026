# Keye Take-Home Assignment

**Walkthrough (Loom):** [Demo / overview video](https://www.loom.com/share/20cead647b184ba994c96c1768c0d850)

This repository contains a take-home submission for **Keye**: a small end-to-end flow for uploading Parquet sales-style data, detecting suggested cell-level corrections, persisting them for review, and driving a review UI in the browser.

## Candidate

- **Name:** Micah Blackburn
- **GitHub:** [@micahcb](https://github.com/micahcb)
- **Role:** Software Engineer
- **Date:** May 7, 2026

## Project overview

The app has two deployable parts, deployed on railway:

1. **`file-change-service`** (FastAPI) accepts Parquet uploads (or pulls named samples from Supabase Storage), runs a **pandas / NumPy cleaning pipeline** to find numeric inconsistencies and propose zero-outs and similar fixes, then stores **per-row and per-cell suggestions** in PostgreSQL. It also records file metadata and talks to **Supabase Storage** for uploads and sample listing.
2. **`frontend`** (Next.js 16, React 19, shadcn/ui, Tailwind 4) provides an **upload experience** and a **`/review` workbench** that loads suggestion data from the API and **hydrates full source rows** from Parquet in storage (via Supabase on the server) for context while reviewers accept, reject, or revert changes.

Together, this demonstrates Parquet handling, a rule-based detection layer, persistence, and a focused operator UI.

## Tech stack

| Area | Choices |
|------|---------|
| Frontend | Next.js (App Router), React 19, TypeScript, shadcn/ui, Tailwind CSS |
| Parquet (browser/server) | hyparquet (+ compressors) for reading; backend uses pandas + pyarrow |
| Backend | FastAPI, uvicorn, httpx |
| Data & storage | PostgreSQL (`DATABASE_URL`), Supabase Storage (buckets for uploads and samples) |
| Python tooling | `uv` (lockfile in `file-change-service/uv.lock`) |


## Environment variables

Create a **`.env`** at the **repository root** and/or under **`file-change-service/`** (both are loaded by the backend). The Next.js app reads from **`frontend/.env.local`** for local dev.

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Backend | PostgreSQL connection string (SSL required by `app/db.py`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Backend, Frontend | Supabase project URL (also used by backend Storage REST calls) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend, Frontend (server only) | Service role key for Storage and server-side `uploaded_files` lookups |
| `NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL` | Frontend | Public URL of the FastAPI API (default `http://localhost:8000`) |
| `SUPABASE_UPLOAD_BUCKET` | Backend | Bucket for user uploads (default `uploads`) |
| `SAMPLE_FILES_BUCKET` | Backend | Bucket for sample Parquets (defaults to `SUPABASE_UPLOAD_BUCKET`) |
| `SAMPLE_FILES_PREFIX` | Backend | Object prefix for samples (default `samples`) |

**Frontend server routes** (for example `/review` Parquet hydration) need `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` in the environment where Next runs; do not expose the service role to the client in bundled code beyond what Next injects for server-only usage.

## Database

The API expects PostgreSQL tables compatible with the SQL in `file-change-service/app/routers/uploads.py` and `file-change-service/app/routers/review.py`:

- **`uploaded_files`** — file id, name, storage path, bucket, content hash, mime type, size  
- **`diff_rows`** — row-level review state keyed by file and source row index  
- **`diffs`** — cell-level suggested and current numeric values linked to `diff_rows`

## Getting started

### Clone and install

```bash
git clone https://github.com/micahcb/micahcb-keye-takehome-2026.git
cd micahcb-keye-takehome-2026
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### Backend (FastAPI)

```bash
cd file-change-service
uv sync
uv run uvicorn app.main:app --reload
```

API URL: [http://localhost:8000](http://localhost:8000) (default). OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs).

### Run both locally

Use two terminals: one for `frontend` (`npm run dev`) and one for `file-change-service` (`uv run uvicorn ...`). CORS is configured for `localhost:3000` and the production frontend host referenced in `app/main.py`.

## HTTP API (summary)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/uploads/samples` | List `.parquet` sample filenames under the configured storage prefix |
| `POST` | `/uploads` | Multipart upload of a `.parquet` file; runs pipeline and writes diffs |
| `POST` | `/uploads/sample` | JSON body `{ "sampleFileName": "..." }`; download sample from storage and process |
| `GET` | `/review/file-data` | Query `fileId`, optional `limit` — rows and cell diffs for the workbench |
| `POST` | `/review/row-action` | Body: `fileId`, `rowId`, `action` (`accept` \| `reject` \| `revert`) |
| `POST` | `/review/file-action` | Body: `fileId`, `action` — bulk row status update |

Upload endpoints support `forceReprocess` when duplicate files (by SHA-256) should be re-run instead of returning cached counts.


## Tests

Cleaning pipeline behavior is covered by unit tests:

```bash
cd file-change-service
uv run pytest
```

### Final System design

https://app.excalidraw.com/l/GCERB2vuWO/2MRLctjk4UG

- Held in the green box at the bottom


---
