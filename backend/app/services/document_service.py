from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.store import InMemoryStore


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
    def __init__(self, store: InMemoryStore) -> None:
        self.store = store
        self.documents = {
            "doc-001": Document(document_id="doc-001", classification="public"),
            "doc-002": Document(document_id="doc-002", classification="internal"),
            "doc-003": Document(document_id="doc-003", classification="restricted"),
        }

    def can_read(
        self, actor_role: str, document_id: str
    ) -> tuple[bool, Document | None]:
        document = self.documents.get(document_id)
        if not document:
            return False, None

        role_level = CLASSIFICATION_ORDER.index(
            ROLE_CLEARANCE.get(actor_role, "public")
        )
        doc_level = CLASSIFICATION_ORDER.index(document.classification)
        return role_level >= doc_level, document

    def can_download(
        self, actor_role: str, document_id: str, actor_id: str | None = None
    ) -> tuple[bool, Document | None]:
        document = self.documents.get(document_id)
        if not document:
            return False, None

        if (
            self.store
            and actor_id
            and self.store.is_download_restricted(actor_id)
        ):
            return False, document

        role_level = CLASSIFICATION_ORDER.index(
            ROLE_CLEARANCE.get(actor_role, "public")
        )
        doc_level = CLASSIFICATION_ORDER.index(document.classification)
        return role_level >= doc_level, document
