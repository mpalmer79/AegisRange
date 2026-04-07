from __future__ import annotations

from dataclasses import dataclass


ROLE_CLEARANCE = {
    "analyst": "internal",
    "admin": "restricted",
    "unknown": "public",
}

CLASSIFICATION_ORDER = ["public", "internal", "restricted"]


@dataclass(frozen=True)
class Document:
    document_id: str
    classification: str


class DocumentService:
    def __init__(self) -> None:
        self.documents = {
            "doc-001": Document(document_id="doc-001", classification="public"),
            "doc-002": Document(document_id="doc-002", classification="internal"),
            "doc-003": Document(document_id="doc-003", classification="restricted"),
        }

    def can_read(self, actor_role: str, document_id: str) -> tuple[bool, Document | None]:
        return self._can_access(actor_role, document_id)

    def can_download(self, actor_role: str, document_id: str) -> tuple[bool, Document | None]:
        return self._can_access(actor_role, document_id)

    def _can_access(self, actor_role: str, document_id: str) -> tuple[bool, Document | None]:
        document = self.documents.get(document_id)
        if not document:
            return False, None

        role_level = CLASSIFICATION_ORDER.index(ROLE_CLEARANCE.get(actor_role, "public"))
        doc_level = CLASSIFICATION_ORDER.index(document.classification)
        return role_level >= doc_level, document
