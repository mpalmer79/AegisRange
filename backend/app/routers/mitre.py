"""MITRE ATT&CK routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import mitre_service, require_role
from app.schemas import MitreMappingResponse, MitreCoverageResponse, MitreTacticCoverageResponse, MitreTechniqueResponse
from app.serializers import mitre_mapping_to_dict, mitre_technique_to_dict

router = APIRouter(prefix="/mitre", tags=["mitre"], responses={401: {"description": "Missing or invalid token"}})


@router.get("/mappings", response_model=list[MitreMappingResponse], dependencies=[Depends(require_role("viewer"))])
def get_mitre_mappings() -> list[dict]:
    mappings = mitre_service.get_all_mappings()
    return [mitre_mapping_to_dict(m) for m in mappings]


@router.get("/mappings/{rule_id}", response_model=MitreMappingResponse, dependencies=[Depends(require_role("viewer"))])
def get_mitre_mapping(rule_id: str) -> dict:
    mapping = mitre_service.get_mapping(rule_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mitre_mapping_to_dict(mapping)


@router.get("/coverage", response_model=list[MitreCoverageResponse], dependencies=[Depends(require_role("viewer"))])
def get_mitre_coverage() -> list[dict]:
    entries = mitre_service.get_coverage_matrix()
    return [
        {
            "tactic_id": e.tactic_id,
            "technique_id": e.technique_id,
            "technique_name": next(
                (
                    t.name
                    for t in mitre_service._techniques.values()
                    if t.id == e.technique_id
                ),
                e.technique_id,
            ),
            "rule_ids": e.rule_ids,
            "scenario_ids": e.scenario_ids,
            "covered": e.covered,
        }
        for e in entries
    ]


@router.get("/tactics/coverage", response_model=list[MitreTacticCoverageResponse], dependencies=[Depends(require_role("viewer"))])
def get_mitre_tactic_coverage() -> list[dict]:
    coverage = mitre_service.get_tactic_coverage()
    return [
        {
            "tactic_id": tactic_id,
            "tactic_name": data["name"],
            "covered_techniques": data["covered_techniques"],
            "total_techniques": data["total_techniques"],
            "percentage": data["percentage"],
        }
        for tactic_id, data in coverage.items()
    ]


@router.get(
    "/scenarios/{scenario_id}/ttps", response_model=list[MitreTechniqueResponse], dependencies=[Depends(require_role("viewer"))]
)
def get_mitre_scenario_ttps(scenario_id: str) -> list[dict]:
    techniques = mitre_service.get_scenario_ttps(scenario_id)
    return [mitre_technique_to_dict(t) for t in techniques]
