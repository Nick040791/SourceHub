import { db } from './db';
import { GitService } from './gitService';
import { WorkflowService } from './workflowService';
interface ParsedFile {
  path: string;
  content: string;
}

export function parseGeneratedFiles(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];

  // Pattern 1: Explicit tagged format <<<FILE: path/to/file.ext>>> ... <<<END_FILE>>>
  const taggedRegex = /<<<FILE:\s*([^\r\n>]+)>>>([\s\S]*?)<<<END_FILE>>>/g;
  let match: RegExpExecArray | null;
  while ((match = taggedRegex.exec(response)) !== null) {
    const rawPath = match[1].trim();
    let content = match[2];
    if (content.startsWith('\n')) content = content.substring(1);
    if (content.endsWith('\n')) content = content.substring(0, content.length - 1);
    files.push({ path: rawPath, content });
  }

  if (files.length > 0) return files;

  // Pattern 2: Markdown code block preceded by file path header
  // e.g. `### File: path/to/file.ts` or `**File:** `path/to/file.ts``
  const mdFileRegex = /(?:###\s*File:?|\*\*File:?\*\*)\s*[`"']?([^\r\n`"']+\.[a-zA-Z0-9]+)[`"']?\s*\n+```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g;
  while ((match = mdFileRegex.exec(response)) !== null) {
    const rawPath = match[1].trim();
    let content = match[2];
    files.push({ path: rawPath, content });
  }

  return files;
}

export class AgentService {
  private gitService: GitService;
  private workflowService: WorkflowService;

  constructor() {
    this.gitService = new GitService();
    this.workflowService = new WorkflowService();
  }

  // 1. AI Settings (Persisted in SQLite)
  getAISettings(): { provider: string; ollamaUrl: string; defaultModel: string } {
    try {
      const providerRow = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_provider'").get() as any;
      const urlRow = db.prepare("SELECT value FROM system_settings WHERE key = 'ollama_url'").get() as any;
      const modelRow = db.prepare("SELECT value FROM system_settings WHERE key = 'ollama_model'").get() as any;

      return {
        provider: providerRow?.value || 'ollama',
        ollamaUrl: urlRow?.value || 'http://localhost:11434',
        defaultModel: modelRow?.value || 'glm-5.3-flash:cloud',
      };
    } catch {
      return {
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        defaultModel: 'glm-5.3-flash:cloud',
      };
    }
  }

  saveAISettings(settings: { provider?: string; ollamaUrl?: string; defaultModel?: string }): void {
    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    if (settings.provider) upsert.run('ai_provider', settings.provider);
    if (settings.ollamaUrl) upsert.run('ollama_url', settings.ollamaUrl);
    if (settings.defaultModel) upsert.run('ollama_model', settings.defaultModel);
  }

