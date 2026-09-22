import {
  Repository,
  FileItem,
  Commit,
  PullRequest,
  WorkflowRun,
  AgentRun,
  Secret,
  PersonalAccessToken,
  SSHKey,
  Webhook
} from '../types';

export const mockRepo: Repository = {
  id: 'repo-1',
  name: 'sourcehub-core',
  owner: 'nicholas',
  description: 'Self-hosted single-operator git forge with async Helper Agents, Actions CI, and encrypted secrets.',
  visibility: 'private',
  defaultBranch: 'master',
  starsCount: 1,
  forksCount: 0,
  branches: ['master', 'feat/ssh-auth', 'agent/run-84f2-auth-scope', 'agent/run-91c0-worktree-refactor'],
  tags: ['v0.1.0-alpha', 'v0.1.0-preview'],
  updatedAt: '12 minutes ago',
};

export const mockFiles: FileItem[] = [
  {
    name: '.sourcehub',
    path: '.sourcehub',
    type: 'dir',
    lastCommitMessage: 'ci: add containerized test runner with secrets masking',
    lastCommitDate: '2 hours ago',
  },
  {
    name: 'cmd',
    path: 'cmd',
    type: 'dir',
    lastCommitMessage: 'feat(cli): add sh CLI entrypoint and token authentication',
    lastCommitDate: 'yesterday',
  },
  {
    name: 'pkg',
    path: 'pkg',
    type: 'dir',
    lastCommitMessage: 'agent: implement Ollama tool-calling execution loop',
    lastCommitDate: '3 hours ago',
  },
  {
    name: 'docs',
    path: 'docs',
    type: 'dir',
    lastCommitMessage: 'docs: finalize SourceHub Product & Architecture Plan v1',
    lastCommitDate: 'today',
  },
  {
    name: 'AGENTS.md',
    path: 'AGENTS.md',
    type: 'file',
    size: '1.4 KB',
    lastCommitMessage: 'chore: define repository rules and formatting specs for Helper',
    lastCommitDate: 'yesterday',
    content: `# Repository Agent Guidelines (SourceHub)

When running tasks on this repository:
1. Always run \`make test\` before marking a run as ready for review.
2. Follow Go standard layout conventions in \`pkg/\` and \`cmd/\`.
3. Never log raw secrets. Redact all authorization headers in stdout.
4. Keep commit messages imperative with conventional commit prefixes.
5. Add trailer \`SourceHub-Agent-Run: <run-id>\` to all agent commits.
`
  },
  {
    name: 'docker-compose.yml',
    path: 'docker-compose.yml',
    type: 'file',
    size: '2.1 KB',
    lastCommitMessage: 'deploy: laptop-first compose setup for forge, db, agent-worker, and runner',
    lastCommitDate: '3 days ago',
    content: `version: '3.8'

services:
  sourcehub-web:
    image: sourcehub/control-plane:v0.1.0
    ports:
      - "3000:3000"
      - "2222:22"
    environment:
      - SOURCEHUB_ROOT=/var/git/repos
      - DATABASE_URL=postgres://sourcehub:secret@db:5432/sourcehub
      - ENCRYPTION_KEY_FILE=/run/secrets/kms_master.key
    volumes:
      - git-data:/var/git/repos
      - app-data:/var/lib/sourcehub

  agent-worker:
    image: sourcehub/agent-worker:v0.1.0
    environment:
      - OLLAMA_HOST=http://host.docker.internal:11434
      - DEFAULT_MODEL=qwen2.5-coder:32b
    volumes:
      - git-data:/var/git/repos:ro
      - /tmp/sourcehub/worktrees:/worktrees

  actions-runner:
    image: sourcehub/actions-runner:v0.1.0
    environment:
      - RUNNER_NAME=local-laptop-01

volumes:
  git-data:
  app-data:
`
  },
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    size: '3.8 KB',
    lastCommitMessage: 'docs: update architecture overview and sh CLI usage',
    lastCommitDate: '2 hours ago',
    content: `# SourceHub 🛸

> **Single-user, self-hosted git forge for solo + AI-assistant workflows.**

SourceHub replaces GitHub for solo operators who build with AI agents. It hosts git repositories with a clean, fast Web UI, Actions-class CI/CD, encrypted secrets, first-class deploy keys and scoped tokens, and an asynchronous **Helper (Agents)** system.

---

### Core Philosophy

* **Single Operator:** Built specifically for Nicholas. No cumbersome enterprise org trees or multi-tenant ACL overhead.
* **Async Agents (Helper):** Coding agents run asynchronously on dedicated branches and open PRs with automated CI checks. No distracting real-time chat widgets in the code editor.
* **No GitHub Lock-in:** Complete local git hosting over SSH and HTTPS, first-party \`sh\` CLI, and VS Code integration.
* **Local First:** Runs cleanly on your laptop via \`docker compose\` with local Ollama or pluggable upstream LLM endpoints.

---

### Getting Started

Clone over SSH or HTTPS:
\`\`\`bash
git clone ssh://git@sourcehub.local:2222/nicholas/sourcehub-core.git
# or with the first-party CLI
sh repo clone nicholas/sourcehub-core
\`\`\`

Kick off an asynchronous AI task:
\`\`\`bash
sh agent run "Implement JWT scope verification for /api/v1/repos and run tests"
\`\`\`
`
  }
];

