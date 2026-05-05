# Keye Take-Home Assignment

This repository contains my take-home submission for **Keye**.

## Candidate

- Name: Micah Blackburn
- GitHub: [@micahcb](https://github.com/micahcb)
- Role: Software Engineer
- Date: 

## Project Overview

This project is my implementation of the Keye take-home assignment. It includes:

- The requested features and functionality
- Any assumptions and trade-offs I made
- Notes on areas I would improve with additional time

## Tech Stack

- Next.js Shadcn app for easy frontend component design
- Python FastAPI backend because of Parquet manipulation requirement

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- `uv` installed for Python dependency management and running the backend

### Installation

```bash
# clone repo
git clone https://github.com/micahcb/micahcb-keye-takehome-2026.git
cd micahcb-keye-takehome-2026
```

### Frontend Local Dev (Next.js)

```bash
# from repo root
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

### Backend Local Dev (FastAPI)

```bash
# from repo root
cd file-change-service
uv run uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000` by default.

### Run Both Services Together

Use two terminals:

- Terminal 1: run the frontend from `frontend/`
- Terminal 2: run the backend from `file-change-service/`

## Assignment Notes

### What I focused on


### Assumptions


### Trade-offs


### If I had more time



### Link to system design 



## Repository Structure

```text
.
├── frontend/             # Next.js + shadcn frontend
├── file-change-service/  # FastAPI backend (uv-managed)
└── README.md
```

## Submission
