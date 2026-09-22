import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { PullRequest, PRReviewComment } from '../../types';

interface PullRequestsViewProps {
  pullRequests: PullRequest[];
  onNavigateToAgentRun: (runId: string) => void;
  onNavigateToActionsRun: (runId: string) => void;
}

export const PullRequestsView: React.FC<PullRequestsViewProps> = ({
  pullRequests,
  onNavigateToAgentRun,
  onNavigateToActionsRun,
}) => {
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(pullRequests[0] || null);
  const [activeSubTab, setActiveSubTab] = useState<'conversation' | 'commits' | 'checks' | 'files'>('conversation');
  const [mergeStrategy, setMergeStrategy] = useState<'squash' | 'merge' | 'rebase'>('squash');
  const [isMerged, setIsMerged] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [comments, setComments] = useState<PRReviewComment[]>(selectedPR?.comments || []);

  const handleMerge = () => {
    if (!selectedPR) return;
    setIsMerged(true);
  };

  const handleAddComment = () => {
    if (!commentInput.trim() || !selectedPR) return;
    const newComment: PRReviewComment = {
      id: `c-${Date.now()}`,
      author: 'Nicholas Beighley',
      isAgent: false,
      content: commentInput,
      createdAt: 'Just now'
    };
    setComments([...comments, newComment]);
    setCommentInput('');
  };

  const handleAskAgentToAddress = () => {
    if (!selectedPR?.agentRunId) return;
    const newComment: PRReviewComment = {
      id: `c-${Date.now()}`,
      author: 'SourceHub Helper',
      isAgent: true,
      content: '🤖 **Helper notified:** Received review request to address recent comments. Spinning up container worktree against `' + selectedPR.sourceBranch + '`...',
      createdAt: 'Just now'
    };
    setComments([...comments, newComment]);
  };

  return (
    <div className="space-y-4">
      {/* PR Header & Filter */}
      <div className="flex items-center justify-between pb-3 border-b border-hub-border">
        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => setSelectedPR(pullRequests[0])}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium border ${
              selectedPR?.state === 'open' 
                ? 'bg-hub-subtle text-hub-text border-hub-border' 
                : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text" />
            <span>1 Open</span>
          </button>

          <button 
            onClick={() => setSelectedPR(pullRequests[1])}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium border ${
              selectedPR?.state === 'merged' 
                ? 'bg-hub-subtle text-hub-text border-hub-border' 
                : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            <span>1 Closed / Merged</span>
          </button>
        </div>

        <button 
          onClick={() => alert("Creating PR from branch...")}
          className="px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
        >
          New Pull Request
        </button>
      </div>

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
                isMerged || selectedPR.state === 'merged'
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                  : 'bg-green-900/60 text-hub-success-text border border-green-700'
              }`}>
                {isMerged || selectedPR.state === 'merged' ? (
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
                <strong className="text-hub-text">{selectedPR.author}</strong> {selectedPR.isAgent ? '(via Helper)' : ''} wants to merge 1 commit into{' '}
                <span className="bg-hub-subtle px-1.5 py-0.5 rounded font-mono text-hub-text border border-hub-border">
                  {selectedPR.targetBranch}
                </span>{' '}
                from{' '}
                <span className="bg-hub-subtle px-1.5 py-0.5 rounded font-mono text-hub-text border border-hub-border">
                  {selectedPR.sourceBranch}
                </span>
              </span>

              {selectedPR.agentRunId && (
                <button
                  onClick={() => onNavigateToAgentRun(selectedPR.agentRunId!)}
                  className="inline-flex items-center space-x-1 text-purple-400 hover:text-purple-300 underline font-mono text-[11px]"
                >
                  <Bot className="w-3 h-3" />
                  <span>View Helper Run ({selectedPR.agentRunId})</span>
                </button>
              )}
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
                {comments.length + 1}
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
              <span className="px-1.5 py-0.2 rounded-full bg-hub-subtle text-[11px] font-mono">1</span>
            </button>

            <button
              onClick={() => setActiveSubTab('checks')}
              className={`py-2 border-b-2 flex items-center space-x-1.5 ${
                activeSubTab === 'checks'
                  ? 'border-hub-accent text-hub-text font-bold'
                  : 'border-transparent text-hub-muted hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-hub-success-text" />
              <span>Checks</span>
              <span className="px-1.5 py-0.2 rounded-full bg-green-950 text-hub-success-text text-[11px] font-mono border border-green-800">
                3
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
                {selectedPR.diffs.length}
              </span>
            </button>
          </div>

          {/* Subtab Contents */}
          {activeSubTab === 'conversation' && (
            <div className="space-y-4">
              {/* Main PR Description Card */}
              <div className="border border-hub-border rounded-md overflow-hidden bg-hub-surface">
                <div className="bg-hub-subtle px-4 py-2 border-b border-hub-border flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                      NB
                    </div>
                    <span className="font-semibold text-hub-text">{selectedPR.author}</span>
                    {selectedPR.isAgent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-900/60 text-purple-300 border border-purple-700">
                        Helper AI
                      </span>
                    )}
                    <span className="text-hub-muted">commented {selectedPR.createdAt}</span>
                  </div>
                  <span className="text-hub-muted font-mono text-[11px]">Author</span>
                </div>
                <div className="p-4 text-xs text-hub-text whitespace-pre-line leading-relaxed">
                  {selectedPR.body}
                </div>
              </div>

              {/* Timeline Comments */}
              <div className="space-y-3 pl-4 border-l-2 border-hub-border ml-3">
                {comments.map((comment) => (
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

              {/* CI Checks Rollup Card */}
              <div className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-hub-success-text" />
                    <div>
                      <div className="text-xs font-bold text-hub-text">All checks have passed</div>
                      <div className="text-[11px] text-hub-muted">{selectedPR.checksSummary}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateToActionsRun('run-301')}
                    className="text-xs text-hub-link hover:underline font-mono"
                  >
                    View workflow run-301
                  </button>
                </div>

                <div className="border-t border-hub-border pt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-hub-muted">
                    <span className="flex items-center space-x-2">
                      <Check className="w-3.5 h-3.5 text-hub-success-text" />
                      <span>Unit & Integration Tests</span>
                    </span>
                    <span className="font-mono text-[11px]">0.8s</span>
                  </div>
                  <div className="flex items-center justify-between text-hub-muted">
                    <span className="flex items-center space-x-2">
                      <Check className="w-3.5 h-3.5 text-hub-success-text" />
                      <span>Static Analysis & Linter</span>
                    </span>
                    <span className="font-mono text-[11px]">1.2s</span>
                  </div>
                  <div className="flex items-center justify-between text-hub-muted">
                    <span className="flex items-center space-x-2">
                      <Check className="w-3.5 h-3.5 text-hub-success-text" />
                      <span>Container Build Sandbox</span>
                    </span>
                    <span className="font-mono text-[11px]">4.5s</span>
                  </div>
                </div>
              </div>

              {/* Merge Box (§6.2 & §9.1) */}
              <div className="border border-hub-border rounded-md p-4 bg-hub-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GitMerge className="w-5 h-5 text-hub-text" />
                    <div>
                      <span className="text-xs font-bold text-hub-text">Merge Strategy</span>
                      <p className="text-[11px] text-hub-muted">
                        Single operator merge gate.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={mergeStrategy}
                      onChange={(e) => setMergeStrategy(e.target.value as any)}
                      className="bg-hub-bg border border-hub-border rounded px-2.5 py-1 text-xs text-hub-text font-medium focus:outline-none"
                    >
                      <option value="squash">Squash and merge (recommended)</option>
                      <option value="merge">Create a merge commit</option>
                      <option value="rebase">Rebase and merge</option>
                    </select>

                    <button
                      onClick={handleMerge}
                      disabled={isMerged || selectedPR.state === 'merged'}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm transition-colors ${
                        isMerged || selectedPR.state === 'merged'
                          ? 'bg-hub-border text-hub-muted cursor-not-allowed'
                          : 'bg-hub-success hover:bg-green-700'
                      }`}
                    >
                      {isMerged || selectedPR.state === 'merged' ? 'Merged into master' : 'Confirm Merge'}
                    </button>
                  </div>
                </div>

                {/* Agent Address Comments Trigger (§9.1 & §12 Phase 4) */}
                <div className="pt-2 border-t border-hub-border/60 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-hub-muted">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Want Helper to make fixes?</span>
                  </div>
                  <button
                    onClick={handleAskAgentToAddress}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Have Agent address review comments</span>
                  </button>
                </div>
              </div>

              {/* Add Comment Box */}
              <div className="border border-hub-border rounded-md p-3 bg-hub-surface space-y-2">
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Leave a review comment for Nicholas or Helper..."
                  rows={3}
                  className="w-full bg-hub-bg border border-hub-border rounded-md p-2.5 text-xs text-hub-text focus:outline-none focus:border-hub-link"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'commits' && (
            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
              <div className="p-3 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitCommit className="w-4 h-4 text-hub-muted" />
                  <span className="font-semibold text-hub-text">feat(auth): verify fine-grained token scopes</span>
                  <span className="text-hub-muted font-mono">84f2a91</span>
                </div>
                <div className="text-hub-muted text-[11px]">18m ago</div>
              </div>
            </div>
          )}

          {activeSubTab === 'checks' && (
            <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-3">
              <div className="text-xs font-bold text-hub-text flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-hub-success-text" />
                <span>Actions CI Pipeline (.sourcehub/workflows/ci.yml)</span>
              </div>
              <div className="space-y-2 text-xs font-mono text-hub-muted pl-4">
                <div>[✓] Step 1: Set up Go 1.23 environment (2s)</div>
                <div>[✓] Step 2: Inject repository encrypted secrets (1s)</div>
                <div>[✓] Step 3: Run unit & integration tests (12s)</div>
                <div>[✓] Step 4: Verify static analysis & linter (5s)</div>
                <div>[✓] Step 5: Build lightweight container image (4s)</div>
              </div>
            </div>
          )}

          {activeSubTab === 'files' && (
            <div className="space-y-4">
              {selectedPR.diffs.map((diff) => (
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
                        <span className="w-8 select-none text-right pr-2 text-hub-muted/40">
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
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-hub-muted text-xs">
          No pull request selected.
        </div>
      )}
    </div>
  );
};
