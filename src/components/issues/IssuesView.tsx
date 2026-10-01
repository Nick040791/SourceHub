import React, { useState, useEffect, useMemo } from 'react';
import {
  CircleDot,
  CheckCircle2,
  Bot,
  Plus,
  MessageSquare,
  Sparkles,
  Loader2,
  Search,
  Trash2,
  GitPullRequest,
} from 'lucide-react';
import { api } from '../../services/api';

interface IssuesViewProps {
  repoName: string;
  onAssignToAgent: (issue: { id: number; title: string; body?: string }) => void;
}

interface Issue {
  id: number;
  title: string;
  body?: string;
  status: string;
  author: string;
  assignedToAgent?: boolean;
  agentRunId?: string;
  createdAt: string;
  comments?: number;
}

export const IssuesView: React.FC<IssuesViewProps> = ({ repoName, onAssignToAgent }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const loadIssues = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchIssues(repoName);
      setIssues(data);
    } catch (err) {
      console.warn('Failed to load issues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setSearch('');
    loadIssues();
  }, [repoName]);

  const openIssues = useMemo(() => issues.filter(i => i.status === 'open'), [issues]);
  const closedIssues = useMemo(() => issues.filter(i => i.status !== 'open'), [issues]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await api.createIssue(repoName, {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle('');
      setNewBody('');
      setShowNewIssue(false);
      setFilter('open');
      setSearch('');
      await loadIssues();
      if (created?.id) setSelectedId(created.id);
    } catch (err: any) {
      alert(`Error creating issue: ${err.message}`);
    }
  };

  // Close / reopen with optimistic clear: when an issue is closed while
  // viewing open issues it disappears from the list immediately.
  const handleToggleStatus = async (issueId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    const prev = issues;
    setBusyId(issueId);
    setIssues(cur =>
      cur.map(i => (i.id === issueId ? { ...i, status: newStatus } : i))
    );
    // If the issue no longer belongs to the active filter, move selection
    // so the detail pane doesn't go blank unexpectedly.
    try {
      await api.updateIssue(repoName, issueId, { status: newStatus });
      const data = await api.fetchIssues(repoName);
      setIssues(data);
      const stillVisible = data.some(
        i => i.id === issueId && (filter === 'open' ? i.status === 'open' : i.status !== 'open')
      );
      if (!stillVisible) {
        const next = data.find(i =>
          filter === 'open' ? i.status === 'open' : i.status !== 'open'
        );
        setSelectedId(next ? next.id : null);
      }
    } catch (err: any) {
      setIssues(prev);
      alert(`Error updating issue: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignAgent = async (issue: Issue) => {
    try {
      await api.updateIssue(repoName, issue.id, { assignedToAgent: true });
      loadIssues();
      onAssignToAgent({ id: issue.id, title: issue.title, body: issue.body });
    } catch (err: any) {
      alert(`Error assigning agent: ${err.message}`);
    }
  };

  // Permanently clear a single issue from the list.
  const handleDeleteIssue = async (issueId: number) => {
    if (!confirm(`Permanently delete issue #${issueId}? This cannot be undone.`)) return;
    const prev = issues;
    setIssues(cur => cur.filter(i => i.id !== issueId));
    if (selectedId === issueId) setSelectedId(null);
    try {
      await api.deleteIssue(repoName, issueId);
      const data = await api.fetchIssues(repoName);
      setIssues(data);
      const next = data.find(i =>
        filter === 'open' ? i.status === 'open' : i.status !== 'open'
      );
      setSelectedId(next ? next.id : null);
    } catch (err: any) {
      setIssues(prev);
      alert(`Error deleting issue: ${err.message}`);
    }
  };

  // Permanently clear all closed issues from the list.
  const handleClearClosed = async () => {
    if (closedIssues.length === 0) return;
    if (!confirm(`Permanently delete ${closedIssues.length} closed issue(s)? This cannot be undone.`)) return;
    setIsClearing(true);
    try {
      await api.clearClosedIssues(repoName);
      const data = await api.fetchIssues(repoName);
      setIssues(data);
      if (filter === 'closed') setSelectedId(null);
    } catch (err: any) {
      alert(`Error clearing closed issues: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredIssues = useMemo(() => {
    const base = filter === 'open' ? openIssues : closedIssues;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        (i.body || '').toLowerCase().includes(q) ||
        String(i.id).includes(q)
    );
  }, [openIssues, closedIssues, filter, search]);

  // Keep selection in sync with the visible list.
  useEffect(() => {
    if (filteredIssues.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !filteredIssues.some(i => i.id === selectedId)) {
      setSelectedId(filteredIssues[0].id);
    }
  }, [filteredIssues, selectedId]);

  const selected = issues.find(i => i.id === selectedId) || null;

  return (
    <div className="space-y-4">
      {/* Header: open/closed filter, search, clear-closed, new issue */}
      <div className="flex flex-col gap-3 pb-3 border-b border-hub-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('open')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === 'open' ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' : 'text-hub-muted border-transparent hover:text-white'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5 text-hub-success-text" />
              <span>{openIssues.length} Open</span>
            </button>

            <button
              onClick={() => setFilter('closed')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === 'closed' ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' : 'text-hub-muted border-transparent hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-hub-purple-text" />
              <span>{closedIssues.length} Closed</span>
            </button>

            {closedIssues.length > 0 && (
              <button
                onClick={handleClearClosed}
                disabled={isClearing}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-hub-muted hover:text-hub-danger-text border border-transparent hover:border-hub-danger/40 hover:bg-hub-danger/10 transition-colors disabled:opacity-50"
                title="Permanently delete all closed issues from the list"
              >
                {isClearing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isClearing ? 'Clearing…' : 'Clear closed'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-hub-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${filter} issues…`}
                className="w-full bg-hub-surface border border-hub-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-hub-text placeholder-hub-muted focus:outline-none focus:border-hub-link"
              />
            </div>
            <button
              onClick={() => setShowNewIssue(!showNewIssue)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg text-xs font-bold transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Issue</span>
            </button>
          </div>
        </div>
      </div>

      {showNewIssue && (
        <form onSubmit={handleCreateIssue} className="border border-hub-border rounded-xl p-5 bg-hub-surface space-y-3 text-xs">
          <span className="font-bold text-hub-text block">Create Issue in {repoName}</span>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            className="w-full bg-hub-bg border border-hub-border rounded-lg px-3 py-1.5 text-hub-text focus:outline-none focus:border-hub-link"
          />
          <textarea
            placeholder="Leave a description for the operator or Helper..."
            rows={3}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="w-full bg-hub-bg border border-hub-border rounded-lg p-2 text-hub-text focus:outline-none focus:border-hub-link"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowNewIssue(false)}
              className="px-3 py-1 bg-hub-subtle text-hub-muted hover:text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-3 py-1 bg-hub-accent hover:brightness-110 disabled:opacity-50 text-zinc-950 rounded-lg font-bold"
            >
              Submit Issue
            </button>
          </div>
        </form>
      )}

      {/* Issues master-detail layout (matches Agents / Actions / PRs) */}
      {isLoading ? (
        <div className="p-8 flex items-center justify-center space-x-2 text-xs text-hub-muted">
          <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
          <span>Loading issues...</span>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="border border-dashed border-hub-border rounded-md p-8 text-center text-xs text-hub-muted space-y-2">
          <CircleDot className="w-6 h-6 mx-auto text-hub-muted" />
          <p>
            {search.trim()
              ? `No ${filter} issues matching "${search.trim()}" in ${repoName}.`
              : `No ${filter} issues in ${repoName}.`}
          </p>
          {filter === 'closed' && closedIssues.length === 0 && issues.length > 0 && (
            <p className="text-[11px]">Closed issues are cleared from this list once deleted.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: concise issue list */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-[11px] font-semibold text-hub-muted uppercase tracking-wider px-0.5 flex items-center justify-between">
              <span>{filter === 'open' ? 'Open' : 'Closed'} Issues ({filteredIssues.length})</span>
            </div>
            <div className="border border-hub-border rounded-xl bg-hub-surface divide-y divide-hub-border overflow-hidden">
              {filteredIssues.map((issue) => {
                const isSelected = selected?.id === issue.id;
                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedId(issue.id)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-hub-subtle/90 ring-1 ring-inset ring-hub-accent/35'
                        : 'hover:bg-hub-subtle/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(issue.id, issue.status);
                        }}
                        title={issue.status === 'open' ? 'Click to close issue' : 'Click to reopen issue'}
                        className="mt-0.5 shrink-0 disabled:opacity-50"
                        disabled={busyId === issue.id}
                      >
                        {busyId === issue.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-hub-muted" />
                        ) : issue.status === 'open' ? (
                          <CircleDot className="w-4 h-4 text-hub-success-text hover:text-hub-success-text" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-hub-purple-text hover:text-hub-purple-text" />
                        )}
                      </button>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-hub-text line-clamp-1">
                            {issue.title}
                          </span>
                          {issue.assignedToAgent && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-mono bg-hub-purple/15 text-hub-purple-text border border-hub-purple/35 shrink-0">
                              <Bot className="w-3 h-3 text-hub-purple-text" />
                              <span>Helper</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-hub-muted font-mono">
                          #{issue.id} · {issue.createdAt} · {issue.author}
                        </div>
                        {issue.body && (
                          <p className="text-hub-muted text-[11px] leading-relaxed line-clamp-1">
                            {issue.body}
                          </p>
                        )}
                      </div>
                      {(issue.comments || 0) > 0 && (
                        <div className="flex items-center space-x-1 text-hub-muted text-[11px] font-mono shrink-0 pt-0.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{issue.comments}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: selected issue detail */}
          <div className="lg:col-span-8">
            {selected ? (
              <div className="border border-hub-border rounded-xl bg-hub-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-hub-border/50 pb-3.5">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.status === 'open' ? (
                        <CircleDot className="w-4 h-4 text-hub-success-text shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-hub-purple-text shrink-0" />
                      )}
                      <h3 className="font-semibold text-sm text-hub-text tracking-tight">
                        {selected.title}
                      </h3>
                      <span className="text-hub-muted font-mono text-[11px]">#{selected.id}</span>
                    </div>
                    <div className="text-[11px] text-hub-muted">
                      Opened {selected.createdAt} by <span className="text-hub-text/80">{selected.author}</span>
                      {(selected.comments || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 ml-2 font-mono">
                          <MessageSquare className="w-3 h-3" />
                          {selected.comments}
                        </span>
                      )}
                      {selected.assignedToAgent && (
                        <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.2 rounded-full text-[10px] font-mono bg-hub-purple/15 text-hub-purple-text border border-hub-purple/35">
                          <Bot className="w-3 h-3" />
                          Assigned to Helper
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!selected.assignedToAgent && selected.status === 'open' && (
                      <button
                        onClick={() => handleAssignAgent(selected)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-hub-purple/15 hover:bg-hub-purple/25 border border-hub-purple/35 text-hub-purple-text text-[11px] font-medium transition-colors"
                        title="Kick off Helper Agent task for this issue"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Assign to Helper</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleStatus(selected.id, selected.status)}
                      disabled={busyId === selected.id}
                      className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                        selected.status === 'open'
                          ? 'bg-hub-subtle hover:bg-hub-success/15 text-hub-success-text border-hub-border hover:border-hub-success/40'
                          : 'bg-hub-subtle hover:bg-hub-success/15 text-hub-success-text border-hub-border hover:border-hub-success/40'
                      }`}
                      title={selected.status === 'open' ? 'Close issue (removes it from the open list)' : 'Reopen issue'}
                    >
                      {busyId === selected.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : selected.status === 'open' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <CircleDot className="w-3.5 h-3.5" />
                      )}
                      <span>{selected.status === 'open' ? 'Close' : 'Reopen'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteIssue(selected.id)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-hub-subtle hover:bg-hub-danger/15 border border-hub-border hover:border-hub-danger/40 text-hub-muted hover:text-hub-danger-text text-[11px] font-medium transition-colors"
                      title="Permanently delete this issue from the list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {selected.body ? (
                  <div className="bg-hub-bg border border-hub-border/70 rounded-xl p-3.5 text-xs leading-relaxed text-hub-text whitespace-pre-wrap break-words">
                    {selected.body}
                  </div>
                ) : (
                  <div className="text-xs text-hub-muted italic">No description provided.</div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-hub-muted pt-1">
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>
                    {selected.status === 'open'
                      ? 'Closing removes it from the open list — find it under Closed.'
                      : 'Closed issues stay under Closed until permanently cleared.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="border border-hub-border border-dashed rounded-xl bg-hub-bg/30 flex items-center justify-center p-10 text-center h-full min-h-[240px]">
                <div className="space-y-1.5">
                  <CircleDot className="w-7 h-7 text-hub-muted/60 mx-auto" />
                  <h3 className="text-sm font-semibold text-hub-text">Select an issue</h3>
                  <p className="text-xs text-hub-muted">
                    Click an issue card to view details, close/reopen, assign to Helper, or delete it.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
