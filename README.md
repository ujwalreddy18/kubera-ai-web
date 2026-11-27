# KUBERA AI

This repository holds the full KUBERA AI project from [KundanSadhu/KUBERA-AI](https://github.com/KundanSadhu/KUBERA-AI) (desktop prototype, Tauri/Rust core, docs) plus a standalone **web edition** in `index.html`.

## Web edition (`index.html`)

A browser version of [KUBERA AI](https://github.com/KundanSadhu/KUBERA-AI), the local-first business-operations workspace. You state a business goal, a manager agent deploys a fixed, capability-limited team, and the team produces a real Office file from your local records.

> **File first, chat second.** The output is an openable PPTX, DOCX or XLSX, not a long chat reply.

### Run it

It is one static file. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

To host it free, turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root).

### Features

**From the original README**
- Missions: type a goal, e.g. `Build a Q3 pipeline deck for Acme Corp`
- Workforce: Asha (Manager), Maya (Market Analyst), W-1 (Operations Analyst), W-2 (Document Worker), Sentinel (Reviewer)
- Report Center with PPTX / DOCX / XLSX badges
- Business records: clients and projects
- Schedules with cron, timezone and next run
- Activity / audit feed, settings, reset demo data

**Added in this edition**
- Sign in / create account: passwords hashed with PBKDF2, each account gets its own workspace, "keep me signed in" option, sign out from the sidebar or menu. Accounts live in the browser only (no server).
- Real file generation in the browser: 6-slide PPTX with chart and table, DOCX account report, XLSX workbook with SUM / SUMIF formulas
- Live task graph: Manager → Analysts → Document Worker → Reviewer, with handoffs and cancel
- Sentinel checks (Office package header, file type, size, provenance) before a file reaches you
- Human approval queue: approve, or reject with required feedback and re-run with that feedback
- KPI strip and pipeline-by-stage chart (live, weighted, at-risk, closed won)
- Records: add / edit / delete, search, stage filter, sortable columns, all-or-nothing CSV import with line-level errors, CSV export
- Working cron parser with next-run preview; due schedules start a mission while the page is open
- Fixed agent pool with least-load assignment; one manager at a time, missions queue
- Command menu (`Ctrl K`), light / dark / auto theme, USD / INR / EUR, JSON backup and restore, audit log export
- Optional Claude-written analyst narrative when opened inside Claude (figures always computed locally)
- Mobile bottom navigation, 44 px touch targets, tables become cards on phones, inline form errors, focus-trapped dialogs, AA contrast

### Stack

Vanilla HTML / CSS / JS, no build step. Office files via [PptxGenJS](https://github.com/gitbrent/PptxGenJS), [docx](https://github.com/dolanmiu/docx) and [SheetJS](https://sheetjs.com) from CDNs. Data stays in `localStorage`.

### Credit

Based on [KundanSadhu/KUBERA-AI](https://github.com/KundanSadhu/KUBERA-AI) (Apache-2.0).

---

## Desktop prototype (original project)

KUBERA AI is a local-first desktop business-operations workspace. A user states a business goal; a controlled manager agent deploys a small, capability-limited team of specialist subagents; KUBERA produces a real Office artifact and stores it in a traceable Report Center.

> **File first, chat second.** The product outcome is an openable PPTX, DOCX, or XLSX—not a long chat response.

### Current implementation status

This repository contains the implementation starting point for the KUBERA vertical slice:

- A running vanilla HTML/CSS/JS interface with Missions, Workforce, Reports, Records, Settings, activity events, and browser-local demo persistence.
- A source layout prepared for the intended Tauri v2/Rust core.
- Detailed product, agent, backend, security, and deployment documentation in [`docs/`](docs/).
- A working deterministic local agent runtime for UI development: it selects business records, produces source-linked analyst handoffs, builds an artifact plan, and validates provenance.
- A durable desktop P0 source slice: SQLite hydration/restart reconciliation, governed task/run/handoff persistence, loopback OpenCode session/SSE routing, and typed OfficeCLI PPTX generation.
- A KUBERA-owned OpenCode policy that uses the official free `opencode/deepseek-v4.1-flash-free` model for the bounded manager request. Its lightweight OpenCode alternative is `opencode/glm-5.3-flash-free`; model changes are never silent mid-run.

Native Tauri verification still requires a host with the platform GUI dependencies (and a Windows host/runner for the shipping target). See [`docs/setup.md`](docs/setup.md) and [`docs/integration-status.md`](docs/integration-status.md) for the exact source-versus-runtime evidence.

### Demo prompt

```text
Build a Q3 pipeline deck for Acme Corp
```

In the UI prototype this deploys:

1. **Asha — Manager** to create a bounded workforce plan.
2. **Maya — Market Analyst** to produce opportunity/risk findings.
3. **W-1 — Operations Analyst** to produce pipeline metrics.
4. **W-2 — Document Worker** to produce the final presentation artifact.
5. **Sentinel — Reviewer** to validate the result.

### Repository map

```text
kubera-ai/
├── docs/                 # Product and engineering documentation
├── src/                  # Static vanilla frontend implementation
├── src-tauri/            # Planned Tauri/Rust desktop core
├── package.json          # Lightweight local preview scripts
├── LICENSE               # Apache-2.0
└── CONTRIBUTING.md
```

### Run the UI prototype

```bash
npm install
npm run dev
```

Open the local URL printed by the server. The prototype uses `localStorage` only, so it is safe to reset via **Settings → Reset demo data**.

### Planned desktop execution

Once Rust and Tauri prerequisites are installed:

```bash
npm install
cd src-tauri
cargo tauri dev
```

The desktop implementation will replace browser-local persistence with SQLite, run OpenCode as a loopback-only sidecar, and expose only constrained OfficeCLI operations.

### What KUBERA is not

- Not a general chatbot.
- Not a coding agent or unrestricted shell agent.
- Not a hidden recursive swarm of agents.
- Not a cloud CRM or a multi-user platform in the vertical slice.

### Documentation

| Document | Purpose |
|---|---|
| [Architecture](docs/architecture.md) | Component boundaries, data flow, sidecars, and security model |
| [Working model](docs/working.md) | End-to-end mission and schedule behavior |
| [Setup](docs/setup.md) | Local development and packaging setup |
| [Backend](docs/backend.md) | SQLite schema, Tauri command contract, and Rust implementation plan |
| [Tech stack](docs/tech-stack.md) | Technology decisions and version/pinning rules |
| [Agents](docs/agents.md) | Manager/subagent workforce, handoffs, prompts, and guardrails |
| [Features](docs/features-list.md) | Scope, acceptance criteria, and roadmap |
| [Problems & solutions](docs/problems-solutions.md) | Risk register and mitigations |
| [Security](docs/security.md) | Threat model and least-privilege controls |
| [Demo script](docs/demo-script.md) | Repeatable acceptance demo |
| [Integration status](docs/integration-status.md) | What is running, source-implemented, and still needs host validation |
| [Markus-inspired workforce](docs/markus-inspired-workforce.md) | Team board, peer-review gate, workspaces, and patrol adaptation |
| [Peer review](docs/peer-review.md) | Structured-handoff and final-artifact delivery gates |
| [Agent workflow test](docs/agent-workflow-test.md) | Automated and manual verification of the workforce path |

### License

Apache License 2.0. See [`LICENSE`](LICENSE).
