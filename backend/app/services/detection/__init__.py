"""Detection rule package.

This is the split form of the former ``app.services.detection_rules``
single-file module. The public API is preserved: anything that was
importable from ``app.services.detection_rules`` is still importable
either from there (which is now a re-export shim) or directly from
``app.services.detection``.

Layout:
- ``base.py``      — ``DetectionRule``, ``RuleContext``, ``_build_alert``
- ``rules.py``     — all ``_eval_*`` functions and ``RULE_REGISTRY``
- ``metrics.py``   — ``DetectionMetrics`` and the module-level singleton
"""

from __future__ import annotations

from .base import DetectionRule, RuleContext, _build_alert
from .metrics import DetectionMetrics, detection_metrics
from .rules import (
    RULE_REGISTRY,
    get_all_rules,
    get_enabled_rules,
    get_rule,
)

__all__ = [
    "DetectionRule",
    "RuleContext",
    "_build_alert",
    "DetectionMetrics",
    "detection_metrics",
    "RULE_REGISTRY",
    "get_all_rules",
    "get_enabled_rules",
    "get_rule",
]
