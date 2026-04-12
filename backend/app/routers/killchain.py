"""Kill chain analysis routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import killchain_service, require_role
from app.schemas import KillChainAnalysisResponse

router = APIRouter(tags=["killchain"])


@router.get("/killchain", response_model=list[KillChainAnalysisResponse], dependencies=[Depends(require_role("viewer"))])
def get_all_killchain_analyses() -> list[dict]:
    analyses = killchain_service.analyze_all_incidents()
    return [killchain_service.to_dict(a) for a in analyses]


@router.get(
    "/killchain/{correlation_id}", response_model=KillChainAnalysisResponse, dependencies=[Depends(require_role("viewer"))]
)
def get_killchain_analysis(correlation_id: str) -> dict:
    analysis = killchain_service.analyze_incident(correlation_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return killchain_service.to_dict(analysis)