export const mockCommits: Commit[] = [
  {
    sha: '84f2a9108c1d34f0e2194837a718293bd8e9281a',
    shortSha: '84f2a91',
    message: 'feat(auth): verify fine-grained token scopes on repository endpoints',
    author: 'Nicholas Beighley',
    authorEmail: 'nicholas@sourcehub.local',
    date: '18 minutes ago',
    agentRunId: 'run-84f2',
    trailer: 'SourceHub-Agent-Run: run-84f2-auth-scope',
  },
  {
    sha: 'c120938bfe491823a09823485718290384759182',
    shortSha: 'c120938',
    message: 'ci: configure test runner matrix and add secrets injection step',
    author: 'Nicholas Beighley',
    authorEmail: 'nicholas@sourcehub.local',
    date: '2 hours ago',
  },
  {
    sha: 'f918204918237190283401928340192834019283',
    shortSha: 'f918204',
    message: 'agent: implement Ollama tool-calling execution loop with isolated worktrees',
    author: 'Nicholas Beighley',
    authorEmail: 'nicholas@sourcehub.local',
    date: 'yesterday',
    agentRunId: 'run-44a1',
    trailer: 'SourceHub-Agent-Run: run-44a1-ollama-loop',
  },
];

export const mockPullRequests: PullRequest[] = [
  {
    id: 14,
    title: 'feat(auth): verify fine-grained token scopes on repository endpoints',
    body: `### Summary of Changes (Generated by SourceHub Helper)

This pull request implements fine-grained Personal Access Token (PAT) scope validation across all \`/api/v1/repos/*\` REST endpoints per [§8 of the SourceHub specification](file:///home/mrnicholas/Dev/SourceHub/docs/SOURCEHUB_PLAN.md#8-keys-and-tokens).

- Added \`ScopeMiddleware\` validating \`repo:read\`, \`repo:write\`, and \`admin\` flags.
- Replaced monolithic bearer token parsing with scope-aware context extraction.
- Added comprehensive unit and mock tests in \`pkg/auth/scopes_test.go\`.
- All Actions CI checks passed in containerized runner.

> **SourceHub-Agent-Run:** \`run-84f2-auth-scope\`  
> **Model:** \`ollama/qwen2.5-coder:32b\`  
> **Base Branch:** \`master\` ← **Source Branch:** \`agent/run-84f2-auth-scope\`
`,
    state: 'open',
    author: 'Nicholas Beighley',
    isAgent: true,
    agentRunId: 'run-84f2',
    sourceBranch: 'agent/run-84f2-auth-scope',
    targetBranch: 'master',
    createdAt: '18 minutes ago',
    updatedAt: '12 minutes ago',
    checksStatus: 'passed',
    checksSummary: 'All 3 Actions checks passed (test, lint, build)',
    comments: [
      {
        id: 'c-1',
        author: 'SourceHub Helper',
        isAgent: true,
        createdAt: '18 minutes ago',
        content: '🤖 **SourceHub Helper started on your behalf.**\n\nBranch `agent/run-84f2-auth-scope` was created from `master`. Commits pushed with audit trailer `SourceHub-Agent-Run: run-84f2`. Workflow `.sourcehub/workflows/ci.yml` triggered automatically.',
      },
      {
        id: 'c-2',
        author: 'SourceHub Actions',
        isAgent: true,
        createdAt: '14 minutes ago',
        content: '✅ **Checks completed successfully:**\n- `Unit Tests`: Passed (0.8s)\n- `Lint & Vet`: Passed (1.2s)\n- `Container Build`: Passed (4.5s)\n\nAgent status transitioned to `ready_for_review`.',
      },
      {
        id: 'c-3',
        author: 'Nicholas Beighley',
        isAgent: false,
        createdAt: '5 minutes ago',
        content: 'Looks very clean. The scope isolation matches §8 perfectly.',
      }
    ],
    diffs: [
      {
        filename: 'pkg/auth/scopes.go',
        status: 'added',
        additions: 42,
        deletions: 0,
        lines: [
          { type: 'context', newLineNumber: 1, content: 'package auth' },
          { type: 'context', newLineNumber: 2, content: '' },
          { type: 'add', newLineNumber: 3, content: '// ValidTokenScopes defines the allowed scope permissions.' },
          { type: 'add', newLineNumber: 4, content: 'var ValidTokenScopes = map[string]bool{' },
          { type: 'add', newLineNumber: 5, content: '\t"repo:read":     true,' },
          { type: 'add', newLineNumber: 6, content: '\t"repo:write":    true,' },
          { type: 'add', newLineNumber: 7, content: '\t"pr:write":      true,' },
          { type: 'add', newLineNumber: 8, content: '\t"actions:read":  true,' },
          { type: 'add', newLineNumber: 9, content: '\t"actions:write": true,' },
          { type: 'add', newLineNumber: 10, content: '\t"secrets:write":true,' },
          { type: 'add', newLineNumber: 11, content: '\t"agents:run":   true,' },
          { type: 'add', newLineNumber: 12, content: '\t"admin":        true,' },
          { type: 'add', newLineNumber: 13, content: '}' },
          { type: 'context', newLineNumber: 14, content: '' },
          { type: 'add', newLineNumber: 15, content: 'func RequireScope(required string) gin.HandlerFunc {' },
          { type: 'add', newLineNumber: 16, content: '\treturn func(c *gin.Context) {' },
          { type: 'add', newLineNumber: 17, content: '\t\ttoken := ExtractToken(c)' },
          { type: 'add', newLineNumber: 18, content: '\t\tif !token.HasScope(required) && !token.HasScope("admin") {' },
          { type: 'add', newLineNumber: 19, content: '\t\t\tc.AbortWithStatusJSON(403, gin.H{"error": "insufficient_scope"})' },
          { type: 'add', newLineNumber: 20, content: '\t\t\treturn' },
          { type: 'add', newLineNumber: 21, content: '\t\t}' },
          { type: 'add', newLineNumber: 22, content: '\t\tc.Next()' },
          { type: 'add', newLineNumber: 23, content: '\t}' },
          { type: 'add', newLineNumber: 24, content: '}' },
        ]
      },
      {
        filename: 'pkg/api/routes.go',
        status: 'modified',
        additions: 5,
        deletions: 2,
        lines: [
          { type: 'context', oldLineNumber: 45, newLineNumber: 45, content: '\trepos := v1.Group("/repos")' },
          { type: 'delete', oldLineNumber: 46, content: '-\trepos.Use(auth.RequireLogin())' },
          { type: 'add', newLineNumber: 46, content: '+\trepos.Use(auth.RequireLogin())' },
          { type: 'add', newLineNumber: 47, content: '+\trepos.GET("", auth.RequireScope("repo:read"), ListRepos)' },
          { type: 'add', newLineNumber: 48, content: '+\trepos.POST("", auth.RequireScope("repo:write"), CreateRepo)' },
          { type: 'delete', oldLineNumber: 47, content: '-\trepos.GET("", ListRepos)' },
          { type: 'context', oldLineNumber: 48, newLineNumber: 49, content: '\trepos.GET("/:repo/branches", ListBranches)' },
        ]
      }
    ]
  },
  {
    id: 12,
    title: 'feat(secrets): add write-only encrypted KMS envelope storage',
    body: 'Implements AES-256-GCM envelope encryption for repo & actions secrets with in-memory scrubbing.',
    state: 'merged',
    author: 'Nicholas Beighley',
    isAgent: false,
    sourceBranch: 'feat/kms-secrets',
    targetBranch: 'master',
    createdAt: '3 days ago',
    updatedAt: '2 days ago',
    checksStatus: 'passed',
    checksSummary: 'All checks passed',
    comments: [],
    diffs: []
  }
];

