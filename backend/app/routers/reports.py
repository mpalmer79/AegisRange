"""Exercise report routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import report_service, require_role
from app.schemas import ReportRequest

router = APIRouter(tags=["reports"])


@router.post("/reports/generate", dependencies=[Depends(require_role("analyst"))])
def generate_exercise_report(payload: ReportRequest | None = None) -> dict:
    title = payload.title if payload else "AegisRange Exercise Report"
    report = report_service.generate_report(title)
    return report_service.to_dict(report)
