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
  Loader2,
  XCircle,
  Trash2
} from 'lucide-react';
import { PullRequest, PRReviewComment, PRMergeability } from '../../types';
import { api } from '../../services/api';
import { NewPRModal } from './NewPRModal';
import { MarkdownContent } from '../common/MarkdownDocView';

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
  const [filterState, setFilterState] = useState<'open' | 'closed'>('open');
  const [showNewPRModal, setShowNewPRModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAddressingComments, setIsAddressingComments] = useState(false);
  const [mergeability, setMergeability] = useState<PRMergeability | null>(null);
  const [isCheckingMergeability, setIsCheckingMergeability] = useState(false);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);
  const [branchDeleted, setBranchDeleted] = useState(false);

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

  const checkMergeability = async (id: number) => {
    setIsCheckingMergeability(true);
    try {
      const result = await api.checkPRMergeability(repoName, id);
      setMergeability(result);
    } catch (err) {
      console.warn('Failed to check mergeability:', err);
      setMergeability(null);
    } finally {
      setIsCheckingMergeability(false);
    }
  };

  const loadPRDetail = async (id: number) => {
    setIsLoadingDetail(true);
    setBranchDeleted(false);
    try {
      const detail = await api.fetchPR(repoName, id);
      setSelectedPR(detail);
      if (detail.state === 'open') {
        checkMergeability(id);
      } else {
        setMergeability(null);
      }
    } catch (err) {
      console.warn('Failed to load PR detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!selectedPR) return;
    if (!confirm(`Are you sure you want to delete branch '${selectedPR.sourceBranch}'?`)) return;
    setIsDeletingBranch(true);
    try {
      await api.deleteBranch(repoName, selectedPR.sourceBranch);
      setBranchDeleted(true);
    } catch (err: any) {
      alert(`Error deleting branch: ${err.message}`);
    } finally {
      setIsDeletingBranch(false);
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

  const handleClosePR = async () => {
    if (!selectedPR) return;
    setIsClosing(true);
    try {
      await api.closePR(repoName, selectedPR.id, commentInput.trim() || undefined);
      setCommentInput('');
      await loadPRDetail(selectedPR.id);
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
    } catch (err: any) {
      alert(`Close PR error: ${err.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopenPR = async () => {
    if (!selectedPR) return;
    setIsReopening(true);
    try {
      await api.reopenPR(repoName, selectedPR.id);
      await loadPRDetail(selectedPR.id);
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
    } catch (err: any) {
      alert(`Reopen PR error: ${err.message}`);
    } finally {
      setIsReopening(false);
    }
  };

  const handleReviewWithHelper = async () => {
    if (!selectedPR || isReviewing || isAddressingComments || selectedPR.isAIBusy) return;
    setIsReviewing(true);
    try {
      await api.reviewPRWithHelper(repoName, selectedPR.id);
      await loadPRDetail(selectedPR.id);
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
    } catch (err: any) {
      alert(`Helper Review error: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleAskAgentToAddress = async () => {
    if (!selectedPR || isReviewing || isAddressingComments || selectedPR.isAIBusy) return;
    setIsAddressingComments(true);
    try {
      await api.addressPRCommentsWithHelper(repoName, selectedPR.id);
      await loadPRDetail(selectedPR.id);
      const prs = await api.fetchPRs(repoName);
      setPullRequests(prs);
    } catch (err: any) {
      alert(`Error addressing comments: ${err.message}`);
    } finally {
      setIsAddressingComments(false);
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

  const openPRs = pullRequests.filter(p => p.state === 'open');
  const closedPRs = pullRequests.filter(p => p.state !== 'open');
  const filteredList = filterState === 'open' ? openPRs : closedPRs;
  const isAIOperationBusy = isReviewing || isAddressingComments || Boolean(selectedPR?.isAIBusy);

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
            onClick={() => setFilterState('closed')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium border transition-colors ${
              filterState === 'closed'
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
                        ) : pr.state === 'closed' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text shrink-0" />
                        )}
                        <span className="truncate">#{pr.id} {pr.title}</span>
                      </span>

                      <div className="shrink-0 flex items-center">
                        {pr.checksStatus === 'passed' && (
                          <span title="CI checks passed"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /></span>
                        )}
                        {pr.checksStatus === 'failed' && (
                          <span title="CI checks failed"><XCircle className="w-3.5 h-3.5 text-red-400" /></span>
                        )}
                        {pr.checksStatus === 'running' && (
                          <span title="CI checks running..."><Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" /></span>
                        )}
                      </div>
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

                    <div className="flex items-center space-x-2 shrink-0">
                      {selectedPR.state === 'open' && (
                        <button
                          onClick={handleReviewWithHelper}
                          disabled={isAIOperationBusy}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isReviewing
                              ? 'Helper code review in progress...'
                              : isAddressingComments
                              ? 'Cannot review while comments are being addressed'
                              : selectedPR.isAIBusy
                              ? 'Helper is currently busy on this pull request'
                              : 'Generate a full staff-engineer code review using Helper'
                          }
                        >
                          {isReviewing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Reviewing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>Review with Helper</span>
                            </>
                          )}
                        </button>
                      )}
                      {selectedPR.state === 'open' ? (
                        <button
                          onClick={handleClosePR}
                          disabled={isClosing}
                          className="px-2.5 py-1.5 bg-hub-subtle hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-hub-border hover:border-red-800 rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Close</span>
                        </button>
                      ) : selectedPR.state === 'closed' ? (
                        <button
                          onClick={handleReopenPR}
                          disabled={isReopening}
                          className="px-2.5 py-1.5 bg-hub-subtle hover:bg-green-950/60 text-hub-success-text border border-hub-border hover:border-green-800 rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <GitPullRequest className="w-3.5 h-3.5" />
                          <span>Reopen</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      selectedPR.state === 'merged'
                        ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                        : selectedPR.state === 'closed'
                        ? 'bg-red-900/60 text-red-300 border border-red-700'
                        : 'bg-green-900/60 text-hub-success-text border border-green-700'
                    }`}>
                      {selectedPR.state === 'merged' ? (
                        <>
                          <GitMerge className="w-3.5 h-3.5" />
                          <span>Merged</span>
                        </>
                      ) : selectedPR.state === 'closed' ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Closed</span>
                        </>
                      ) : (
                        <>
                          <GitPullRequest className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </>
                      )}
                    </span>

                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      selectedPR.checksStatus === 'passed'
                        ? 'bg-green-950/60 text-green-300 border border-green-800'
                        : selectedPR.checksStatus === 'failed'
                        ? 'bg-red-950/60 text-red-300 border border-red-800'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-800'
                    }`}>
                      {selectedPR.checksStatus === 'passed' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          <span>Checks: passed</span>
                        </>
                      ) : selectedPR.checksStatus === 'failed' ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                          <span>Checks: failed</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span>Checks: running</span>
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
                    onClick={() => setActiveSubTab('checks')}
                    className={`py-2 border-b-2 flex items-center space-x-1.5 ${
                      activeSubTab === 'checks'
                        ? 'border-hub-accent text-hub-text font-bold'
                        : 'border-transparent text-hub-muted hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${
                      selectedPR.checksStatus === 'passed' ? 'text-green-400' :
                      selectedPR.checksStatus === 'failed' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                    <span>Checks</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                      selectedPR.checksStatus === 'passed' ? 'bg-green-950 text-green-300 border border-green-800' :
                      selectedPR.checksStatus === 'failed' ? 'bg-red-950 text-red-300 border border-red-800' :
                      'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {selectedPR.checksStatus || 'passed'}
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
                      <div className="p-4 text-xs text-hub-text leading-relaxed">
                        <MarkdownContent content={selectedPR.body || 'No description provided.'} />
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
                          <div className="p-3 text-xs text-hub-text leading-relaxed">
                            <MarkdownContent content={comment.content} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pre-Flight Mergeability Status (§6.2) */}
                    {selectedPR.state === 'open' && (
                      <div className={`border rounded-md p-3 text-xs flex items-center justify-between ${
                        isCheckingMergeability
                          ? 'bg-hub-subtle border-hub-border text-hub-muted'
                          : mergeability?.canMerge
                          ? 'bg-green-950/40 border-green-800/60 text-green-200'
                          : 'bg-red-950/40 border-red-800/60 text-red-200'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {isCheckingMergeability ? (
                            <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                          ) : mergeability?.canMerge ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold">
                              {isCheckingMergeability
                                ? 'Checking branch mergeability...'
                                : mergeability?.canMerge
                                ? `Able to merge automatically — no conflicts with ${selectedPR.targetBranch}`
                                : `Cannot merge automatically — conflict in: ${mergeability?.conflictedFiles.join(', ')}`}
                            </span>
                            {!isCheckingMergeability && !mergeability?.canMerge && (
                              <p className="text-[11px] text-red-300/80 mt-0.5">
                                Rebase or resolve conflicting files locally before merging this pull request.
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedPR.workflowRunId && (
                          <button
                            onClick={() => onNavigateToActionsRun(selectedPR.workflowRunId!)}
                            className="hidden sm:flex items-center space-x-1 text-[11px] text-hub-muted hover:text-white transition-colors"
                          >
                            <span>CI Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Post-Merge Branch Deletion Banner */}
                    {selectedPR.state === 'merged' && (
                      <div className="border border-purple-900/60 rounded-md p-3.5 bg-purple-950/30 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <GitMerge className="w-4 h-4 text-purple-400" />
                            <span className="font-semibold text-purple-200">Pull request successfully merged</span>
                          </div>
                          <p className="text-[11px] text-purple-300/70">
                            You can safely delete the head branch <code className="bg-purple-950 px-1 py-0.5 rounded text-purple-200 border border-purple-800">{selectedPR.sourceBranch}</code>.
                          </p>
                        </div>

                        {branchDeleted ? (
                          <span className="px-2.5 py-1 text-xs text-hub-muted font-medium bg-hub-subtle rounded border border-hub-border">
                            ✓ Branch deleted
                          </span>
                        ) : (
                          <button
                            onClick={handleDeleteBranch}
                            disabled={isDeletingBranch}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {isDeletingBranch ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete branch</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Merge Box (§6.2) */}
                    <div className="border border-hub-border rounded-md p-4 bg-hub-subtle space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <GitMerge className="w-5 h-5 text-hub-text" />
                          <div>
                            <span className="text-xs font-bold text-hub-text">Merge Pull Request</span>
                            <p className="text-[11px] text-hub-muted">
                              Executes directly on local git repository.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {selectedPR.state === 'closed' ? (
                            <span className="text-xs text-red-400 font-medium px-2.5 py-1 bg-red-950/40 border border-red-800/50 rounded">
                              Pull request is closed. Reopen to enable merging.
                            </span>
                          ) : (
                            <>
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
                                disabled={isMerging || selectedPR.state === 'merged' || (mergeability !== null && !mergeability.canMerge)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow-sm transition-colors flex items-center space-x-1.5 ${
                                  selectedPR.state === 'merged'
                                    ? 'bg-hub-border text-hub-muted cursor-not-allowed'
                                    : mergeability !== null && !mergeability.canMerge
                                    ? 'bg-red-950/60 text-red-300 border border-red-800 cursor-not-allowed'
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
                                ) : mergeability !== null && !mergeability.canMerge ? (
                                  <span>Blocked by Conflicts</span>
                                ) : (
                                  <span>Confirm Merge</span>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Helper Actions */}
                      <div className="pt-2 border-t border-hub-border/60 space-y-2">
                        {isAIOperationBusy && (
                          <div className="flex items-center space-x-2 px-3 py-2 rounded bg-purple-950/40 border border-purple-800 text-purple-300 text-xs animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
                            <span>
                              {isReviewing
                                ? 'Helper is analyzing the pull request diff and generating a comprehensive code review...'
                                : isAddressingComments
                                ? 'Helper is examining existing review comments and drafting responses/solutions...'
                                : 'An AI Helper operation is actively running on this pull request...'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2 text-xs text-hub-muted">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>Helper automated review & resolution</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {selectedPR.state === 'open' && (
                              <button
                                onClick={handleReviewWithHelper}
                                disabled={isAIOperationBusy}
                                className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  isReviewing
                                    ? 'Helper code review in progress...'
                                    : isAddressingComments
                                    ? 'Cannot review while comments are being addressed'
                                    : selectedPR.isAIBusy
                                    ? 'Helper is currently busy on this pull request'
                                    : 'Helper will inspect PR diff and files to provide a code review'
                                }
                              >
                                {isReviewing ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Reviewing with Helper...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Review PR with Helper</span>
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              onClick={handleAskAgentToAddress}
                              disabled={isAIOperationBusy || selectedPR.state !== 'open'}
                              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                isAddressingComments
                                  ? 'Addressing review comments...'
                                  : isReviewing
                                  ? 'Cannot address comments while Helper review is in progress'
                                  : selectedPR.isAIBusy
                                  ? 'Helper is currently busy on this pull request'
                                  : selectedPR.state !== 'open'
                                  ? 'Pull request is not open'
                                  : 'Helper will analyze review comments and propose fixes'
                              }
                            >
                              {isAddressingComments ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Addressing comments...</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="w-3.5 h-3.5" />
                                  <span>Address review comments</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
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
                      <div className="flex items-center justify-end space-x-2">
                        {selectedPR.state === 'open' ? (
                          <button
                            type="button"
                            onClick={handleClosePR}
                            disabled={isClosing}
                            className="px-3 py-1 bg-hub-subtle hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-hub-border hover:border-red-800 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{isClosing ? 'Closing...' : commentInput.trim() ? 'Close with comment' : 'Close pull request'}</span>
                          </button>
                        ) : selectedPR.state === 'closed' ? (
                          <button
                            type="button"
                            onClick={handleReopenPR}
                            disabled={isReopening}
                            className="px-3 py-1 bg-hub-subtle hover:bg-green-950/60 text-hub-success-text border border-hub-border hover:border-green-800 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            <GitPullRequest className="w-3.5 h-3.5" />
                            <span>{isReopening ? 'Reopening...' : 'Reopen pull request'}</span>
                          </button>
                        ) : null}
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
                ) : activeSubTab === 'checks' ? (
                  <div className="space-y-4">
                    <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {selectedPR.checksStatus === 'passed' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-400" />
                          ) : selectedPR.checksStatus === 'failed' ? (
                            <XCircle className="w-6 h-6 text-red-400" />
                          ) : (
                            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                          )}
                          <div>
                            <h3 className="text-sm font-bold text-hub-text">Continuous Integration (CI) Checks</h3>
                            <p className="text-xs text-hub-muted">{selectedPR.checksSummary || 'Automated verification pipeline'}</p>
                          </div>
                        </div>

                        {selectedPR.workflowRunId && (
                          <button
                            onClick={() => onNavigateToActionsRun(selectedPR.workflowRunId!)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-subtle hover:bg-hub-border text-hub-text border border-hub-border rounded text-xs font-semibold transition-colors"
                          >
                            <span>Open Workflow Run</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="pt-3 border-t border-hub-border text-xs text-hub-muted space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Target branch under test:</span>
                          <span className="font-mono text-hub-text bg-hub-subtle px-1.5 py-0.5 rounded border border-hub-border">{selectedPR.sourceBranch}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Workflow file:</span>
                          <span className="font-mono text-hub-text bg-hub-subtle px-1.5 py-0.5 rounded border border-hub-border">.sourcehub/workflows/ci.yml</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Run Status:</span>
                          <span className={`font-semibold capitalize px-2 py-0.5 rounded ${
                            selectedPR.checksStatus === 'passed' ? 'bg-green-950/80 text-green-300 border border-green-800' :
                            selectedPR.checksStatus === 'failed' ? 'bg-red-950/80 text-red-300 border border-red-800' :
                            'bg-amber-950/80 text-amber-300 border border-amber-800'
                          }`}>
                            {selectedPR.checksStatus}
                          </span>
                        </div>
                      </div>
                    </div>
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
