"""Campaign detection routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import campaign_detection_service, require_role

router = APIRouter(tags=["campaigns"])


@router.get("/campaigns", dependencies=[Depends(require_role("viewer"))])
def get_campaigns() -> list[dict]:
    campaigns = campaign_detection_service.detect_campaigns()
    return [campaign_detection_service.to_dict(c) for c in campaigns]


@router.get("/campaigns/{campaign_id}", dependencies=[Depends(require_role("viewer"))])
def get_campaign(campaign_id: str) -> dict:
    campaign = campaign_detection_service.get_campaign(campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign_detection_service.to_dict(campaign)