export const mockWorkflowRuns: WorkflowRun[] = [
  {
    id: 'run-301',
    workflowName: 'CI Pipeline (.sourcehub/workflows/ci.yml)',
    event: 'pull_request',
    status: 'success',
    branch: 'agent/run-84f2-auth-scope',
    commitSha: '84f2a91',
    commitMessage: 'feat(auth): verify fine-grained token scopes on repository endpoints',
    author: 'Nicholas Beighley (via Helper)',
    duration: '24s',
    createdAt: '18 minutes ago',
    steps: [
      {
        name: 'Set up Go 1.23 environment',
        status: 'success',
        duration: '2s',
        logs: ['Setting up Go v1.23.1 linux/amd64...', 'Go environment ready at /usr/local/go']
      },
      {
        name: 'Inject repository encrypted secrets',
        status: 'success',
        duration: '1s',
        logs: [
          'Resolving required secrets from KMS...',
          'Injected ${{ secrets.ACTIONS_DEPLOY_KEY }} (masked: ***)',
          'Secrets safely mounted into container memory'
        ]
      },
      {
        name: 'Run unit & integration tests',
        status: 'success',
        duration: '12s',
        logs: [
          '=== RUN   TestScopeValidation',
          '=== RUN   TestTokenExtraction',
          '=== RUN   TestAdminBypass',
          '--- PASS: TestScopeValidation (0.02s)',
          '--- PASS: TestTokenExtraction (0.01s)',
          '--- PASS: TestAdminBypass (0.01s)',
          'PASS: 38/38 packages tested with 0 failures.'
        ]
      },
      {
        name: 'Verify static analysis & linter',
        status: 'success',
        duration: '5s',
        logs: [
          'golangci-lint run --timeout 2m',
          'No vulnerabilities or static issues detected.'
        ]
      },
      {
        name: 'Build lightweight container image',
        status: 'success',
        duration: '4s',
        logs: [
          'Building container image sourcehub-test:84f2a91...',
          'Successfully built image sha256:4f8281a9',
          'Status: OK'
        ]
      }
    ]
  },
  {
    id: 'run-300',
    workflowName: 'CI Pipeline (.sourcehub/workflows/ci.yml)',
    event: 'push',
    status: 'success',
    branch: 'master',
    commitSha: 'c120938',
    commitMessage: 'ci: configure test runner matrix and add secrets injection step',
    author: 'Nicholas Beighley',
    duration: '28s',
    createdAt: '2 hours ago',
    steps: [
      {
        name: 'Checkout code & Run tests',
        status: 'success',
        duration: '28s',
        logs: ['Tests passed. 0 errors.']
      }
    ]
  }
];