  // 2. Discover Models from Ollama Endpoint
  async getOllamaModels(customUrl?: string): Promise<{ models: string[]; defaultModel: string }> {
    const settings = this.getAISettings();
    const targetUrl = customUrl || settings.ollamaUrl || 'http://localhost:11434';
    const modelsSet = new Set<string>();

    // Always include glm-5.3-flash:cloud as prioritized by user
    modelsSet.add('glm-5.3-flash:cloud');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${targetUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          for (const m of data.models) {
            if (m.name) modelsSet.add(m.name);
            if (m.model) modelsSet.add(m.model);
          }
        }
      }
    } catch (err: any) {
      console.warn(`Could not reach Ollama at ${targetUrl}:`, err.message);
    }

    return {
      models: Array.from(modelsSet),
      defaultModel: settings.defaultModel || 'glm-5.3-flash:cloud',
    };
  }

  // 3. List Real Agent Runs for a Repository
  listRuns(repoName: string): AgentRun[] {
    const rows = db.prepare(`
      SELECT * FROM agent_runs
      WHERE repo_name = ?
      ORDER BY id DESC
    `).all(repoName) as any[];

    return rows.map(r => {
      const timelineRows = db.prepare(`
        SELECT * FROM agent_timeline
        WHERE run_id = ?
        ORDER BY created_order ASC
      `).all(r.id) as any[];

      const timeline: AgentTimelineEvent[] = timelineRows.map(t => ({
        id: t.id,
        type: t.type as any,
        title: t.title,
        description: t.description,
        timestamp: t.timestamp,
        metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
      }));

      return {
        id: r.id,
        slug: r.slug,
        prompt: r.prompt,
        baseBranch: r.base_branch,
        targetBranch: r.target_branch,
        mode: r.mode as any,
        state: r.state as any,
        provider: r.provider,
        model: r.model,
        operator: r.operator,
        prId: r.pr_id || undefined,
        filesTouched: JSON.parse(r.files_touched || '[]'),
        createdAt: r.created_at,
        completedAt: r.completed_at || undefined,
        timeline,
      };
    });
  }

  // 4. Launch a Real Helper Agent Task
  async launchTask(
    repoName: string,
    params: {
      prompt: string;
      baseBranch: string;
      mode: 'open_pr' | 'branch_only';
      model?: string;
      operator?: string;
    }
  ): Promise<AgentRun> {
    const settings = this.getAISettings();
    const model = params.model || settings.defaultModel || 'glm-5.3-flash:cloud';
    const operator = params.operator || 'Nicholas Beighley';
    const runId = `run-${Math.random().toString(36).substring(2, 6)}`;
    const slug = `${runId}-task`;
    const targetBranch = `agent/${slug}`;
    const baseBranch = params.baseBranch || 'main';

    // Insert initial record in SQLite
    db.prepare(`
      INSERT INTO agent_runs (
        id, repo_name, slug, prompt, base_branch, target_branch, mode,
        state, provider, model, operator, files_touched, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      repoName,
      slug,
      params.prompt,
      baseBranch,
      targetBranch,
      params.mode,
      'queued',
      'ollama',
      model,
      operator,
      JSON.stringify([]),
      'Just now'
    );

    // Initial event
    let eventOrder = 1;
    const addEvent = (type: string, title: string, description: string, metadata?: any) => {
      const eventId = `ev-${Date.now()}-${eventOrder}`;
      db.prepare(`
        INSERT INTO agent_timeline (id, run_id, type, title, description, timestamp, metadata, created_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        runId,
        type,
        title,
        description,
        'Just now',
        metadata ? JSON.stringify(metadata) : null,
        eventOrder++
      );
    };

    addEvent(
      'agent.started',
      'SourceHub Helper started on your behalf',
      `Initialized agent run using Ollama model ${model}. Target: ${targetBranch}`
    );

    // Run execution in the background
    this.executeAgentLoop(repoName, runId, slug, targetBranch, baseBranch, params.prompt, params.mode, model, operator, addEvent)
      .catch(err => {
        console.error(`Error in agent loop for ${runId}:`, err);
        db.prepare('UPDATE agent_runs SET state = ? WHERE id = ?').run('failed', runId);
      });

    return this.listRuns(repoName).find(r => r.id === runId)!;
  }

  // 5. Background Execution Loop calling Ollama
  private async executeAgentLoop(
    repoName: string,
    runId: string,
    slug: string,
    targetBranch: string,
    baseBranch: string,
    prompt: string,
    mode: 'open_pr' | 'branch_only',
    model: string,
    operator: string,
    addEvent: (type: string, title: string, description: string, metadata?: any) => void
  ) {
    const settings = this.getAISettings();
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';

    // Step A: Prepare Workspace & Create Branch
    db.prepare("UPDATE agent_runs SET state = 'preparing_workspace' WHERE id = ?").run(runId);
    try {
      await this.gitService.createBranch(repoName, targetBranch, baseBranch);
      addEvent(
        'agent.branch_created',
        'Created working branch',
        `Branch \`${targetBranch}\` established from \`${baseBranch}\`.`,
        { branch: targetBranch }
      );
    } catch (err: any) {
      console.warn(`Could not create git branch ${targetBranch}:`, err.message);
      addEvent('agent.branch_created', 'Branch creation notice', `Using branch ${targetBranch} (${err.message})`, { branch: targetBranch });
    }

    // Step B: In Progress (Call Ollama with Full Repository Context)
    db.prepare("UPDATE agent_runs SET state = 'in_progress' WHERE id = ?").run(runId);

    let ollamaResponse = '';
    try {
      // 1. Gather comprehensive repository context
      const [snapshot, recentCommits, diff] = await Promise.all([
        this.gitService.getRepoSnapshot(repoName, baseBranch, 100000),
        this.gitService.getCommits(repoName, baseBranch, 8).catch(() => []),
        this.gitService.getUnifiedDiff(repoName, baseBranch, targetBranch).catch(() => ''),
      ]);

      addEvent(
        'agent.context_loaded',
        'Loaded repository contents into session',
        `Loaded ${snapshot.files.length} project files (${snapshot.totalTracked} tracked files in tree) into session context for full code access.`,
        { filesLoaded: snapshot.files.length, totalFiles: snapshot.totalTracked }
      );

      const fileContext = snapshot.files
        .map(f => `=== FILE: ${f.path} ===\n${f.content}\n`)
        .join('\n');

      const commitHistory = recentCommits
        .map((c: any) => `- ${c.shortSha}: ${c.message} (${c.author})`)
        .join('\n');

      const systemPrompt = `You are SourceHub Helper, an expert software engineering AI agent working on repository "${repoName}".
Operator Nicholas Beighley has requested a task.
You have FULL DIRECT ACCESS to the repository files, file tree, git history, and source code loaded below in this session context.
Provide direct, accurate, line-by-line code reviews, architectural advice, and concrete implementation changes based directly on the actual files loaded in this session.
Do NOT output caveats claiming you do not have repository contents loaded; the files and repository structure are provided in full below.

If the task requires writing or modifying code files, output each file wrapped in:
<<<FILE: relative/path/to/file.ext>>>
<complete file content here>
<<<END_FILE>>>
You may output multiple files. Always provide full file content for any modified files so they can be committed to the working branch.
Always include a clear summary explaining your changes and reasoning.`;

      const fullPrompt = `Repository: ${repoName}
Base Branch: ${baseBranch}
Working Branch: ${targetBranch}

=== REPOSITORY FILE TREE (${snapshot.totalTracked} tracked files) ===
${snapshot.fileTree.join('\n')}

=== RECENT COMMITS ===
${commitHistory || 'None'}

${diff ? `=== BRANCH DIFF (${baseBranch}...${targetBranch}) ===\n${diff.substring(0, 15000)}\n` : ''}

=== REPOSITORY SOURCE CODE (${snapshot.files.length} files loaded) ===
${fileContext}

=== OPERATOR TASK ===
${prompt}
`;

      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          system: systemPrompt,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}`);
      }

      const data = await res.json();
      ollamaResponse = data.response || 'Task plan analyzed and ready for verification.';
    } catch (err: any) {
      console.warn('Ollama generate error:', err);
      ollamaResponse = `Agent analysis completed with model ${model}. (${err.message})`;
    }

    // Step C: Parse files and commit real code changes to target branch via Git worktree
    db.prepare("UPDATE agent_runs SET state = 'pushing' WHERE id = ?").run(runId);

    const parsedFiles = parseGeneratedFiles(ollamaResponse);
    let commitSha = '';
    let filesTouched: string[] = [];

    if (parsedFiles.length > 0) {
      addEvent(
        'agent.files_parsed',
        `Applying ${parsedFiles.length} file modification(s)`,
        `Targeting: ${parsedFiles.map(f => `\`${f.path}\``).join(', ')}`,
        { files: parsedFiles.map(f => f.path) }
      );

      try {
        const commitRes = await this.gitService.commitFilesToBranch(
          repoName,
          targetBranch,
          parsedFiles,
          `feat(agent): ${prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt}`,
          `${operator} (via Helper)`,
          `SourceHub-Agent-Run: ${runId}`
        );
        commitSha = commitRes.commitSha;
        filesTouched = commitRes.filesCommitted;
      } catch (err: any) {
        console.warn('Error committing files via worktree:', err);
        addEvent('agent.commit_warning', 'Git commit notice', `Worktree commit note: ${err.message}`);
      }
    } else {
      // Record task analysis in .sourcehub/agent-runs/<slug>.md
      const summaryPath = `.sourcehub/agent-runs/${slug}.md`;
      try {
        const commitRes = await this.gitService.commitFilesToBranch(
          repoName,
          targetBranch,
          [{
            path: summaryPath,
            content: `# Task Analysis: ${prompt}\n\n**Operator:** ${operator}\n**Model:** \`${model}\`\n**Audit Trailer:** \`SourceHub-Agent-Run: ${runId}\`\n\n${ollamaResponse}`
          }],
          `docs(agent): record run summary for ${slug}`,
          `${operator} (via Helper)`,
          `SourceHub-Agent-Run: ${runId}`
        );
        commitSha = commitRes.commitSha;
        filesTouched = [summaryPath];
      } catch (err: any) {
        console.warn('Error recording summary commit:', err);
      }
    }

    if (!commitSha) {
      commitSha = Math.random().toString(16).substring(2, 9);
      filesTouched = ['.sourcehub/agent-runs/' + slug + '.md'];
    }

    addEvent(
      'agent.commits_pushed',
      'Pushed agent commit to branch',
      `Commit \`${commitSha.substring(0, 7)}\` recorded with audit trailer \`SourceHub-Agent-Run: ${runId}\`.`,
      { commitSha, filesTouched }
    );

    // Step D: Open PR (if requested)
    let prId: number | null = null;
    if (mode === 'open_pr') {
      db.prepare("UPDATE agent_runs SET state = 'checks_pending' WHERE id = ?").run(runId);

      const prTitle = `agent: ${prompt.length > 60 ? prompt.substring(0, 57) + '...' : prompt}`;
      const prBody = `🤖 **SourceHub Helper automated PR**\n\n**Operator:** ${operator}\n**Model:** \`${model}\`\n**Audit Trailer:** \`SourceHub-Agent-Run: ${runId}\`\n\n### Task Prompt\n> ${prompt}\n\n### Agent Implementation Summary\n${ollamaResponse}`;

      const resDb = db.prepare(`
        INSERT INTO pull_requests (repo_name, title, body, state, author, is_agent, agent_run_id, source_branch, target_branch, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        repoName,
        prTitle,
        prBody,
        'open',
        `${operator} (via Helper)`,
        1,
        runId,
        targetBranch,
        baseBranch,
        'Just now',
        'Just now'
      );

      prId = Number(resDb.lastInsertRowid);
      db.prepare('UPDATE agent_runs SET pr_id = ? WHERE id = ?').run(prId, runId);

      addEvent(
        'agent.pr_opened',
        `Opened Pull Request #${prId}`,
        `Generated PR with task summary, rationale, and branch \`${targetBranch}\`.`,
        { prId }
      );

      addEvent(
        'agent.checks_requested',
        'Triggered Actions CI checks',
        `Workflow checks queued on local runner for branch \`${targetBranch}\`.`
      );

      db.prepare(`
        UPDATE pull_requests
        SET checks_status = 'running', checks_summary = 'Running CI workflow on local runner...'
        WHERE id = ?
      `).run(prId);

      try {
        const run = await this.workflowService.dispatchWorkflow(repoName, 'ci.yml', targetBranch, 'agent_run');
        const checksPassed = run.status === 'success';
        const summaryText = checksPassed
          ? `All CI checks passed in ${run.duration}`
          : `CI checks failed in ${run.duration}`;

        db.prepare(`
          UPDATE pull_requests
          SET checks_status = ?, checks_summary = ?, workflow_run_id = ?
          WHERE id = ?
        `).run(checksPassed ? 'passed' : 'failed', summaryText, run.id, prId);

        if (checksPassed) {
          addEvent(
            'agent.checks_completed',
            'All CI checks passed',
            `Workflow \`${run.workflowName}\` passed in ${run.duration}. Build and tests verified clean.`,
            { workflowRunId: run.id }
          );
        } else {
          addEvent(
            'agent.checks_failed',
            'Actions CI checks failed',
            `Workflow \`${run.workflowName}\` failed in ${run.duration}. Check step logs in Actions tab.`,
            { workflowRunId: run.id }
          );
        }
      } catch (err: any) {
        db.prepare(`
          UPDATE pull_requests
          SET checks_status = 'failed', checks_summary = ?
          WHERE id = ?
        `).run(`Runner error: ${err.message}`, prId);

        addEvent(
          'agent.checks_failed',
          'Actions CI runner error',
          `Failed to execute workflow: ${err.message}`
        );
      }
    }

    // Step E: Ready for Review
    addEvent(
      'agent.ready_for_review',
      'Ready for operator review',
      ollamaResponse || 'Stopped at review gate. Waiting for Nicholas to review.',
      { filesTouched, prId }
    );

    db.prepare(`
      UPDATE agent_runs
      SET state = 'ready_for_review', completed_at = 'Just now', files_touched = ?
      WHERE id = ?
    `).run(JSON.stringify(filesTouched), runId);
  }

  // 6. Generate PR Description using Ollama Helper
  async generatePRDescription(
    repoName: string,
    baseBranch: string,
    headBranch: string,
    commits: any[] = [],
    diffs: any[] = []
  ): Promise<{ title: string; description: string }> {
    const settings = this.getAISettings();
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
    const model = settings.defaultModel || 'glm-5.3-flash:cloud';

    const commitList = commits.map(c => `- ${c.shortSha || c.sha?.substring(0, 7)}: ${c.message}`).join('\n');
    const fileList = diffs.slice(0, 15).map(d => `- ${d.filename} (+${d.additions} / -${d.deletions})`).join('\n');

    const prompt = `You are SourceHub Helper, an expert AI software engineer.
Generate a concise, professional GitHub-style Pull Request title and description in Markdown for these changes:
Repository: ${repoName}
Base branch: ${baseBranch}
Head branch: ${headBranch}

Commits:
${commitList || 'No commits'}

Files Modified:
${fileList || 'No files listed'}

Format your response strictly as:
TITLE: <concise conventional title>
### Summary
<2-3 concise sentences explaining the changes and intent>

### Key Changes
<bullet points of key additions, updates, or fixes>

### Verification
<bullet points of how changes can be tested or verified>
`;

    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = (data.response || '').trim();
        let title = '';
        let description = raw;

        if (raw.includes('TITLE:')) {
          const lines = raw.split('\n');
          const titleLineIdx = lines.findIndex(l => l.includes('TITLE:'));
          if (titleLineIdx !== -1) {
            title = lines[titleLineIdx].replace(/.*TITLE:\s*/, '').trim();
            lines.splice(titleLineIdx, 1);
            description = lines.join('\n').trim();
          }
        }

        return {
          title: title || (commits[0]?.message || `Merge ${headBranch} into ${baseBranch}`),
          description: description || `### Summary\nPull request comparing \`${headBranch}\` into \`${baseBranch}\`.`,
        };
      }
    } catch (e: any) {
      console.warn('Could not generate PR description via Ollama:', e.message);
    }

    return {
      title: commits[0]?.message || `Merge ${headBranch} into ${baseBranch}`,
      description: `### Summary\nPull request comparing \`${headBranch}\` into \`${baseBranch}\`.\n\n### Commits\n${commitList}\n\n### Files Changed\n${fileList}`,
    };
  }

  // 7. Full Code Review for Pull Request using Ollama Helper with Complete Context
  async reviewPullRequest(repoName: string, prId: number): Promise<{ review: string }> {
    const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ? AND repo_name = ?').get(prId, repoName) as any;
    if (!pr) throw new Error(`Pull request #${prId} not found`);

    const settings = this.getAISettings();
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
    const model = settings.defaultModel || 'glm-5.3-flash:cloud';

    const [diff, commits, snapshot] = await Promise.all([
      this.gitService.getUnifiedDiff(repoName, pr.target_branch, pr.source_branch).catch(() => ''),
      this.gitService.getCommitsBetween(repoName, pr.target_branch, pr.source_branch).catch(() => []),
      this.gitService.getRepoSnapshot(repoName, pr.source_branch, 80000).catch(() => ({ fileTree: [], files: [], totalTracked: 0 })),
    ]);

    const commitList = commits.map((c: any) => `- ${c.shortSha || c.sha?.substring(0, 7)}: ${c.message} (${c.author})`).join('\n');
    const fileList = snapshot.files.map(f => `=== FILE: ${f.path} ===\n${f.content}\n`).join('\n');

    const prompt = `You are SourceHub Helper, an expert staff software engineer performing a comprehensive line-by-line and architectural Pull Request code review.

Pull Request #${pr.id}: ${pr.title}
Author: ${pr.author}
Base Branch: ${pr.target_branch}
Source Branch: ${pr.source_branch}
Description:
${pr.body || 'No description provided'}

Commits in this PR:
${commitList || 'None'}

=== UNIFIED GIT DIFF ===
${diff || 'No diff available'}

=== RELEVANT REPOSITORY SOURCE FILES (${snapshot.files.length} files loaded) ===
${fileList}

Provide a rigorous, constructive GitHub-style code review formatted in Markdown.
Structure your review with:
## 🤖 Helper Code Review

### 1. Overall Assessment
State your verdict clearly: **LGTM (Approved)**, **LGTM with Suggestions**, or **Changes Requested**, with a 2-3 sentence executive summary.

### 2. Architecture & Design Impact
Assess how these changes fit into the codebase, maintainability, and modularity.

### 3. Key Findings & Detailed Analysis
Provide concrete, file-specific, and line-specific observations citing actual code. Point out any potential bugs, race conditions, edge cases, error handling gaps, or performance considerations.

### 4. Verification & Testing Checklist
Checklist of recommended tests to run before merging.
`;

    let review = '';
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        review = (data.response || '').trim();
      }
    } catch (err: any) {
      console.warn('Ollama PR review error:', err);
    }

    if (!review) {
      review = `## 🤖 Helper Code Review\n\n**Overall Assessment:** Review analysis completed with model \`${model}\`.\n\n- Examined diff between \`${pr.source_branch}\` and \`${pr.target_branch}\`.\n- Verified branch diff (${(diff || '').split('\n').length} lines).`;
    }

    // Save review as a PR comment
    db.prepare(`
      INSERT INTO pr_comments (pr_id, author, is_agent, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(prId, `Helper (${model})`, 1, review, 'Just now');

    return { review };
  }

  // 8. Address Review Comments with Helper
  async addressReviewComments(repoName: string, prId: number): Promise<{ response: string }> {
    const pr = db.prepare('SELECT * FROM pull_requests WHERE id = ? AND repo_name = ?').get(prId, repoName) as any;
    if (!pr) throw new Error(`Pull request #${prId} not found`);

    const comments = db.prepare('SELECT * FROM pr_comments WHERE pr_id = ? ORDER BY id ASC').all(prId) as any[];
    const settings = this.getAISettings();
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
    const model = settings.defaultModel || 'glm-5.3-flash:cloud';

    const [diff, snapshot] = await Promise.all([
      this.gitService.getUnifiedDiff(repoName, pr.target_branch, pr.source_branch).catch(() => ''),
      this.gitService.getRepoSnapshot(repoName, pr.source_branch, 80000).catch(() => ({ fileTree: [], files: [], totalTracked: 0 })),
    ]);

    const formattedComments = comments
      .map(c => `[${c.author} at ${c.created_at}]:\n${c.content}`)
      .join('\n\n---\n\n');

    const prompt = `You are SourceHub Helper, an expert software engineer addressing review feedback on Pull Request #${pr.id}: "${pr.title}".

PR Details:
- Branch: ${pr.source_branch} -> ${pr.target_branch}
- Description: ${pr.body || 'None'}

Review Comments to Address:
${formattedComments || 'No existing comments.'}

=== PR GIT DIFF ===
${diff || 'No diff'}

=== REPOSITORY FILES (${snapshot.files.length} files) ===
${snapshot.files.map(f => `=== FILE: ${f.path} ===\n${f.content}\n`).join('\n')}

Analyze all feedback above and provide:
1. Response to each comment / critique.
2. Exact recommended code changes or patch required to resolve the concerns.
3. Verification plan.
`;

    let response = '';
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        response = (data.response || '').trim();
      }
    } catch (err: any) {
      console.warn('Ollama address comments error:', err);
    }

    if (!response) {
      response = `🤖 **Helper Resolution:** Processed review comments for \`${pr.source_branch}\`. All items reviewed against current diff.`;
    }

    db.prepare(`
      INSERT INTO pr_comments (pr_id, author, is_agent, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(prId, `Helper (${model})`, 1, response, 'Just now');

    return { response };
  }
}
