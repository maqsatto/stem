from fastapi import APIRouter

from app.api.v1 import admin, assessments, auth, catalogs, classrooms, uploads

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(auth.profile_router)
api_router.include_router(catalogs.router)
api_router.include_router(classrooms.router)
api_router.include_router(assessments.router)
api_router.include_router(uploads.router)
api_router.include_router(admin.router)