export const mockAgentRuns: AgentRun[] = [
  {
    id: 'run-84f2',
    slug: 'run-84f2-auth-scope',
    prompt: 'Implement token scope verification middleware for /api/v1/repos endpoints according to section 8 of the spec, and add unit tests.',
    baseBranch: 'master',
    targetBranch: 'agent/run-84f2-auth-scope',
    mode: 'open_pr',
    state: 'ready_for_review',
    provider: 'ollama',
    model: 'qwen2.5-coder:32b',
    createdAt: '22 minutes ago',
    completedAt: '12 minutes ago',
    operator: 'Nicholas Beighley',
    prId: 14,
    filesTouched: ['pkg/auth/scopes.go', 'pkg/api/routes.go', 'pkg/auth/scopes_test.go'],
    timeline: [
      {
        id: 'ev-1',
        type: 'agent.started',
        title: 'SourceHub Helper started on your behalf',
        description: 'Initialized worktree sandbox from master. Loaded AGENTS.md rules.',
        timestamp: '22m ago',
      },
      {
        id: 'ev-2',
        type: 'agent.branch_created',
        title: 'Created working branch',
        description: 'Branch `agent/run-84f2-auth-scope` established.',
        timestamp: '21m ago',
        metadata: { branch: 'agent/run-84f2-auth-scope' }
      },
      {
        id: 'ev-3',
        type: 'agent.commits_pushed',
        title: 'Pushed agent commit to remote',
        description: 'Commit 84f2a91 pushed with trailer `SourceHub-Agent-Run: run-84f2`.',
        timestamp: '18m ago',
        metadata: { commitSha: '84f2a91' }
      },
      {
        id: 'ev-4',
        type: 'agent.pr_opened',
        title: 'Opened Pull Request #14',
        description: 'Generated PR with summary, rationale, and diff preview.',
        timestamp: '18m ago',
        metadata: { prId: 14 }
      },
      {
        id: 'ev-5',
        type: 'agent.checks_requested',
        title: 'Triggered Actions CI checks',
        description: 'Workflow `.sourcehub/workflows/ci.yml` queued on runner.',
        timestamp: '17m ago',
        metadata: { checkId: 'run-301' }
      },
      {
        id: 'ev-6',
        type: 'agent.checks_completed',
        title: 'All Actions checks passed',
        description: '3/3 jobs green (tests, lint, container build).',
        timestamp: '14m ago',
        metadata: { checkId: 'run-301' }
      },
      {
        id: 'ev-7',
        type: 'agent.ready_for_review',
        title: 'Ready for operator review',
        description: 'Stopped at review gate. Waiting for Nicholas to approve and merge.',
        timestamp: '12m ago',
      }
    ],
    logs: [
      '[15:02:10] Worker: Initializing container workspace for run-84f2',
      '[15:02:11] Worker: Cloning bare repository to ephemeral worktree: /tmp/worktrees/run-84f2',
      '[15:02:12] Worker: Reading AGENTS.md instructions... Loaded 5 rules.',
      '[15:02:14] Model (qwen2.5-coder:32b): Planning implementation: scope middleware, routes update, test file.',
      '[15:02:16] Tool Call: read_file("pkg/api/routes.go")',
      '[15:02:17] Tool Response: 64 lines read.',
      '[15:02:20] Tool Call: write_file("pkg/auth/scopes.go", 42 lines)',
      '[15:02:22] Tool Call: write_file("pkg/auth/scopes_test.go", 85 lines)',
      '[15:02:25] Tool Call: edit_file("pkg/api/routes.go", diff applied)',
      '[15:02:28] Tool Call: exec_cmd("go test ./pkg/auth/...")',
      '[15:02:30] Exec Output: PASS: TestScopeValidation (0.02s)',
      '[15:02:32] Git: Creating commit "feat(auth): verify fine-grained token scopes on repository endpoints"',
      '[15:02:33] Git: Adding audit trailer "SourceHub-Agent-Run: run-84f2-auth-scope"',
      '[15:02:35] Git: Push branch agent/run-84f2-auth-scope -> origin',
      '[15:02:36] API: POST /api/v1/repos/nicholas/sourcehub-core/pulls -> PR #14 created',
      '[15:02:37] Actions: Event pull_request triggered workflow run-301',
      '[15:03:01] Actions: CI workflow run-301 completed with status: SUCCESS',
      '[15:03:02] Agent: Transitioning state to READY_FOR_REVIEW. Operator notified.'
    ]
  },
  {
    id: 'run-91c0',
    slug: 'run-91c0-worktree-refactor',
    prompt: 'Refactor bare repository clone handler to use ephemeral git worktrees for faster isolation.',
    baseBranch: 'master',
    targetBranch: 'agent/run-91c0-worktree-refactor',
    mode: 'branch_only',
    state: 'in_progress',
    provider: 'ollama',
    model: 'qwen2.5-coder:32b',
    createdAt: '4 minutes ago',
    operator: 'Nicholas Beighley',
    filesTouched: ['pkg/git/worktree.go'],
    timeline: [
      {
        id: 'ev-20',
        type: 'agent.started',
        title: 'SourceHub Helper started on your behalf',
        description: 'Mounting git storage volume...',
        timestamp: '4m ago',
      },
      {
        id: 'ev-21',
        type: 'agent.branch_created',
        title: 'Created branch agent/run-91c0-worktree-refactor',
        description: 'Base: master',
        timestamp: '3m ago',
        metadata: { branch: 'agent/run-91c0-worktree-refactor' }
      }
    ],
    logs: [
      '[15:20:00] Worker: Initialized worktree container',
      '[15:20:02] Model: Evaluating git worktree add command flags and lock files...',
      '[15:20:05] Tool Call: read_file("pkg/git/repo.go")',
      '[15:20:08] In progress: generating patch for pkg/git/worktree.go...'
    ]
  },
  {
    id: 'run-44a1',
    slug: 'run-44a1-webhook-hmac',
    prompt: 'Add HMAC-SHA256 signature verification headers to outbound webhook deliveries.',
    baseBranch: 'master',
    targetBranch: 'agent/run-44a1-webhook-hmac',
    mode: 'open_pr',
    state: 'ready_for_review',
    provider: 'ollama',
    model: 'qwen2.5-coder:32b',
    createdAt: 'yesterday',
    completedAt: 'yesterday',
    operator: 'Nicholas Beighley',
    prId: 11,
    filesTouched: ['pkg/webhooks/signer.go', 'pkg/webhooks/signer_test.go'],
    timeline: [
      {
        id: 'ev-30',
        type: 'agent.started',
        title: 'SourceHub Helper started on your behalf',
        description: 'Task initialized',
        timestamp: 'yesterday'
      },
      {
        id: 'ev-31',
        type: 'agent.ready_for_review',
        title: 'PR #11 opened and ready for review',
        description: 'All webhook HMAC tests passing',
        timestamp: 'yesterday'
      }
    ],
    logs: [
      'Worker completed task in 42s. All tests green.'
    ]
  }
];

