from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.review import router as review_router
from app.routers.uploads import router as uploads_router

app = FastAPI(title="file-change-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://micahcb-keye-takehome-2026-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(uploads_router)
app.include_router(review_router)
