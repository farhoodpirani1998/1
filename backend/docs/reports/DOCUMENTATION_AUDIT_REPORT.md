# Documentation Audit Report

Audit performed as part of preparing this repository for a public GitHub
release. Scope: every markdown file in the repository, cross-checked
against source code (migrations, entities, controllers, services) rather
than trusted at face value.

## Starting State

Before this pass, the repository had 12 markdown files, 10 of them
sitting directly in the backend root, no `README.md` anywhere, and no
`docs/` subfolder structure:

```
ARCHITECTURE_CHANGES.md
PHASE_5B.md, PHASE_5D.md, PHASE_5E.md, PHASE_5F.md, PHASE_5G.md,
PHASE_5H.md, PHASE_5K.md, PHASE_5M.md, PHASE_5N.md
docs/DEPLOYMENT.md
docs/security-roadmap.md
test/README.md
```

## Findings

### 1. No root README

No `README.md` existed anywhere in the project. A new one was written
from scratch (package.json, main.ts, roles.enum.ts, and the docs
directory itself were the source of truth — nothing was invented). See
`README.md`.

### 2. Outdated / already-resolved TODOs in `docs/security/security-roadmap.md`

Two items in the "Authorization TODO" list described gaps that source
code shows are already closed:

- **JWT staleness on deactivation.** The roadmap described this as the
  "highest priority" open gap and listed three unbuilt options. Source
  shows option 2 (a `token_version` column, bumped on deactivation,
  checked by `JwtStrategy`) was already implemented
  (`1736400000000-UserTokenVersion` migration, `UsersService.setActive()`,
  `AuthService.changePassword()`) and is covered by
  `auth-security.e2e-spec.ts`. Rewritten to state this accurately, and to
  note the one part of the original concern — role *demotion* — that
  remains moot only because no role-change endpoint exists yet, not
  because it was fixed.
- **`RolesGuard` open-by-default audit.** The roadmap named two specific
  unguarded routes (`GET /payments`, `GET /reports/student/:id/statement`)
  as needing an audit pass. Both controllers now carry
  `@Roles('school_admin', 'accountant')`, with inline comments confirming
  the fix ("previously had no `@Roles` here"). Rewritten to reflect the
  closed state while preserving the general open-by-default design note,
  which is still accurate and still worth knowing.

No other claims in this file were found to be inaccurate — the
`Permission` enum's 3-action scope, the plain-string `@Roles(...)` usage,
and the dynamic-permissions non-goal were all verified against current
source and left as-is.

### 3. Duplicated / conflicting information

None found. Each existing document covers a distinct migration or
feature; no two files described the same behavior differently.

### 4. Broken internal links

One cross-reference existed in the entire repository:
`docs/DEPLOYMENT.md` referencing `ARCHITECTURE_CHANGES.md` and
`docs/security-roadmap.md` by their pre-move paths. Both were rewritten
as relative links (`../architecture/ARCHITECTURE_CHANGES.md`,
`../security/security-roadmap.md`) reflecting the new structure. No
other markdown file contained a link to another markdown file.

### 5. Undocumented phases

Six "Phase 5" letters have no source-code trace of ever having existed
(5A/5C/5I/5J/5L are real; nothing in migrations, entities, or comments
suggests a 5C variant, a "Phase 5J" other than Analytics, etc. beyond
what's listed in the Coverage Report). Four small, real, undocumented
phases were found through migration comments and code comments
(`grep -rn "Phase 5" src`), not guessed:

| Phase | What it added | Disposition |
|---|---|---|
| 5A | `parent` role + `parent_students` table | Merged into `PHASE_5A_5C_PARENT_FOUNDATIONS.md` — too small alone (one join table, one enum value) |
| 5C | `notifications.type` / `read_at` + upcoming-due cron | Merged into the same file — two columns and one cron job |
| 5I | Student document references | Substantial enough (own module, own entity, four routes, parent-portal integration) for its own document — `PHASE_5I.md` |
| 5J | Analytics dashboard | Substantial (699 lines, composes six other modules) and reporting-related — qualifies per the "reporting" exception — `PHASE_5J.md` |
| 5L | Homework & assignments | Same reasoning as 5I — own module, own entity, full CRUD surface — `PHASE_5L.md` |

No phase document was invented for anything not traceable to an actual
migration, entity, or controller.

### 6. Obsolete comments found but not fixed

`src/main.ts` contains a comment referencing `docs/DEPLOYMENT.md` (now
`docs/deployment/DEPLOYMENT.md`). This is a source-code comment, not a
markdown link, and per this audit's scope source code is not modified
except where fixing a *markdown* link requires a path update. Flagged
here for a future pass rather than changed in this one.

### 7. Documents left unchanged (verified accurate, no action needed)

- `docs/architecture/ARCHITECTURE_CHANGES.md` (Persian-language financial
  architecture delivery summary) — content matches
  `src/modules/ledger`, `src/common/authorization`,
  `src/common/events/domain-events.ts`, and the
  `LedgerStateMachineIdempotency` migration.
- `docs/testing/TESTING.md` (moved from `test/README.md`, content
  unchanged) — file layout, commands, and the e2e-file-to-guarantee table
  were spot-checked against `test/*.e2e-spec.ts` and `package.json`
  scripts; all accurate.
- `PHASE_5B.md`, `PHASE_5D.md` through `PHASE_5N.md` (moved, content
  unchanged) — each was spot-checked against its corresponding migration
  and module; no inaccuracies found.

## Summary of Changes

- **Moved:** 12 existing files into the new `docs/` structure (see
  Repository Structure Report).
- **Created:** `README.md` (new), 4 new development-history documents
  (`PHASE_5A_5C_PARENT_FOUNDATIONS.md`, `PHASE_5I.md`, `PHASE_5J.md`,
  `PHASE_5L.md`), and this `docs/reports/` folder (3 files).
- **Edited:** `docs/security/security-roadmap.md` (2 outdated items
  corrected), `docs/deployment/DEPLOYMENT.md` (1 broken link fixed).
- **Deleted:** nothing. Every file that existed before this pass still
  exists, just relocated.