export const mockSecrets: Secret[] = [
  {
    id: 'sec-1',
    name: 'ACTIONS_DEPLOY_KEY',
    scope: 'actions',
    maskedValue: '••••••••••••••••••••••••••••••••••••••••',
    updatedAt: '3 days ago',
    lastUsed: '18 minutes ago',
  },
  {
    id: 'sec-2',
    name: 'OLLAMA_HOST_BASE',
    scope: 'agent',
    maskedValue: '••••••••••••••••••••••••••••••••••••••••',
    updatedAt: 'yesterday',
    lastUsed: '4 minutes ago',
  },
  {
    id: 'sec-3',
    name: 'SLACK_WEBHOOK_URL',
    scope: 'webhook',
    maskedValue: '••••••••••••••••••••••••••••••••••••••••',
    updatedAt: '1 week ago',
    lastUsed: 'Yesterday',
  },
  {
    id: 'sec-4',
    name: 'POSTGRES_PASSWORD',
    scope: 'actions',
    maskedValue: '••••••••••••••••••••••••••••••••••••••••',
    updatedAt: '5 days ago',
    lastUsed: '2 hours ago',
  }
];

export const mockSSHKeys: SSHKey[] = [
  {
    id: 'key-1',
    title: "Nicholas's Primary ThinkPad (SSH Ed25519)",
    fingerprint: 'SHA256:mQ8Z+eEaN1Q9tBvL3x6o7K4R2jF0gW8pD5sX9yZ1A3c',
    keyType: 'ssh-ed25519',
    type: 'user',
    createdAt: '2 weeks ago',
  },
  {
    id: 'key-2',
    title: 'agent-worker-ephemeral-daemon',
    fingerprint: 'SHA256:kL8p9X2mQ7vB4wZ1A6o3R5tY9eE2jF8sD0gW4uX7yZ2',
    keyType: 'ssh-ed25519',
    type: 'deploy',
    isReadOnly: false,
    createdAt: '3 days ago',
  }
];

