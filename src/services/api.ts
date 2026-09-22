import { Repository, FileItem, Commit, PullRequest, Secret, PersonalAccessToken, SSHKey, DiffFile, WorkflowRun, AgentRun, Webhook } from '../types';

export const api = {
  // --- Repositories ---
  async fetchRepositories(): Promise<Repository[]> {
    const res = await fetch('/api/v1/repos');
    if (!res.ok) throw new Error('Failed to fetch repositories');
    return await res.json();
  },

  async fetchRepository(name: string): Promise<Repository> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error('Failed to fetch repository');
    return await res.json();
  },

  async createRepository(name: string, description: string = ''): Promise<Repository> {
    const res = await fetch('/api/v1/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create repository');
    }
    return await res.json();
  },

  // --- Branches ---
  async fetchBranches(repoName: string): Promise<string[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/branches`);
    if (!res.ok) throw new Error('Failed to fetch branches');
    return await res.json();
  },

  async createBranch(repoName: string, branchName: string, baseBranch?: string): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: branchName, base: baseBranch }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create branch');
    }
  },

  // --- Commits & Files ---
  async fetchCommits(repoName: string, branch: string = 'HEAD', limit: number = 25): Promise<Commit[]> {
    const res = await fetch(
      `/api/v1/repos/${encodeURIComponent(repoName)}/commits?branch=${encodeURIComponent(branch)}&limit=${limit}`
    );
    if (!res.ok) throw new Error('Failed to fetch commits');
    return await res.json();
  },

  async fetchTree(repoName: string, branch: string = 'HEAD', path: string = ''): Promise<FileItem[]> {
    const res = await fetch(
      `/api/v1/repos/${encodeURIComponent(repoName)}/tree?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`
    );
    if (!res.ok) throw new Error('Failed to fetch file tree');
    const data = await res.json();
    return data.map((item: any) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
      size: item.size,
      lastCommitMessage: item.lastCommitMessage || '',
      lastCommitDate: item.lastCommitDate || '',
    }));
  },

  async fetchBlob(repoName: string, branch: string = 'HEAD', path: string): Promise<string> {
    const res = await fetch(
      `/api/v1/repos/${encodeURIComponent(repoName)}/blob?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`
    );
    if (!res.ok) throw new Error('Failed to fetch file content');
    const data = await res.json();
    return data.content || '';
  },

  // --- Real Pull Requests ---
  async fetchPRs(repoName: string): Promise<PullRequest[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls`);
    if (!res.ok) throw new Error('Failed to fetch pull requests');
    return await res.json();
  },

  async fetchPR(repoName: string, id: number): Promise<PullRequest> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls/${id}`);
    if (!res.ok) throw new Error('Failed to fetch pull request');
    return await res.json();
  },

  async compareBranches(repoName: string, base: string, head: string): Promise<{ base: string; head: string; commits: Commit[]; diffs: DiffFile[] }> {
    const res = await fetch(
      `/api/v1/repos/${encodeURIComponent(repoName)}/pulls/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
    );
    if (!res.ok) throw new Error('Failed to compare branches');
    return await res.json();
  },

  async generatePRDescription(
    repoName: string,
    data: { base: string; head: string; commits?: Commit[]; diffs?: DiffFile[] }
  ): Promise<{ title?: string; description: string }> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to generate description with Helper');
    return await res.json();
  },

  async createPR(
    repoName: string,
    data: { title: string; body?: string; sourceBranch: string; targetBranch: string; isAgent?: boolean; agentRunId?: string }
  ): Promise<{ id: number }> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create pull request');
    }
    return await res.json();
  },

  async addPRComment(repoName: string, id: number, content: string, isAgent: boolean = false): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, isAgent }),
    });
    if (!res.ok) throw new Error('Failed to add comment');
  },

  async mergePR(
    repoName: string,
    id: number,
    strategy: 'squash' | 'merge' | 'rebase' = 'squash'
  ): Promise<{ success: boolean; commitSha?: string; message: string }> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/pulls/${id}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to merge pull request');
    }
    return await res.json();
  },

  // --- Real Issues ---
  async fetchIssues(repoName: string): Promise<any[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/issues`);
    if (!res.ok) throw new Error('Failed to fetch issues');
    return await res.json();
  },

  async createIssue(repoName: string, data: { title: string; body?: string; assignedToAgent?: boolean }): Promise<{ id: number }> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create issue');
    return await res.json();
  },

  async updateIssue(repoName: string, id: number, data: { status?: string; assignedToAgent?: boolean }): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update issue');
  },

  // --- Real Workflows ---
  async fetchWorkflows(repoName: string): Promise<any[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/workflows`);
    if (!res.ok) throw new Error('Failed to fetch workflows');
    return await res.json();
  },

  // --- Real Secrets ---
  async fetchSecrets(repoName: string): Promise<Secret[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/secrets`);
    if (!res.ok) throw new Error('Failed to fetch secrets');
    return await res.json();
  },

  async createSecret(repoName: string, data: { name: string; scope: string }): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create secret');
  },

  async deleteSecret(repoName: string, id: string): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/secrets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete secret');
  },

  // --- Real Tokens ---
  async fetchTokens(): Promise<PersonalAccessToken[]> {
    const res = await fetch('/api/v1/tokens');
    if (!res.ok) throw new Error('Failed to fetch tokens');
    return await res.json();
  },

  async createToken(data: { name: string; scopes: string[] }): Promise<void> {
    const res = await fetch('/api/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create token');
  },

  async deleteToken(id: string): Promise<void> {
    const res = await fetch(`/api/v1/tokens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete token');
  },

  // --- Real SSH Keys ---
  async fetchKeys(): Promise<SSHKey[]> {
    const res = await fetch('/api/v1/keys');
    if (!res.ok) throw new Error('Failed to fetch SSH keys');
    return await res.json();
  },

  async createKey(data: { title: string; publicKey: string; type?: string }): Promise<void> {
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save SSH key');
  },

  // --- Real Ollama Models & AI Settings ---
  async fetchOllamaModels(url?: string): Promise<{ models: string[]; defaultModel: string }> {
    const q = url ? `?url=${encodeURIComponent(url)}` : '';
    const res = await fetch(`/api/v1/ollama/models${q}`);
    if (!res.ok) throw new Error('Failed to discover Ollama models');
    return await res.json();
  },

  async fetchAISettings(): Promise<{ provider: string; ollamaUrl: string; defaultModel: string }> {
    const res = await fetch('/api/v1/settings/ai');
    if (!res.ok) throw new Error('Failed to fetch AI settings');
    return await res.json();
  },

  async saveAISettings(settings: { provider?: string; ollamaUrl?: string; defaultModel?: string }): Promise<void> {
    const res = await fetch('/api/v1/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save AI settings');
  },

  // --- Real Actions / Workflows ---
  async fetchWorkflowRuns(repoName: string): Promise<WorkflowRun[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/actions/runs`);
    if (!res.ok) throw new Error('Failed to fetch workflow runs');
    return await res.json();
  },

  async dispatchWorkflow(repoName: string, workflowId: string = 'ci.yml', branch: string = 'main'): Promise<WorkflowRun> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/actions/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, branch }),
    });
    if (!res.ok) throw new Error('Failed to dispatch workflow');
    return await res.json();
  },

  // --- Real Helper Agent Runs ---
  async fetchAgentRuns(repoName: string): Promise<AgentRun[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/agents/runs`);
    if (!res.ok) throw new Error('Failed to fetch agent runs');
    return await res.json();
  },

  async launchAgentTask(
    repoName: string,
    data: { prompt: string; baseBranch?: string; mode?: 'open_pr' | 'branch_only'; model?: string }
  ): Promise<AgentRun> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/agents/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to launch agent task');
    return await res.json();
  },

  // --- Real Webhooks ---
  async fetchWebhooks(repoName: string): Promise<Webhook[]> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/webhooks`);
    if (!res.ok) throw new Error('Failed to fetch webhooks');
    return await res.json();
  },

  async createWebhook(repoName: string, data: { url: string; events?: string[] }): Promise<{ id: string; url: string }> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create webhook');
    return await res.json();
  },

  async deleteWebhook(repoName: string, id: string): Promise<void> {
    const res = await fetch(`/api/v1/repos/${encodeURIComponent(repoName)}/webhooks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete webhook');
  },
};
