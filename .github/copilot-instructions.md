# Spec-Driven Delivery Instructions

## Source of Truth

For every implementation, bug fix, refactor, dependency, build, data, test, or UI task in this repository, read and use these documents before making a plan:

1. `docs/PRD.md` for product goals and scope.
2. `docs/DEVSPEC.md` for authoritative system behavior and architecture.
3. `docs/UISPEC.md` for user-facing layout, state, and accessibility requirements.
4. `docs/TESTSPEC.md` for required verification.

These are currently stored directly under `docs/`. If the repository later moves them to `docs/specs/`, update this instruction file in the same change.

When specifications and code differ, do not silently choose code. Identify the discrepancy, propose the required spec or code change, and get approval before intentionally changing behavior.

## Required Task Workflow

1. Before coding, create a task plan that names the relevant requirement IDs or sections in the four specifications and defines the validation method from `TESTSPEC.md`.
2. Implement only behavior covered by approved specs. For new behavior, update the appropriate specs before implementation or explicitly obtain approval to do so as part of the task.
3. Run the required automated and manual checks from `TESTSPEC.md`.
4. After a task is complete, tested, and human-approved, create and complete a separate **Spec Update** task before beginning unrelated work.

## Spec Update Task

For every affected spec, the task must:

1. Update `Status`.
2. Update `Last updated` to the current date in `YYYY-MM-DD` format.
3. Increment semantic versioning: patch for clarifications, minor for meaningful additions or behavior changes, and major for a replacement document.
4. Add a newest-first changelog entry at the bottom using exactly:

```text
YYYY-MM-DD — <author> — <one-sentence description of change>
```

5. Return a concise list of all spec changes, explicitly identifying additions, removals, and modified requirements.

Do not update changelogs for unapproved exploratory work. Do not claim human approval; wait for it to be stated by the user or review process.

## MCP Write Operations

The `curious-reader-cms` MCP server (see `docs/third-party-game-spec.md`, section 8) has write tools: `create_engine_slug`, `create_core_slug`, `upload_core_game`, `upload_book`, `upload_language_pack`, `begin_upload`, `upload_chunk`, `abort_upload`, `promote_content`, `demote_content`, `update_version_notes`, and `update_manifest`.

1. Run read-only tools first (`list_engine_slugs`, `list_core_slugs`, `list_inventory`) to check current state.
2. Before calling any write tool, state the exact tool and arguments, note whether it is irreversible (slug reservations are permanent), and wait for explicit user approval.
3. Never set `confirmed: true` on a slug tool until the user has approved the exact slug.
4. Never request, store, or echo MCP tokens; they are supplied only through the `mcp.json` password prompt.
5. Do not use `promote_content` or `demote_content` unless the user explicitly asks; promotion and publishing are staff-controlled.