export const mockTokens: PersonalAccessToken[] = [
  {
    id: 'tok-1',
    name: 'sh-cli-terminal (Nicholas Laptop)',
    tokenPrefix: 'sh_pat_89f2...',
    scopes: ['repo:read', 'repo:write', 'pr:write', 'actions:read', 'agents:run'],
    createdAt: '5 days ago',
    expiresAt: 'In 90 days',
    lastUsed: 'Just now'
  },
  {
    id: 'tok-2',
    name: 'vscode-sourcehub-extension',
    tokenPrefix: 'sh_pat_33a1...',
    scopes: ['repo:read', 'repo:write', 'pr:write', 'agents:run'],
    createdAt: '1 week ago',
    expiresAt: 'In 365 days',
    lastUsed: '10 minutes ago'
  },
  {
    id: 'tok-3',
    name: 'mcp-ai-teammate-connector',
    tokenPrefix: 'sh_pat_90e4...',
    scopes: ['repo:read', 'pr:write', 'agents:run', 'actions:read'],
    createdAt: '2 days ago',
    expiresAt: 'In 60 days',
    lastUsed: '18 minutes ago'
  }
];

export const mockWebhooks: Webhook[] = [
  {
    id: 'wh-1',
    url: 'http://localhost:9000/hooks/sourcehub-agent-events',
    secretMasked: '••••••••••••••••••••',
    events: ['agent_run', 'pull_request', 'workflow_run'],
    active: true,
    deliveries: [
      {
        id: 'del-101',
        event: 'agent_run.ready_for_review',
        status: 'success',
        statusCode: 200,
        duration: '14ms',
        deliveredAt: '12 minutes ago',
        requestPayload: JSON.stringify({
          event: 'agent_run.ready_for_review',
          run_id: 'run-84f2',
          pr_id: 14,
          operator: 'nicholas',
          model: 'qwen2.5-coder:32b'
        }, null, 2),
        responsePayload: '{"status":"ok","notified":true}'
      },
      {
        id: 'del-100',
        event: 'pull_request.opened',
        status: 'success',
        statusCode: 200,
        duration: '18ms',
        deliveredAt: '18 minutes ago',
        requestPayload: JSON.stringify({
          event: 'pull_request.opened',
          number: 14,
          title: 'feat(auth): verify fine-grained token scopes'
        }, null, 2),
        responsePayload: '{"status":"ok"}'
      }
    ]
  }
];
