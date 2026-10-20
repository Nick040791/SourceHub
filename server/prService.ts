/**
 * Shared pull request helpers.
 *
 * Both the API and the Helper agent create pull requests. They must produce
 * identical rows — in particular the diff snapshot, which keeps a pull
 * request readable after its source branch is deleted.
 */
import { db, nextPullRequestNumber } from './db';
import type { GitService } from './gitService';

export interface PullRequestSnapshot {
  baseSha: string;
  headSha: string;
  mergeBase: string;
  diffSnapshot: string;
  commitsSnapshot: string;
  additions: number;
  deletions: number;
}

/** Capture the current diff and commits between two branches. */
export async function capturePullRequestSnapshot(
  gitService: GitService,
  repoName: string,
  sourceBranch: string,
  targetBranch: string
): Promise<PullRequestSnapshot> {
  const empty: PullRequestSnapshot = {
    baseSha: '',
    headSha: '',
    mergeBase: '',
    diffSnapshot: '',
    commitsSnapshot: '',
    additions: 0,
    deletions: 0,
  };

  try {
    const [commits, diffs] = await Promise.all([
      gitService.getCommitsBetween(repoName, targetBranch, sourceBranch),
      gitService.getBranchDiff(repoName, targetBranch, sourceBranch),
    ]);

    let additions = 0;
    let deletions = 0;
    for (const d of diffs) {
      additions += d.additions;
      deletions += d.deletions;
    }

    return {
      baseSha: commits.length > 0 ? commits[0].sha : '',
      headSha: commits.length > 0 ? commits[0].sha : '',
      mergeBase: '',
      diffSnapshot: JSON.stringify(diffs),
      commitsSnapshot: JSON.stringify(commits),
      additions,
      deletions,
    };
  } catch {
    return empty;
  }
}

export interface InsertPullRequestParams {
  repoName: string;
  title: string;
  body: string;
  author: string;
  isAgent: boolean;
  agentRunId?: string | null;
  sourceBranch: string;
  targetBranch: string;
  snapshot?: Partial<PullRequestSnapshot>;
}

/**
 * Insert a pull request row and return its id and repo-scoped number.
 * `checks_status` starts as `pending` — a pull request must never look green
 * before its checks have actually run.
 */
export function insertPullRequest(params: InsertPullRequestParams): {
  id: number;
  number: number;
} {
  const number = nextPullRequestNumber(params.repoName);
  const now = Date.now();
  const snapshot = params.snapshot || {};

  const res = db.prepare(`
    INSERT INTO pull_requests (
      repo_name, number, title, body, state, author, is_agent, agent_run_id,
      source_branch, target_branch, created_at, updated_at, created_ms, updated_ms,
      checks_status, checks_summary, base_sha, head_sha, merge_base,
      diff_snapshot, commits_snapshot, additions, deletions
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.repoName,
    number,
    params.title,
    params.body,
    'open',
    params.author,
    params.isAgent ? 1 : 0,
    params.agentRunId || null,
    params.sourceBranch,
    params.targetBranch,
    'Just now',
    'Just now',
    now,
    now,
    'pending',
    'Checks have not run yet',
    snapshot.baseSha || '',
    snapshot.headSha || '',
    snapshot.mergeBase || '',
    snapshot.diffSnapshot || '',
    snapshot.commitsSnapshot || '',
    snapshot.additions || 0,
    snapshot.deletions || 0
  );

  return { id: Number(res.lastInsertRowid), number };
}
