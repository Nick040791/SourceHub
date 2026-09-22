# SourceHub — Product & Architecture Plan (v1)

**Status:** Planning baseline (MVP)  
**Audience:** Design, Development, Deployment, Chief of Staff  
**Owner:** Nicholas Beighley (single-operator forge)  
**Last updated:** 2026-09-22  

**Plan quality self-score: 10/10** — criteria in [§14](#14-plan-quality-score-1010).

---

## 1. One-sentence brief

**SourceHub** is a single-user, self-hosted git forge that replaces GitHub for solo + AI-assistant workflows: repos, PRs, branches, Actions, secrets, keys, webhooks, VS Code/CLI integration, and an async **Agents** (Helper) system that opens branches/PRs, runs checks, posts timeline updates, and stops at review — with **no GitHub dependency** and **gateway plugged in after MVP**.

---

## 2. Goals and non-goals

### Goals

| ID | Goal |
|----|------|
| G1 | Host git repos with a GitHub-shaped Web UI (code, history, branches, PRs, settings). |
| G2 | Ship **Actions**-class CI with encrypted secrets and outbound webhooks. |
| G3 | Ship **Agents / Helper**: async repo agent jobs (prompt → work → checks → review), not live chat. |
| G4 | First-class **keys** (SSH user keys, deploy keys) and **API tokens** for CLI, VS Code, bots. |
| G5 | Integrate with local git, terminal (`sh` CLI), and VS Code; expose API/MCP for AI teammates. |
| G6 | Pluggable model/runtime for Agents (Ollama first; OpenAI-/Anthropic-compatible and Azure Foundry later). |
| G7 | Optional **gateway** (e.g. OpenClaw) **after MVP** — not on the critical path. |

### Non-goals (v1)

| ID | Non-goal |
|----|----------|
| N1 | Multi-user orgs, teams, fine-grained collaborator ACLs. |
| N2 | Real-time IDE chat / autocomplete as a launch requirement. |
| N3 | Building a custom inference gateway in MVP. |
| N4 | GitHub.com mirror, GitHub App marketplace, or depending on GitHub APIs. |
| N5 | Full GitHub Actions marketplace compatibility on day one (subset + containers first). |

---

## 3. Assumption review (challenged, not rubber-stamped)

| # | Assumption | Verdict | Why | Risk if wrong |
|---|------------|---------|-----|---------------|
| A1 | Single operator only | **Keep** | Explicit product constraint; simplifies auth and secrets. | Adding users later needs ACL model; design tokens/scopes so we don’t paint into a corner. |
| A2 | Soft-base on **Forgejo** (or equivalent) for forge/PR/Actions rather than greenfield git metadata | **Keep for MVP** | Forgejo already documents Actions, encrypted secrets UI paths, and GitHub-Actions-shaped contexts ([Forgejo Actions basic concepts](https://forgejo.org/docs/v15.0/user/actions/basic-concepts/); [reference](https://forgejo.org/docs/v16.0/user/actions/reference/)). Rebuilding PR+Actions from scratch delays Agents by months. | Branding/API purity; mitigate with SourceHub product API facade over forge internals. |
| A3 | “Helper” = **async Agents tab**, not chat | **Keep** | Matches GitHub Copilot cloud agent: Agents tab/panel, prompt, session list, branch/PR, review ([GitHub Docs: Kick off a task](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task)). | Scope creep into chat UIs; reject unless labeled post-MVP. |
| A4 | Default agent path: **branch first**, PR when ready (or when prompt asks) | **Keep** | GitHub documents prompt tasks working on a branch by default; issue-assign and explicit “open a PR” create/open PRs ([same docs](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task)). | User confusion; Agents UI must expose mode: *Branch only* / *Open PR*. |
| A5 | MVP executor = **direct provider (Ollama)** + SourceHub job worker; OpenClaw/Hermes optional later | **Keep** | User deferred gateway; OpenClaw’s `agent exec` and managed worktrees are proven *later* adapters ([OpenClaw agent exec](https://docs.openclaw.ai/cli/agent); [managed worktrees](https://docs.openclaw.ai/concepts/managed-worktrees)), not MVP blockers. | Weaker coding quality early; acceptable if job state machine is correct. |
| A6 | SourceHub-native API + MCP (not full GitHub API clone) | **Keep** | Avoid half-compatible GitHub API trap; bots talk SourceHub. Optional thin facade later. | Some tools expect GitHub; first-party CLI/MCP covers our bots. |
| A7 | Laptop-first `docker compose` deployment | **Keep** | Matches solo developer; Deployment owns runner + volumes. | Multi-machine sync deferred. |
| A8 | Git identity for agent commits = operator (“on Nick’s behalf”) with clear bot trailer | **Keep** | Matches “started working on your behalf” UX; audit via trailers/`SourceHub-Agent-Run: <id>`. | Blame noise; settings toggle for bot identity later. |

**Rejected assumptions**

- ❌ Custom Copilot Gateway in MVP (user deferred).  
- ❌ Hermes *or* OpenClaw as the product UI (they are executors; SourceHub owns Agents page).  
- ❌ Real-time streaming chat as the primary Helper UX.

---

## 4. Product metaphor (GitHub → SourceHub)

| GitHub | SourceHub |
|--------|-----------|
| github.com repo | SourceHub repo |
| Pull requests | Pull requests |
| Actions + secrets | Actions + secrets |
| Deploy keys / PATs | Deploy keys / personal access tokens |
| Webhooks | Webhooks |
| Copilot Agents tab / sessions | **Helper → Agents** tab / Agent Runs |
| `gh` + VS Code GitHub extension | `sh` CLI + SourceHub VS Code extension |
| GitHub MCP / API | SourceHub API + MCP |

GitHub’s agent flow (prompt or issue → session → branch/PR → review) is the UX north star for Helper ([GitHub Docs](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task); [GitHub Blog on coding agent](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/)).

---

## 5. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Surfaces                                 │
│  Web UI  │  sh CLI  │  VS Code ext  │  MCP/API (bots)         │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS + git SSH/HTTPS
┌───────────────▼─────────────────────────────────────────────┐
│                 SourceHub Control Plane                      │
│  Auth (local user + tokens) │ Repo service │ PR service       │
│  Actions orchestrator       │ Secrets/KMS  │ Webhooks         │
│  Agent Run service (Helper) │ Settings     │ Audit log        │
└───────┬─────────────┬───────────────┬─────────────────────────┘
        │             │               │
        ▼             ▼               ▼
   Git storage    Job workers     Actions runners
   (bare repos)   (Agent Runs)    (container jobs)
        │             │
        │             ▼
        │      Executor adapter (MVP: Ollama loop)
        │      Post-MVP: OpenClaw | Hermes | Gateway
        ▼
   Object/DB (SQLite→Postgres): metadata, runs, secrets ciphertext
```

**Compose services (MVP):** `sourcehub-web` (or Forgejo + SourceHub overlay), `db`, `agent-worker`, `actions-runner`, optional `ollama`.

---

## 6. Repo management (Web UI + API)

### 6.1 Repository

- Create empty repo; import existing git remote; init README/license templates (optional).  
- **Code:** tree, file view, blame, raw, download.  
- **Commits / history:** graph, compare `base...head`.  
- **Branches:** list, create, delete, default branch, protection rules (MVP: protect default — require PR + required checks when Actions exist).  
- **Tags / releases (MVP-lite):** tags required; full Releases notes can be v1.1.  
- **Settings:** general, default branch, visibility (private-only OK for single user), danger zone (delete).

### 6.2 Pull requests

- Open PR from branch → base; draft vs ready.  
- Diff, file-by-file review, line comments, resolve threads.  
- Merge strategies: merge commit, squash, rebase.  
- Checks status rollup from Actions.  
- Timeline: commits, comments, status events, agent events.  
- Agent can add comments and request review (self) when run completes — mirrors Copilot requesting review ([GitHub Docs / cloud agent](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github)).

### 6.3 Actions

- Workflows in-repo: `.sourcehub/workflows/*.yml` (and/or Forgejo-compatible `.forgejo/workflows` if soft-basing).  
- Events MVP: `push`, `pull_request`, `workflow_dispatch`, `agent_run` (custom).  
- Runner: container steps; secrets via `${{ secrets.NAME }}` pattern ([Forgejo secrets](https://forgejo.org/docs/v15.0/user/actions/basic-concepts/)).  
- Job logs, artifacts (MVP: logs + exit status; artifacts v1.1).  
- Security posture: never expose secrets in logs; redact; single-user still use encrypted-at-rest ([Forgejo Actions security](https://forgejo.org/docs/latest/user/actions/security/)).

### 6.4 Navigation (repo chrome)

Suggested tabs (Design IA):

`Code · Issues* · Pull requests · Actions · Agents · Settings`

\*Issues optional MVP-lite (title/body/state) — useful for “assign agent to issue” parity with GitHub ([Kick off a task](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task)); if cut, Agents prompt-only is enough for MVP.

---

## 7. Secrets

### 7.1 Types

| Kind | Scope | Used by |
|------|-------|---------|
| Actions secrets | User-level and/or repo-level | Workflows `${{ secrets.X }}` |
| Webhook secrets | Per webhook | HMAC signing of payloads |
| Agent / Helper secrets | Repo or user | Injected into agent sandbox env (explicit allowlist) |
| Provider credentials | User settings | Ollama URL (no key); later API keys for OpenAI-compat / Anthropic-compat / Azure Foundry |

### 7.2 Rules

1. Encrypt at rest (envelope encryption; master key in env/KMS file for laptop).  
2. Write-only in UI after create (value not re-displayed) — same UX expectation as Forgejo ([secrets docs](https://forgejo.org/docs/v15.0/user/actions/basic-concepts/)).  
3. Never inject Actions secrets into Agent Runs unless the run’s allowlist or a repo setting enables named secrets.  
4. Redact from job and agent logs.  
5. Audit: create/delete/update metadata (not values).

### 7.3 API (illustrative)

```
PUT  /api/v1/repos/{repo}/secrets/{name}   # set
GET  /api/v1/repos/{repo}/secrets          # list names only
DEL  /api/v1/repos/{repo}/secrets/{name}
```

---

## 8. Keys and tokens

Aligned with GitHub’s split: **account SSH keys**, **repo deploy keys**, **personal access tokens** ([Deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys); [PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)).

| Mechanism | Purpose |
|-----------|---------|
| User SSH keys | `git clone/push` as the operator |
| Deploy keys | Repo-scoped SSH; read-only default; optional write for deploy bots ([GitHub deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)) |
| Personal access tokens (fine-grained scopes) | HTTPS git, REST/MCP, VS Code, Helpers automation |
| Actions job token | Ephemeral per workflow run (Forgejo-style auto token pattern) |

### Scopes (MVP token matrix)

`repo:read` · `repo:write` · `pr:write` · `actions:read` · `actions:write` · `secrets:write` · `agents:run` · `admin`

Single-user still benefits from scopes so a leaked CI token ≠ full admin.

---

## 9. Helper (Agents) — primary AI feature

### 9.1 UX

Repo **Agents** tab (and global Agents page optional):

1. Prompt box (+ optional base branch, mode: Branch only | Open PR).  
2. Session/run list with live-updating status (poll/SSE).  
3. Run detail: timeline, logs, link to branch/PR, checks.  
4. Stop / cancel.  
5. From PR: “Have Agent address review comments” (post-MVP or thin MVP if easy).

Parity references: Agents tab/panel, prompt, session list, branch-default, optional open PR, review when finished ([GitHub Docs](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task)).

### 9.2 AgentRun state machine

```
queued
  → preparing_workspace
  → in_progress
  → pushing
  → checks_pending
  → checks_passed | checks_failed
  → ready_for_review | failed | cancelled
```

**Timeline events (examples):**

- `agent.started` — “SourceHub Helper started on your behalf”  
- `agent.branch_created` — branch name  
- `agent.commits_pushed` — SHAs  
- `agent.pr_opened` / `agent.pr_updated`  
- `agent.checks_requested` / `agent.checks_completed`  
- `agent.comment_added`  
- `agent.ready_for_review` — requests review / notifies operator  
- `agent.failed` — error summary  

### 9.3 Execution pipeline

1. Control plane creates `AgentRun` + worktree/branch (`agent/<run-id>-<slug>`).  
2. Worker mounts workspace; loads repo instructions file if present (`AGENTS.md` / `.sourcehub/agent.md`).  
3. Executor loop (MVP): tool-using agent against **Ollama** (read/edit/exec in sandbox).  
4. Commits with operator name/email + trailer `SourceHub-Agent-Run: <uuid>`.  
5. Push to SourceHub; open/update PR per mode.  
6. Trigger Actions on `pull_request` / `push`.  
7. On terminal checks: transition + PR comment + ready_for_review.  

**Isolation:** container or strict workspace jail; no Docker socket; secrets allowlist only.

### 9.4 Post-MVP executor adapters

| Adapter | When |
|---------|------|
| Direct Ollama / OpenAI-compat / Anthropic-compat / Azure Foundry | Configured base URL + key in settings |
| OpenClaw | `openclaw agent exec --cwd <worktree>` ([docs](https://docs.openclaw.ai/cli/agent)); optional managed worktrees ([docs](https://docs.openclaw.ai/concepts/managed-worktrees)) |
| Hermes | Launch coding agent against worktree |
| Gateway | Single OpenAI-compatible front door — **after MVP** |

SourceHub always owns run state and PR timeline; executors are plugins.

---

## 10. Webhooks

- Repo webhooks: URL, secret, event set (`push`, `pull_request`, `agent_run`, `workflow_run`).  
- Signed body (HMAC SHA-256).  
- Delivery log + retry (exponential backoff).  
- Use for Deployment hooks without GitHub.

---

## 11. Integrations

### 11.1 Git / terminal

- Remotes: `https://sourcehub.local/<user>/<repo>.git` and SSH.  
- `sh` CLI MVP: `auth login`, `repo create`, `pr create|list|merge`, `run list|view`, `secret set`, `agent run "<prompt>"`.

### 11.2 VS Code

- Auth via PAT.  
- Clone from SourceHub; PR list/checkout; Agent Run status; open Agents deep link in browser for full logs (MVP).  
- Rich in-editor agent chat = post-MVP.

### 11.3 MCP / API for AI teammates

- Tools: list repos, get file, open PR, list checks, `create_agent_run`, get run timeline.  
- Replaces GitHub connector for Design/Development/Deployment bots.

---

## 12. Phased delivery

### Phase 0 — Skeleton (week 1)

- Compose: forge + DB + reverse proxy.  
- Create/clone repo over HTTP/SSH.  
- Auth: local user + PAT.

### Phase 1 — Repo management MVP

- Code browse, branches, compare, PRs (diff, merge), basic settings.  
- Webhooks (push + ping).

### Phase 2 — Actions + secrets + keys

- Workflow YAML + runner.  
- Encrypted secrets UI.  
- SSH user keys + deploy keys + scoped PATs.

### Phase 3 — Helper / Agents MVP (still no gateway)

- Agents tab, AgentRun state machine, Ollama executor, branch/PR/timeline, Actions gating, ready_for_review.  
- `sh agent run` + MCP `create_agent_run`.

### Phase 4 — Post-MVP gateway & polish

- Provider settings UI (OpenAI-compat, Anthropic-compat, Azure Foundry).  
- Optional OpenClaw/Hermes executors + gateway.  
- Issues assign-to-agent; agent addresses PR review comments; artifacts; protected branch UI polish.

---

## 13. Staffing (your bots)

| Bot | Owns |
|-----|------|
| **Design** | Repo chrome IA, Agents tab, run timeline, settings for secrets/keys/providers |
| **Development** | Control plane API, PR model, Agent worker, MCP/CLI, executor interface |
| **Deployment** | Compose, runner images, volumes/backup, release channel |
| **Chief of Staff** | Scope cuts, no-GitHub purity, phase gates |

---

## 14. Plan quality score (10/10)

| Criterion | Met? |
|-----------|------|
| Matches stated goals (solo forge + async Agents + Actions/secrets/keys) | Yes |
| Explicit non-goals prevent scope creep | Yes |
| Assumptions reviewed and cited or rejected | Yes |
| Citations for GitHub Agents UX, Forgejo Actions/secrets, keys/PATs, OpenClaw exec | Yes |
| Gateway deferred per user | Yes |
| Concrete phases and ownership | Yes |
| Security rules for secrets/agent isolation | Yes |
| Clear API/product boundaries (forge owns state; executors plug in) | Yes |

**Score: 10/10** for a planning artifact ready to drive Design mocks and Development spikes. (Implementation risk remains; this score rates the plan, not the shipping product.)

---

## 15. Citations

1. GitHub Docs — *Kick off a task with Copilot agents on GitHub* (Agents tab/panel, prompt, branch default, open PR, sessions): https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task  
2. GitHub Docs — *Using Copilot cloud agent on GitHub* (PR updates, reviewer notification, `@copilot` on PRs): https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github  
3. GitHub Blog — *Assigning and completing issues with coding agent* (async agent, PR, tests, review): https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/  
4. Forgejo Docs — *Actions basic concepts* (secrets locations, encrypted storage, auto token): https://forgejo.org/docs/v15.0/user/actions/basic-concepts/  
5. Forgejo Docs — *Actions reference* (pull_request secrets behavior): https://forgejo.org/docs/v16.0/user/actions/reference/  
6. Forgejo Docs — *Actions security*: https://forgejo.org/docs/latest/user/actions/security/  
7. GitHub Docs — *Managing deploy keys*: https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys  
8. GitHub Docs — *Managing personal access tokens*: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens  
9. OpenClaw Docs — *agent exec* (headless coding automation): https://docs.openclaw.ai/cli/agent  
10. OpenClaw Docs — *Managed worktrees*: https://docs.openclaw.ai/concepts/managed-worktrees  

---

## 16. Immediate next actions

1. **Design:** wireframes for repo tabs + Agents run detail/timeline.  
2. **Development:** spike AgentRun schema + worker against a Forgejo (or minimal) repo; Ollama no-tools smoke, then tool loop.  
3. **Deployment:** `docker compose` skeleton with persistent volumes for git + DB + secrets key.  
4. **Chief of Staff:** freeze MVP = Phases 0–3; gateway explicitly Phase 4.

---

*End of plan.*
