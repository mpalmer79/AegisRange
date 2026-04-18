Refactor the existing VeriFlow Phase 0 and Phase 1 implementation with targeted schema and service improvements only. Do not broaden scope. Do not start Phase 2 rule engine implementation yet. This is a focused cleanup pass before moving forward.

Project reminder:
VeriFlow is a workflow intelligence platform that enforces process compliance, detects operational risk, and explains why a record is blocked, warned, or ready to proceed. The first scenario is healthcare intake and compliance workflow. This is not an EHR, scheduling system, or CRM clone.

Your task is to make the following corrections and improvements to the existing codebase.

1. Fix Rule.code uniqueness scope

Current issue:
Rule.code is globally unique, which is too restrictive for a multi-workflow and future multi-tenant system.

Required change:
- Remove global uniqueness from Rule.code
- Enforce uniqueness at the workflow level instead
- Add an explicit composite uniqueness constraint for:
  - workflow_id + code

Acceptance criteria:
- Multiple workflows can reuse the same rule code
- The same workflow cannot have duplicate rule codes

2. Add missing relationships to Rule and AuditLog

Required changes:

For Rule:
- Add SQLAlchemy relationship fields for:
  - workflow
  - stage

For AuditLog:
- Add SQLAlchemy relationship fields for:
  - organization
  - actor_user
  - record

Acceptance criteria:
- These relationships are defined cleanly and do not break existing tests
- Model readability and service-layer usage improve

3. Add index to assigned_user_id on Record

Required change:
- Ensure assigned_user_id is indexed for dashboard and filtering performance

Acceptance criteria:
- Record model includes index support for assigned_user_id
- Migration or schema update reflects this correctly

4. Strengthen RuleEvaluation model for future explainability

Current issue:
The model is too thin and will weaken auditability and explainability.

Required changes:
- Keep existing structure if needed for compatibility, but improve semantics
- Add:
  - risk_applied (integer, default 0)
- Replace or improve the meaning of triggered by adding clearer evaluation state

Preferred direction:
- Use:
  - passed: boolean
  - action_applied: enum or string with values like none, warn, block
- If replacing triggered is too disruptive, preserve backward compatibility but still add:
  - passed
  - action_applied
  - risk_applied

Acceptance criteria:
- RuleEvaluation clearly communicates evaluation result
- Historical risk contribution is persisted
- Existing services/tests are updated as needed

5. Enforce workflow-stage consistency in service logic

Current issue:
A Record can potentially reference a current_stage_id that does not belong to its workflow_id.

Required change:
- Add service-layer validation so that:
  - when creating a record
  - when updating a record
  - when assigning or changing current_stage_id
  the stage must belong to the record’s workflow

Acceptance criteria:
- Invalid workflow/stage combinations are rejected with a clear error
- This logic is implemented in the appropriate service layer, not scattered in routes
- Existing APIs remain clean

6. Add tests for workflow-stage consistency

Add or update pytest tests for:
- record creation fails when current_stage_id does not belong to workflow_id
- record update fails when assigning a stage from another workflow
- valid workflow-stage pair succeeds

Acceptance criteria:
- Tests are meaningful and pass
- Coverage improves around service-layer integrity rules

7. Update docs where needed

Update the following only if necessary to reflect the refactor:
- ARCHITECTURE.md
- docs/architecture.md if it exists
- README.md only if schema semantics or model behavior are mentioned there

Do not rewrite docs broadly. Only make precise corrections related to:
- workflow-scoped rule codes
- rule evaluation semantics
- workflow-stage integrity validation

Constraints:
- Do not introduce a no-code rule builder
- Do not implement the full rule engine yet
- Do not expand frontend scope
- Do not refactor unrelated files just for style
- Keep comments minimal and human-written
- Maintain production-minded structure and clean separation of concerns

Deliverables:
- updated models
- any required migration/schema adjustments
- updated services
- updated tests
- brief summary of what changed and why

Acceptance criteria for the whole task:
- existing functionality still works
- new integrity rules are enforced
- tests pass
- schema is stronger and better aligned with the project’s long-term direction
