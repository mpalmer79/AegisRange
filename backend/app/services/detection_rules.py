"""Backwards-compatible re-export shim.

The contents of this module were split into the ``app.services.detection``
package in 0.9.0. Every name that used to live here still imports from
here — only the implementation moved. See
``app/services/detection/__init__.py`` for the current layout.
"""

from __future__ import annotations

from app.services.detection import (  # noqa: F401
    RULE_REGISTRY,
    DetectionMetrics,
    DetectionRule,
    RuleContext,
    _build_alert,
    detection_metrics,
    get_all_rules,
    get_enabled_rules,
    get_rule,
)

__all__ = [
    "RULE_REGISTRY",
    "DetectionMetrics",
    "DetectionRule",
    "RuleContext",
    "_build_alert",
    "detection_metrics",
    "get_all_rules",
    "get_enabled_rules",
    "get_rule",
]
