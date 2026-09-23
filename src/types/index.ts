export type TabType = 'code' | 'desktop' | 'issues' | 'pulls' | 'actions' | 'agents' | 'settings';

export interface WorkingFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  oldPath?: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitStashEntry {
  index: number;
  message: string;
  date: string;
}

export interface WorkingCopyStatus {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  isClean: boolean;
  files: WorkingFile[];
  remotes: GitRemote[];
  lastFetched: string | null;
  stashes: GitStashEntry[];
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: 'private' | 'public';
  defaultBranch: string;
  currentBranch?: string;
  starsCount: number;
  forksCount: number;
  branches: string[];
  tags: string[];
  updatedAt: string;
  lastCommit?: Commit;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: string;
  lastCommitMessage: string;
  lastCommitDate: string;
  content?: string;
}

export interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  agentRunId?: string;
  trailer?: string;
}

export type PRState = 'open' | 'draft' | 'merged' | 'closed';

export interface PRReviewComment {
  id: string;
  author: string;
  avatar?: string;
  isAgent?: boolean;
  content: string;
  createdAt: string;
  file?: string;
  line?: number;
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  patch: string;
}

export interface DiffFile {
  filename: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  lines: DiffLine[];
  hunks?: DiffHunk[];
}

export interface PullRequest {
  id: number;
  title: string;
  body: string;
  state: PRState;
  author: string;
  isAgent: boolean;
  agentRunId?: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  checksStatus: 'passed' | 'running' | 'failed' | 'pending';
  checksSummary: string;
  workflowRunId?: string;
  comments: PRReviewComment[];
  diffs: DiffFile[];
}

export interface PRMergeability {
  canMerge: boolean;
  conflictedFiles: string[];
}

export type WorkflowStatus = 'success' | 'running' | 'failed' | 'queued' | 'cancelled';

export interface JobStep {
  name: string;
  status: 'success' | 'running' | 'failed' | 'queued';
  duration: string;
  logs: string[];
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  event: 'push' | 'pull_request' | 'workflow_dispatch' | 'agent_run';
  status: WorkflowStatus;
  branch: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  duration: string;
  createdAt: string;
  steps: JobStep[];
}

export type AgentRunState =
  | 'queued'
  | 'preparing_workspace'
  | 'in_progress'
  | 'pushing'
  | 'checks_pending'
  | 'checks_passed'
  | 'checks_failed'
  | 'ready_for_review'
  | 'failed'
  | 'cancelled';

export type AgentTimelineEventType =
  | 'agent.started'
  | 'agent.branch_created'
  | 'agent.commits_pushed'
  | 'agent.pr_opened'
  | 'agent.pr_updated'
  | 'agent.checks_requested'
  | 'agent.checks_completed'
  | 'agent.comment_added'
  | 'agent.ready_for_review'
  | 'agent.failed';

export interface AgentTimelineEvent {
  id: string;
  type: AgentTimelineEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    branch?: string;
    commitSha?: string;
    prId?: number;
    checkId?: string;
    details?: string;
  };
}

export interface AgentRun {
  id: string;
  slug: string;
  prompt: string;
  baseBranch: string;
  targetBranch: string;
  mode: 'branch_only' | 'open_pr';
  state: AgentRunState;
  provider: 'ollama' | 'openai_compat' | 'anthropic_compat' | 'azure_foundry';
  model: string;
  createdAt: string;
  completedAt?: string;
  operator: string;
  prId?: number;
  timeline: AgentTimelineEvent[];
  logs: string[];
  filesTouched: string[];
}

export interface Secret {
  id: string;
  name: string;
  scope: 'actions' | 'agent' | 'webhook';
  maskedValue: string;
  updatedAt: string;
  lastUsed?: string;
}

export type TokenScope =
  | 'repo:read'
  | 'repo:write'
  | 'pr:write'
  | 'actions:read'
  | 'actions:write'
  | 'secrets:write'
  | 'agents:run'
  | 'admin';

export interface PersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: TokenScope[];
  createdAt: string;
  expiresAt: string;
  lastUsed?: string;
}

export interface SSHKey {
  id: string;
  title: string;
  fingerprint: string;
  keyType: 'ssh-ed25519' | 'ssh-rsa';
  type: 'user' | 'deploy';
  isReadOnly?: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: 'success' | 'failed';
  statusCode: number;
  duration: string;
  deliveredAt: string;
  requestPayload: string;
  responsePayload: string;
}

export interface Webhook {
  id: string;
  url: string;
  secretMasked: string;
  events: string[];
  active: boolean;
  deliveries: WebhookDelivery[];
}
