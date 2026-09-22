import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Bot, 
  GitCommit, 
  Check, 
  FileCode, 
  GitMerge, 
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Plus,
  Loader2
} from 'lucide-react';
import { PullRequest, PRReviewComment } from '../../types';
import { api } from '../../services/api';
import { NewPRModal } from './NewPRModal';

interface PullRequestsViewProps {
  repoName: string;
  branches: string[];
  defaultBase: string;
  onNavigateToAgentRun: (runId: string) => void;
  onNavigateToActionsRun: (runId: string) => void;
}

export const PullRequestsView: React.FC<PullRequestsViewProps> = ({
  repoName,
  branches,
  defaultBase,
  onNavigateToAgentRun,
  onNavigateToActionsRun,
}) => {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'conversation' | 'commits' | 'checks' | 'files'>('conversation');
  const [mergeStrategy, setMergeStrategy] = useState<'squash' | 'merge' | 'rebase'>('squash');
  const [isMerging, setIsMerging] = useState(false);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [filterState, setFilterState] = useState<'open' | 'merged'>('open');
  const [showNewPRModal, setShowNewPRModal] = useState(false);

  const loadPRs = async () => {
    setIsLoadingPRs(true);
    try {
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
      if (prs.length > 0) {
        loadPRDetail(prs[0].id);
      } else {
        setSelectedPR(null);
      }
    } catch (err) {
      console.warn('Failed to load PRs:', err);
    } finally {
      setIsLoadingPRs(false);
    }
  };

  const loadPRDetail = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const detail = await api.fetchPR(repoName, id);
      setSelectedPR(detail);
    } catch (err) {
      console.warn('Failed to load PR detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadPRs();
  }, [repoName]);

  const handleMerge = async () => {
    if (!selectedPR) return;
    setIsMerging(true);
    try {
      await api.mergePR(repoName, selectedPR.id, mergeStrategy);
      // Brief pause to allow Vite HMR/file-watcher to settle if working tree was modified
      await new Promise(r => setTimeout(r, 600));
      await loadPRDetail(selectedPR.id);
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
    } catch (err: any) {
      // If a transient network disconnect happened during Vite file watch restart, retry loading PR detail
      if (err.message?.includes('NetworkError') || err.message?.includes('fetch') || err.name === 'TypeError') {
        try {
          await new Promise(r => setTimeout(r, 1200));
          await loadPRDetail(selectedPR.id);
          const prs = await api.fetchPRs(repoName);
          setPullRequests(prs);
          return;
        } catch {
          // If retry also failed, display error
        }
      }
      alert(`Merge error: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !selectedPR) return;
    try {
      await api.addPRComment(repoName, selectedPR.id, commentInput);
      setCommentInput('');
      await loadPRDetail(selectedPR.id);
    } catch (err: any) {
      alert(`Comment error: ${err.message}`);
    }
  };

  const handleAskAgentToAddress = async () => {
    if (!selectedPR) return;
    try {
      await api.addPRComment(
        repoName,
        selectedPR.id,
        `🤖 **Helper notified:** Received review request to address recent comments. Spinning up container worktree against \`${selectedPR.sourceBranch}\`...`,
        true
      );
      await loadPRDetail(selectedPR.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const openPRs = pullRequests.filter(p => p.state === 'open');
  const closedPRs = pullRequests.filter(p => p.state !== 'open');
  const filteredList = filterState === 'open' ? openPRs : closedPRs;

  return (
    <div className="space-y-4">
      {/* PR Header & Filter */}
      <div className="flex items-center justify-between pb-3 border-b border-hub-border">
        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => setFilterState('open')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium border transition-colors ${
              filterState === 'open'
                ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' 
                : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text" />
            <span>{openPRs.length} Open</span>
          </button>

          <button 
            onClick={() => setFilterState('merged')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium border transition-colors ${
              filterState === 'merged'
                ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' 
                : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            <span>{closedPRs.length} Closed / Merged</span>
          </button>
        </div>

        <button 
          onClick={() => setShowNewPRModal(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Pull Request</span>
        </button>
      </div>

      {isLoadingPRs ? (
        <div className="p-12 flex items-center justify-center space-x-2 text-xs text-hub-muted">
          <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
          <span>Loading pull requests...</span>
        </div>
      ) : pullRequests.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hub-border rounded-lg p-6 space-y-3">
          <GitPullRequest className="w-8 h-8 text-hub-muted mx-auto" />
          <h3 className="font-bold text-hub-text text-sm">There aren't any pull requests yet.</h3>
          <p className="text-xs text-hub-muted max-w-sm mx-auto">
            Pull requests let you propose changes from one branch into another, review code diffs, and merge.
          </p>
          <button
            onClick={() => setShowNewPRModal(true)}
            className="px-3.5 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
          >
            Open First Pull Request
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* PR List (Left column if multiple PRs or wide screen) */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-[10px] font-bold text-hub-muted uppercase tracking-wider block px-1">
              Pull Requests ({filteredList.length})
            </span>
            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border overflow-hidden">
              {filteredList.map((pr) => {
                const isSelected = selectedPR?.id === pr.id;
                return (
                  <div
                    key={pr.id}
                    onClick={() => loadPRDetail(pr.id)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-1.5 ${
                      isSelected ? 'bg-hub-subtle border-l-2 border-l-purple-500' : 'hover:bg-hub-subtle/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-hub-text flex items-center space-x-1.5 truncate pr-2">
                        {pr.state === 'merged' ? (
                          <GitMerge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text shrink-0" />
                        )}
                        <span className="truncate">#{pr.id} {pr.title}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-hub-muted font-mono">
                      <span>{pr.sourceBranch} → {pr.targetBranch}</span>
                      <span>{pr.createdAt}</span>
                    </div>
                  </div>
                );
              })}
              {filteredList.length === 0 && (
                <div className="p-4 text-center text-xs text-hub-muted">
                  No {filterState} pull requests.
                </div>
              )}
            </div>
          </div>

          {/* Selected PR Detail View (Right column) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedPR ? (
              <div className="space-y-4">
                {/* PR Title & Status Banner */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h1 className="text-xl font-bold text-hub-text">
                      {selectedPR.title} <span className="text-hub-muted font-normal">#{selectedPR.id}</span>
                    </h1>
                  </div>

                  <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      selectedPR.state === 'merged'
                        ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                        : 'bg-green-900/60 text-hub-success-text border border-green-700'
                    }`}>
                      {selectedPR.state === 'merged' ? (
                        <>
                          <GitMerge className="w-3.5 h-3.5" />
                          <span>Merged</span>
                        </>
                      ) : (
                        <>
                          <GitPullRequest className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </>
                      )}
                    </span>

                    <span className="text-hub-muted">
                      <strong className="text-hub-text">{selectedPR.author}</strong> wants to merge commits into{' '}
                      <span className="bg-hub-subtle px-1.5 py-0.5 rounded font-mono text-hub-text border border-hub-border">
                        {selectedPR.targetBranch}
                      </span>{' '}
                      from{' '}
                      <span className="bg-hub-subtle px-1.5 py-0.5 rounded font-mono text-hub-text border border-hub-border">
                        {selectedPR.sourceBranch}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex border-b border-hub-border space-x-4 text-xs font-medium">
                  <button
                    onClick={() => setActiveSubTab('conversation')}
                    className={`py-2 border-b-2 flex items-center space-x-1.5 ${
                      activeSubTab === 'conversation'
                        ? 'border-hub-accent text-hub-text font-bold'
                        : 'border-transparent text-hub-muted hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Conversation</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-hub-subtle text-[11px] font-mono">
                      {(selectedPR.comments || []).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('commits')}
                    className={`py-2 border-b-2 flex items-center space-x-1.5 ${
                      activeSubTab === 'commits'
                        ? 'border-hub-accent text-hub-text font-bold'
                        : 'border-transparent text-hub-muted hover:text-white'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Commits</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-hub-subtle text-[11px] font-mono">
                      {(selectedPR as any).commits?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('files')}
                    className={`py-2 border-b-2 flex items-center space-x-1.5 ${
                      activeSubTab === 'files'
                        ? 'border-hub-accent text-hub-text font-bold'
                        : 'border-transparent text-hub-muted hover:text-white'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Files changed</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-hub-subtle text-[11px] font-mono">
                      {selectedPR.diffs?.length || 0}
                    </span>
                  </button>
                </div>

                {/* Subtab Contents */}
                {isLoadingDetail ? (
                  <div className="p-8 flex items-center justify-center space-x-2 text-xs text-hub-muted">
                    <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                    <span>Computing Git diff and logs...</span>
                  </div>
                ) : activeSubTab === 'conversation' ? (
                  <div className="space-y-4">
                    {/* Main PR Description Card */}
                    <div className="border border-hub-border rounded-md overflow-hidden bg-hub-surface">
                      <div className="bg-hub-subtle px-4 py-2 border-b border-hub-border flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-hub-text">{selectedPR.author}</span>
                          <span className="text-hub-muted">commented {selectedPR.createdAt}</span>
                        </div>
                        <span className="text-hub-muted font-mono text-[11px]">Author</span>
                      </div>
                      <div className="p-4 text-xs text-hub-text whitespace-pre-line leading-relaxed">
                        {selectedPR.body || 'No description provided.'}
                      </div>
                    </div>

                    {/* Timeline Comments */}
                    <div className="space-y-3 pl-4 border-l-2 border-hub-border ml-3">
                      {(selectedPR.comments || []).map((comment) => (
                        <div key={comment.id} className="border border-hub-border rounded-md overflow-hidden bg-hub-surface">
                          <div className="bg-hub-subtle px-3 py-1.5 border-b border-hub-border flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              {comment.isAgent ? (
                                <Bot className="w-4 h-4 text-hub-accent" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center">
                                  NB
                                </div>
                              )}
                              <span className="font-semibold text-hub-text">{comment.author}</span>
                              <span className="text-hub-muted">{comment.createdAt}</span>
                            </div>
                          </div>
                          <div className="p-3 text-xs text-hub-text whitespace-pre-line leading-relaxed">
                            {comment.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Real Merge Box (§6.2) */}
                    <div className="border border-hub-border rounded-md p-4 bg-hub-subtle space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <GitMerge className="w-5 h-5 text-hub-text" />
                          <div>
                            <span className="text-xs font-bold text-hub-text">Real Git Merge</span>
                            <p className="text-[11px] text-hub-muted">
                              Executes directly on local git repository.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <select
                            value={mergeStrategy}
                            onChange={(e) => setMergeStrategy(e.target.value as any)}
                            disabled={selectedPR.state === 'merged'}
                            className="bg-hub-bg border border-hub-border rounded px-2.5 py-1 text-xs text-hub-text font-medium focus:outline-none"
                          >
                            <option value="squash">Squash and merge (recommended)</option>
                            <option value="merge">Create a merge commit (--no-ff)</option>
                            <option value="rebase">Rebase and merge</option>
                          </select>

                          <button
                            onClick={handleMerge}
                            disabled={isMerging || selectedPR.state === 'merged'}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm transition-colors flex items-center space-x-1.5 ${
                              selectedPR.state === 'merged'
                                ? 'bg-hub-border text-hub-muted cursor-not-allowed'
                                : 'bg-hub-success hover:bg-green-700'
                            }`}
                          >
                            {isMerging ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Merging...</span>
                              </>
                            ) : selectedPR.state === 'merged' ? (
                              <span>Merged</span>
                            ) : (
                              <span>Confirm Merge</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Helper Action */}
                      <div className="pt-2 border-t border-hub-border/60 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs text-hub-muted">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Have Agent address comments?</span>
                        </div>
                        <button
                          onClick={handleAskAgentToAddress}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium transition-colors"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Address review comments</span>
                        </button>
                      </div>
                    </div>

                    {/* Add Comment Box */}
                    <div className="border border-hub-border rounded-md p-3 bg-hub-surface space-y-2">
                      <textarea
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Leave a comment on this pull request..."
                        rows={3}
                        className="w-full bg-hub-bg border border-hub-border rounded-md p-2.5 text-xs text-hub-text focus:outline-none focus:border-hub-link"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddComment}
                          disabled={!commentInput.trim()}
                          className="px-3 py-1 bg-hub-success hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-semibold"
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeSubTab === 'commits' ? (
                  <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
                    {((selectedPR as any).commits || []).map((c: any) => (
                      <div key={c.sha} className="p-3 text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <GitCommit className="w-4 h-4 text-hub-muted shrink-0" />
                            <span className="font-semibold text-hub-text">{c.message}</span>
                          </div>
                          <div className="text-[11px] text-hub-muted pl-6">
                            {c.author} committed {c.date}
                          </div>
                        </div>
                        <span className="text-hub-muted font-mono text-[11px]">{c.shortSha}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedPR.diffs && selectedPR.diffs.length > 0 ? (
                      selectedPR.diffs.map((diff) => (
                        <div key={diff.filename} className="border border-hub-border rounded-md overflow-hidden bg-hub-surface">
                          <div className="bg-hub-subtle px-4 py-2 border-b border-hub-border flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-hub-text">{diff.filename}</span>
                            <div className="flex items-center space-x-2 font-mono text-[11px]">
                              <span className="text-hub-success-text">+{diff.additions}</span>
                              <span className="text-hub-danger-text">-{diff.deletions}</span>
                            </div>
                          </div>

                          <div className="font-mono text-xs overflow-x-auto bg-hub-bg">
                            {diff.lines.map((line, idx) => (
                              <div
                                key={idx}
                                className={`flex py-0.5 px-2 ${
                                  line.type === 'add'
                                    ? 'bg-green-950/40 text-green-200'
                                    : line.type === 'delete'
                                    ? 'bg-red-950/40 text-red-200'
                                    : 'text-hub-muted'
                                }`}
                              >
                                <span className="w-8 select-none text-right pr-2 text-hub-muted/40 text-[11px]">
                                  {line.newLineNumber || line.oldLineNumber || ''}
                                </span>
                                <span className="w-4 select-none text-center">
                                  {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                                </span>
                                <span className="whitespace-pre">{line.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-hub-muted border border-dashed border-hub-border rounded">
                        No file changes detected between {selectedPR.targetBranch} and {selectedPR.sourceBranch}.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-hub-muted text-xs">
                Select a pull request from the list.
              </div>
            )}
          </div>
        </div>
      )}

      {/* New PR Modal */}
      <NewPRModal
        isOpen={showNewPRModal}
        onClose={() => setShowNewPRModal(false)}
        repoName={repoName}
        branches={branches}
        defaultBase={defaultBase}
        onPRCreated={loadPRs}
      />
    </div>
  );
};
