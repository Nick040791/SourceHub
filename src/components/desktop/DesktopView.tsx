import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  MinusSquare, 
  GitCommit, 
  History, 
  Trash2, 
  Archive, 
  RotateCcw, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Search, 
  Loader2, 
  ArrowRight, 
  Bot, 
  CornerDownRight, 
  ChevronRight, 
  GitBranch, 
  Plus,
  RefreshCw,
  Sparkles,
  ArrowUp,
  X,
} from 'lucide-react';
import { Repository, WorkingCopyStatus, WorkingFile, DiffFile, DiffHunk, Commit, UserProfile } from '../../types';
import { api } from '../../services/api';
import { AVATAR_COLOR_GRADIENTS } from '../profile/ProfileModal';

interface DesktopViewProps {
  repo: Repository;
  status: WorkingCopyStatus | null;
  onRefreshStatus: () => void;
  profile?: UserProfile;
  onBranchSwitched?: () => void;
}

export const DesktopView: React.FC<DesktopViewProps> = ({
  repo,
  status,
  onRefreshStatus,
  profile,
  onBranchSwitched,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'changes' | 'history'>('changes');

  // Selected files for commit (checkboxes)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<WorkingFile | null>(null);
  const [fileDiff, setFileDiff] = useState<DiffFile | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [hunkActionIndex, setHunkActionIndex] = useState<number | null>(null);

  // Commit box state
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  // Branch creation modal state
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // Stash state
  const [isStashDrawerOpen, setIsStashDrawerOpen] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [isStashing, setIsStashing] = useState(false);

  // History state
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [commitDiffs, setCommitDiffs] = useState<DiffFile[]>([]);
  const [isLoadingCommitDiffs, setIsLoadingCommitDiffs] = useState(false);
  const [commitSearch, setCommitSearch] = useState('');
  const [copiedSha, setCopiedSha] = useState(false);

  const changedFiles = status?.files || [];
  const currentBranch = status?.branch || repo.currentBranch || 'main';

  // Initialize selectedPaths to all files by default when changedFiles change
  useEffect(() => {
    if (changedFiles.length > 0) {
      setSelectedPaths(new Set(changedFiles.map(f => f.path)));
      // Auto-select first file if none selected or selected not in list
      if (!selectedFile || !changedFiles.some(f => f.path === selectedFile.path)) {
        setSelectedFile(changedFiles[0]);
      }
    } else {
      setSelectedPaths(new Set());
      setSelectedFile(null);
      setFileDiff(null);
    }
  }, [status?.files]);

  // Load diff for currently selected file in Changes view
  useEffect(() => {
    if (!selectedFile) {
      setFileDiff(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDiff(true);

    api.fetchWorkingDiff(repo.name, selectedFile.path, selectedFile.staged)
      .then(diff => {
        if (isMounted) setFileDiff(diff);
      })
      .catch(err => {
        console.warn('Failed to load working diff:', err);
        if (isMounted) setFileDiff(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDiff(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repo.name, selectedFile]);

  // Load commits when switching to History tab
  useEffect(() => {
    if (activeSubTab === 'history') {
      setIsLoadingCommits(true);
      api.fetchCommits(repo.name, currentBranch, 60)
        .then(data => {
          setCommits(data);
          if (data.length > 0 && !selectedCommit) {
            setSelectedCommit(data[0]);
          }
        })
        .catch(err => console.warn('Failed to load commits:', err))
        .finally(() => setIsLoadingCommits(false));
    }
  }, [activeSubTab, repo.name, currentBranch]);

  // Load commit diffs when a commit is selected
  useEffect(() => {
    if (selectedCommit) {
      setIsLoadingCommitDiffs(true);
      api.fetchCommitDiff(repo.name, selectedCommit.sha)
        .then(diffs => setCommitDiffs(diffs))
        .catch(() => setCommitDiffs([]))
        .finally(() => setIsLoadingCommitDiffs(false));
    } else {
      setCommitDiffs([]);
    }
  }, [repo.name, selectedCommit]);

  // Checkbox toggle logic
  const toggleSelectAll = () => {
    if (selectedPaths.size === changedFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(changedFiles.map(f => f.path)));
    }
  };

  const toggleSelectPath = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  // Discard changes to a single file
  const handleDiscardFile = async (e: React.MouseEvent, file: WorkingFile) => {
    e.stopPropagation();
    if (!window.confirm(`Discard all changes in "${file.path}"? This cannot be undone.`)) return;

    try {
      await api.discardFileChanges(repo.name, file.path);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Discard failed: ${err.message}`);
    }
  };

  // Discard all changes in working copy
  const handleDiscardAll = async () => {
    if (!window.confirm(`Discard all ${changedFiles.length} uncommitted changes? All unstaged and untracked changes will be lost.`)) return;

    try {
      await api.discardAllChanges(repo.name);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Discard all failed: ${err.message}`);
    }
  };

  // Stage a single hunk to git index
  const handleStageHunk = async (hunk: DiffHunk, idx: number) => {
    setHunkActionIndex(idx);
    try {
      await api.applyPatch(repo.name, hunk.patch, { cached: true });
      onRefreshStatus();
      if (selectedFile) {
        const d = await api.fetchWorkingDiff(repo.name, selectedFile.path, selectedFile.staged);
        setFileDiff(d);
      }
    } catch (err: any) {
      alert(`Failed to stage hunk: ${err.message}`);
    } finally {
      setHunkActionIndex(null);
    }
  };

  // Unstage a single hunk from git index
  const handleUnstageHunk = async (hunk: DiffHunk, idx: number) => {
    setHunkActionIndex(idx);
    try {
      await api.applyPatch(repo.name, hunk.patch, { reverse: true, cached: true });
      onRefreshStatus();
      if (selectedFile) {
        const d = await api.fetchWorkingDiff(repo.name, selectedFile.path, selectedFile.staged);
        setFileDiff(d);
      }
    } catch (err: any) {
      alert(`Failed to unstage hunk: ${err.message}`);
    } finally {
      setHunkActionIndex(null);
    }
  };

  // Discard a single hunk from working copy
  const handleDiscardHunk = async (hunk: DiffHunk, idx: number) => {
    if (!window.confirm('Discard changes in this hunk? This cannot be undone.')) return;
    setHunkActionIndex(idx);
    try {
      await api.applyPatch(repo.name, hunk.patch, { reverse: true, cached: false });
      onRefreshStatus();
      if (selectedFile) {
        const d = await api.fetchWorkingDiff(repo.name, selectedFile.path, selectedFile.staged);
        setFileDiff(d);
      }
    } catch (err: any) {
      alert(`Failed to discard hunk: ${err.message}`);
    } finally {
      setHunkActionIndex(null);
    }
  };

  // Discard only selected files
  const handleDiscardSelected = async () => {
    if (selectedPaths.size === 0) return;
    if (!window.confirm(`Discard changes in ${selectedPaths.size} selected file(s)? This cannot be undone.`)) return;

    try {
      await api.discardSelectedChanges(repo.name, Array.from(selectedPaths));
      onRefreshStatus();
    } catch (err: any) {
      alert(`Discard selected failed: ${err.message}`);
    }
  };

  // Smart Auto-fill commit fields
  const handleAutoFillCommit = () => {
    let files = Array.from(selectedPaths);
    if (files.length === 0 && changedFiles.length > 0) {
      files = changedFiles.map(f => f.path);
      setSelectedPaths(new Set(files));
    }
    if (files.length === 0) return;

    let scope = 'app';
    let type = 'feat';

    const hasServer = files.some(f => f.startsWith('server/'));
    const hasUI = files.some(f => f.startsWith('src/components/'));
    const hasDesktop = files.some(f => f.includes('desktop'));
    const hasPR = files.some(f => f.includes('/pr/'));
    const hasStyles = files.some(f => f.endsWith('.css'));
    const hasTypes = files.some(f => f.includes('types'));

    if (hasDesktop) {
      scope = 'desktop';
      type = 'feat';
    } else if (hasServer && hasUI) {
      scope = 'forge';
      type = 'feat';
    } else if (hasServer) {
      scope = 'api';
      type = 'feat';
    } else if (hasPR) {
      scope = 'pr';
      type = 'feat';
    } else if (hasStyles) {
      scope = 'theme';
      type = 'style';
    } else if (hasTypes) {
      scope = 'types';
      type = 'refactor';
    } else if (files.length === 1) {
      const name = files[0].split('/').pop()?.split('.')[0] || 'file';
      scope = name;
      type = 'feat';
    }

    const fileListSnippet = files.slice(0, 3).map(f => f.split('/').pop()).join(', ');
    const moreCount = files.length > 3 ? ` and ${files.length - 3} more` : '';
    const generatedSummary = `${type}(${scope}): update ${fileListSnippet}${moreCount}`;

    const generatedDescription = `Changes included in this commit:\n` +
      files.map(f => {
        const fileObj = changedFiles.find(cf => cf.path === f);
        return `- ${f} (${fileObj?.status || 'modified'})`;
      }).join('\n') +
      `\n\nAuto-generated commit summary for SourceHub Desktop.`;

    setSummary(generatedSummary);
    setDescription(generatedDescription);
  };

  // Create branch directly within Desktop View
  const handleCreateBranchInDesktop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchInput.trim()) return;

    setIsCreatingBranch(true);
    try {
      await api.createAndSwitchBranch(repo.name, newBranchInput.trim(), currentBranch);
      setNewBranchInput('');
      setIsBranchModalOpen(false);
      onRefreshStatus();
      onBranchSwitched?.();
    } catch (err: any) {
      alert(`Could not create branch: ${err.message}`);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Commit and immediately push to remote
  const handleCommitAndPush = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!summary.trim() || selectedPaths.size === 0) return;

    setIsCommitting(true);
    try {
      const filesToCommit = Array.from(selectedPaths);
      await api.commitWorkingCopy(repo.name, summary.trim(), description.trim() || undefined, filesToCommit);
      setSummary('');
      setDescription('');
      onRefreshStatus();

      setIsPushing(true);
      try {
        await api.pushRemote(repo.name, 'origin', currentBranch);
        alert(`Committed and pushed cleanly to origin/${currentBranch}!`);
      } catch (pushErr: any) {
        alert(`Committed successfully, but push to remote failed: ${pushErr.message}`);
      } finally {
        setIsPushing(false);
      }
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Commit selected files
  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || selectedPaths.size === 0) return;

    setIsCommitting(true);
    try {
      const filesToCommit = Array.from(selectedPaths);
      await api.commitWorkingCopy(repo.name, summary.trim(), description.trim() || undefined, filesToCommit);
      setSummary('');
      setDescription('');
      onRefreshStatus();
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Undo last commit (soft reset HEAD~1)
  const handleUndoCommit = async () => {
    if (!window.confirm('Undo the most recent commit? Changes will remain uncommitted in your working directory.')) return;

    setIsUndoing(true);
    try {
      await api.undoLastCommit(repo.name);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Undo commit error: ${err.message}`);
    } finally {
      setIsUndoing(false);
    }
  };

  // Stash handlers
  const handleCreateStash = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsStashing(true);
    try {
      await api.manageStash(repo.name, 'save', stashMessage.trim() || undefined);
      setStashMessage('');
      setIsStashDrawerOpen(false);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Stash failed: ${err.message}`);
    } finally {
      setIsStashing(false);
    }
  };

  const handlePopStash = async (index: number) => {
    setIsStashing(true);
    try {
      await api.manageStash(repo.name, 'pop', undefined, index);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Pop stash failed: ${err.message}`);
    } finally {
      setIsStashing(false);
    }
  };

  const handleDropStash = async (index: number) => {
    if (!window.confirm(`Drop stash@{${index}}?`)) return;
    setIsStashing(true);
    try {
      await api.manageStash(repo.name, 'drop', undefined, index);
      onRefreshStatus();
    } catch (err: any) {
      alert(`Drop stash failed: ${err.message}`);
    } finally {
      setIsStashing(false);
    }
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  // Filtered files
  const filteredChangedFiles = changedFiles.filter(f =>
    f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  // Filtered history
  const filteredCommits = commits.filter(c =>
    c.message.toLowerCase().includes(commitSearch.toLowerCase()) ||
    c.sha.toLowerCase().includes(commitSearch.toLowerCase()) ||
    c.author.toLowerCase().includes(commitSearch.toLowerCase())
  );

  return (
    <div className="bg-hub-surface border border-hub-border rounded-lg shadow-sm flex flex-col min-h-[680px] overflow-hidden">
      {/* Top Desktop Sub-Navbar */}
      <div className="bg-hub-subtle/80 border-b border-hub-border px-4 py-2 flex items-center justify-between">
        {/* Left: View Switcher (Changes vs History) */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSubTab('changes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeSubTab === 'changes'
                ? 'bg-hub-surface text-hub-text border border-hub-border shadow-sm'
                : 'text-hub-muted hover:text-hub-text hover:bg-hub-surface/50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-hub-accent" />
            <span>Changes</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              changedFiles.length > 0 ? 'bg-hub-accent/20 text-hub-accent font-bold' : 'bg-hub-bg text-hub-muted'
            }`}>
              {changedFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeSubTab === 'history'
                ? 'bg-hub-surface text-hub-text border border-hub-border shadow-sm'
                : 'text-hub-muted hover:text-hub-text hover:bg-hub-surface/50'
            }`}
          >
            <History className="w-3.5 h-3.5 text-hub-purple-text" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBranchModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-hub-muted hover:text-hub-text hover:bg-hub-surface/50 border border-transparent hover:border-hub-border transition-colors"
            title="Create and switch to a new branch"
          >
            <GitBranch className="w-3.5 h-3.5 text-hub-accent" />
            <span className="hidden sm:inline">New Branch</span>
          </button>
        </div>

        {/* Right: Quick actions for Changes */}
        {activeSubTab === 'changes' && (
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setIsStashDrawerOpen(!isStashDrawerOpen)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition-colors ${
                (status?.stashes || []).length > 0
                  ? 'bg-hub-purple/15 text-hub-purple-text border-hub-purple/35'
                  : 'bg-hub-bg text-hub-muted hover:text-hub-text border-hub-border'
              }`}
              title="Manage Stashes"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Stash ({(status?.stashes || []).length})</span>
            </button>

            {selectedPaths.size > 0 && selectedPaths.size < changedFiles.length && (
              <button
                type="button"
                onClick={handleDiscardSelected}
                className="flex items-center space-x-1 px-2 py-1 bg-hub-bg hover:bg-hub-danger/10 text-hub-muted hover:text-hub-danger-text border border-hub-border hover:border-hub-danger/40 rounded transition-colors"
                title={`Discard changes in ${selectedPaths.size} selected file(s)`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard ({selectedPaths.size})</span>
              </button>
            )}

            {changedFiles.length > 0 && (
              <button
                onClick={handleDiscardAll}
                className="flex items-center space-x-1 px-2.5 py-1 bg-hub-bg hover:bg-hub-danger/10 text-hub-muted hover:text-hub-danger-text border border-hub-border hover:border-hub-danger/40 rounded transition-colors"
                title="Discard all working copy changes"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard all</span>
              </button>
            )}

            <button
              onClick={onRefreshStatus}
              className="p-1 bg-hub-bg hover:bg-hub-subtle text-hub-muted hover:text-hub-text border border-hub-border rounded"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Split Body */}
      {activeSubTab === 'changes' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[580px]">
          {/* Left Panel: Changed Files List & Commit Box */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-hub-border flex flex-col bg-hub-surface shrink-0">
            {/* Stash Drawer (if open) */}
            {isStashDrawerOpen && (
              <div className="p-3 bg-hub-bg border-b border-hub-border space-y-2 text-xs animate-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between font-bold text-hub-text">
                  <span className="flex items-center space-x-1">
                    <Archive className="w-3.5 h-3.5 text-hub-purple-text" />
                    <span>Git Stash</span>
                  </span>
                  <button
                    onClick={() => setIsStashDrawerOpen(false)}
                    className="text-hub-muted hover:text-hub-text text-[11px]"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleCreateStash} className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Stash message (optional)..."
                    value={stashMessage}
                    onChange={(e) => setStashMessage(e.target.value)}
                    className="w-full px-2.5 py-1 bg-hub-surface border border-hub-border rounded text-xs text-hub-text focus:outline-none focus:border-hub-accent"
                  />
                  <button
                    type="submit"
                    disabled={isStashing || changedFiles.length === 0}
                    className="w-full py-1 bg-hub-purple hover:brightness-110 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
                  >
                    {isStashing ? 'Stashing...' : 'Stash All Changes'}
                  </button>
                </form>

                {/* Stash List */}
                {(status?.stashes || []).length > 0 && (
                  <div className="pt-2 border-t border-hub-border space-y-1 max-h-36 overflow-y-auto">
                    {(status?.stashes || []).map((s) => (
                      <div key={s.index} className="p-1.5 bg-hub-surface rounded border border-hub-border flex items-center justify-between text-[11px]">
                        <div className="truncate pr-2">
                          <span className="font-mono text-hub-purple-text mr-1">stash@{`{${s.index}}`}</span>
                          <span className="text-hub-text">{s.message}</span>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handlePopStash(s.index)}
                            className="px-1.5 py-0.5 bg-hub-accent/20 text-hub-accent hover:bg-hub-accent hover:text-zinc-950 rounded"
                            title="Apply and remove stash"
                          >
                            Pop
                          </button>
                          <button
                            onClick={() => handleDropStash(s.index)}
                            className="p-1 text-hub-muted hover:text-hub-danger-text"
                            title="Delete stash"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Changed Files Header */}
            <div className="p-3 border-b border-hub-border flex items-center justify-between text-xs bg-hub-surface">
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleSelectAll}
                  disabled={changedFiles.length === 0}
                  className="text-hub-muted hover:text-hub-text transition-colors disabled:opacity-40"
                  title="Toggle Select All"
                >
                  {selectedPaths.size === 0 ? (
                    <Square className="w-4 h-4" />
                  ) : selectedPaths.size === changedFiles.length ? (
                    <CheckSquare className="w-4 h-4 text-hub-accent" />
                  ) : (
                    <MinusSquare className="w-4 h-4 text-hub-accent" />
                  )}
                </button>
                <span className="font-bold text-hub-text">
                  {selectedPaths.size} of {changedFiles.length} files selected
                </span>
              </div>
            </div>

            {/* Filter Input */}
            {changedFiles.length > 5 && (
              <div className="p-2 border-b border-hub-border bg-hub-bg/60">
                <div className="relative">
                  <Search className="w-3 h-3 text-hub-muted absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Filter changed files..."
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 bg-hub-surface border border-hub-border rounded text-xs text-hub-text focus:outline-none focus:border-hub-accent"
                  />
                </div>
              </div>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto divide-y divide-hub-border/50 max-h-[340px] md:max-h-none">
              {changedFiles.length === 0 ? (
                <div className="p-8 text-center text-hub-muted space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-hub-success-text mx-auto opacity-70" />
                  <p className="font-bold text-hub-text text-xs">No uncommitted changes</p>
                  <p className="text-[11px]">Working tree is clean on {currentBranch}.</p>
                </div>
              ) : (
                filteredChangedFiles.map((file) => {
                  const isChecked = selectedPaths.has(file.path);
                  const isSelected = selectedFile?.path === file.path;

                  // Status badge pill
                  let badge = 'M';
                  let badgeColor = 'bg-hub-warning/15 text-hub-warning-text border-hub-warning/40';
                  if (file.status === 'added' || file.status === 'untracked') {
                    badge = file.status === 'untracked' ? 'U' : 'A';
                    badgeColor = file.status === 'untracked' 
                      ? 'bg-hub-accent/15 text-hub-accent border-hub-accent/40' 
                      : 'bg-hub-success/15 text-hub-success-text border-hub-success/40';
                  } else if (file.status === 'deleted') {
                    badge = 'D';
                    badgeColor = 'bg-hub-danger/15 text-hub-danger-text border-hub-danger/40';
                  } else if (file.status === 'renamed') {
                    badge = 'R';
                    badgeColor = 'bg-hub-purple/15 text-hub-purple-text border-hub-purple/35';
                  }

                  const filename = file.path.split('/').pop() || file.path;
                  const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`group px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-hub-accent/15 border-l-2 border-l-hub-accent' : 'hover:bg-hub-subtle/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectPath(file.path);
                          }}
                          className="text-hub-muted hover:text-hub-text transition-colors shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-hub-accent" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-hub-muted" />
                          )}
                        </button>

                        <span className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border ${badgeColor}`}>
                          {badge}
                        </span>

                        <div className="truncate">
                          <span className="font-semibold text-hub-text">{filename}</span>
                          {folder && (
                            <span className="text-[10px] text-hub-muted ml-1.5 font-mono">
                              {folder}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDiscardFile(e, file)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-hub-muted hover:text-hub-danger-text hover:bg-hub-surface rounded transition-all shrink-0"
                        title="Discard changes in this file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom: GitHub Desktop Commit Box */}
            <form onSubmit={handleCommit} className="p-3.5 border-t border-hub-border bg-hub-surface space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-hub-text">Commit changes</span>
                <button
                  type="button"
                  onClick={handleAutoFillCommit}
                  disabled={changedFiles.length === 0}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-hub-purple/15 hover:bg-hub-purple/25 border border-hub-purple/35 text-hub-purple-text text-[11px] font-semibold transition-colors disabled:opacity-50"
                  title="Automatically generate commit summary and description from changed files"
                >
                  <Sparkles className="w-3 h-3 text-hub-purple-text" />
                  <span>Auto-fill Commit</span>
                </button>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Summary (required)"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-hub-bg border border-hub-border rounded text-xs text-hub-text font-medium focus:outline-none focus:border-hub-accent"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-hub-bg border border-hub-border rounded text-xs text-hub-text resize-none focus:outline-none focus:border-hub-accent leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-hub-muted pt-0.5">
                <div className="flex items-center space-x-1.5 truncate">
                  <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${
                    profile?.avatarColor && AVATAR_COLOR_GRADIENTS[profile.avatarColor]
                      ? AVATAR_COLOR_GRADIENTS[profile.avatarColor].class
                      : 'from-hub-purple to-hub-accent'
                  } text-white font-bold text-[9px] flex items-center justify-center shrink-0`}>
                    {profile?.initials || 'NB'}
                  </div>
                  <span className="truncate">Commit to <strong className="text-hub-text font-mono">{currentBranch}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={handleUndoCommit}
                  disabled={isUndoing}
                  className="text-hub-muted hover:text-hub-text flex items-center space-x-1 hover:underline text-[11px]"
                  title="Undo last commit (soft reset)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={isCommitting || isPushing || !summary.trim() || selectedPaths.size === 0}
                  className="flex items-center justify-center space-x-1.5 py-2 bg-hub-accent hover:brightness-110 disabled:opacity-50 text-zinc-950 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {isCommitting && !isPushing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Committing...</span>
                    </>
                  ) : (
                    <>
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>Commit</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCommitAndPush}
                  disabled={isCommitting || isPushing || !summary.trim() || selectedPaths.size === 0}
                  className="flex items-center justify-center space-x-1.5 py-2 bg-hub-purple hover:brightness-110 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
                  title={`Commit selected changes and push directly to origin/${currentBranch}`}
                >
                  {isPushing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Pushing...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>Commit & Push</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel: Working Diff View */}
          <div className="flex-1 flex flex-col bg-hub-bg overflow-hidden min-h-[400px]">
            {selectedFile ? (
              <>
                {/* Diff Header */}
                <div className="px-4 py-2.5 border-b border-hub-border bg-hub-surface flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileCode className="w-4 h-4 text-hub-muted shrink-0" />
                    <span className="font-mono font-bold text-hub-text truncate">
                      {selectedFile.path}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-hub-subtle border border-hub-border text-hub-muted">
                      {selectedFile.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 text-[11px] font-mono">
                    {fileDiff && (
                      <div className="flex items-center space-x-2">
                        <span className="text-hub-success-text font-bold">+{fileDiff.additions}</span>
                        <span className="text-hub-danger-text font-bold">-{fileDiff.deletions}</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => handleDiscardFile(e, selectedFile)}
                      className="px-2 py-1 text-hub-muted hover:text-hub-danger-text hover:bg-hub-subtle rounded text-xs transition-colors flex items-center space-x-1"
                      title="Discard this file's changes"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Discard</span>
                    </button>
                  </div>
                </div>

                {/* Diff Lines Body */}
                <div className="flex-1 overflow-auto font-mono text-[12px] bg-[#0d1117] text-[#e6edf3]">
                  {isLoadingDiff ? (
                    <div className="p-12 text-center text-hub-muted flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                      <span>Loading unified diff...</span>
                    </div>
                  ) : !fileDiff || fileDiff.lines.length === 0 ? (
                    <div className="p-8 text-center text-hub-muted text-xs">
                      No line differences found or file is binary/empty.
                    </div>
                  ) : fileDiff.hunks && fileDiff.hunks.length > 0 ? (
                    <div className="space-y-4 p-3">
                      {fileDiff.hunks.map((hunk, hIdx) => (
                        <div key={hIdx} className="border border-hub-border rounded-xl overflow-hidden bg-[#0d1117]">
                          {/* Hunk Header Bar */}
                          <div className="bg-[#161b22] px-3 py-1.5 flex items-center justify-between border-b border-hub-border select-none">
                            <span className="text-[11px] font-mono text-hub-muted font-semibold">
                              {hunk.header}
                            </span>
                            <div className="flex items-center space-x-1.5">
                              {selectedFile.staged ? (
                                <button
                                  onClick={() => handleUnstageHunk(hunk, hIdx)}
                                  disabled={hunkActionIndex === hIdx}
                                  className="px-2 py-0.5 rounded text-[11px] bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-warning-text font-sans font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                                  title="Unstage only this hunk"
                                >
                                  {hunkActionIndex === hIdx ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <MinusSquare className="w-3 h-3" />
                                  )}
                                  <span>Unstage Hunk</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStageHunk(hunk, hIdx)}
                                    disabled={hunkActionIndex === hIdx}
                                    className="px-2 py-0.5 rounded text-[11px] bg-hub-success/15 hover:bg-hub-success/25 border border-hub-success/40 text-hub-success-text font-sans font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                                    title="Stage only this hunk"
                                  >
                                    {hunkActionIndex === hIdx ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckSquare className="w-3 h-3" />
                                    )}
                                    <span>Stage Hunk</span>
                                  </button>
                                  <button
                                    onClick={() => handleDiscardHunk(hunk, hIdx)}
                                    disabled={hunkActionIndex === hIdx}
                                    className="px-2 py-0.5 rounded text-[11px] bg-hub-bg hover:bg-hub-danger/15 border border-hub-border hover:border-hub-danger/40 text-hub-muted hover:text-hub-danger-text font-sans transition-colors flex items-center space-x-1 disabled:opacity-50"
                                    title="Discard only this hunk"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Discard Hunk</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Hunk Lines */}
                          <div className="divide-y divide-gray-800/40">
                            {hunk.lines.map((line, lIdx) => (
                              <div
                                key={lIdx}
                                className={`flex items-start leading-5 transition-colors ${
                                  line.type === 'add'
                                    ? 'bg-hub-success/10 text-hub-success-text'
                                    : line.type === 'delete'
                                    ? 'bg-hub-danger/10 text-hub-danger-text'
                                    : 'text-gray-300 hover:bg-gray-800/30'
                                }`}
                              >
                                <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                                  {line.oldLineNumber || ''}
                                </div>
                                <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                                  {line.newLineNumber || ''}
                                </div>
                                <div className="w-5 text-center select-none shrink-0 font-bold">
                                  {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                                </div>
                                <div className="flex-1 px-2 py-0.5 whitespace-pre break-all overflow-x-auto">
                                  {line.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800/40">
                      {fileDiff.lines.map((line, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start leading-5 transition-colors ${
                            line.type === 'add'
                              ? 'bg-hub-success/10 text-hub-success-text'
                              : line.type === 'delete'
                              ? 'bg-hub-danger/10 text-hub-danger-text'
                              : 'text-gray-300 hover:bg-gray-800/30'
                          }`}
                        >
                          {/* Line numbers */}
                          <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                            {line.oldLineNumber || ''}
                          </div>
                          <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                            {line.newLineNumber || ''}
                          </div>
                          {/* Sign */}
                          <div className="w-5 text-center select-none shrink-0 font-bold">
                            {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                          </div>
                          {/* Content */}
                          <div className="flex-1 px-2 py-0.5 whitespace-pre break-all overflow-x-auto">
                            {line.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-hub-surface/30">
                <CheckCircle2 className="w-12 h-12 text-hub-success-text opacity-70" />
                <h3 className="font-bold text-hub-text text-sm">Working directory is clean</h3>
                <p className="text-xs text-hub-muted max-w-sm">
                  There are no uncommitted changes on branch <code className="text-hub-purple-text">{currentBranch}</code>.
                </p>
                <button
                  onClick={() => setActiveSubTab('history')}
                  className="mt-2 flex items-center space-x-1.5 px-3 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded-xl text-xs font-semibold text-hub-text transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-hub-purple-text" />
                  <span>View Branch History</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History View: Chronological Commits List & Commit Inspection */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[580px]">
          {/* Commits List Sidebar */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-hub-border flex flex-col bg-hub-surface shrink-0">
            {/* Search */}
            <div className="p-2.5 border-b border-hub-border bg-hub-surface">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-hub-muted absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter commits by message or SHA..."
                  value={commitSearch}
                  onChange={(e) => setCommitSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-hub-bg border border-hub-border rounded text-xs text-hub-text focus:outline-none focus:border-hub-accent"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-hub-border">
              {isLoadingCommits ? (
                <div className="p-8 text-center text-hub-muted flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                  <span>Loading commit history...</span>
                </div>
              ) : filteredCommits.length === 0 ? (
                <div className="p-8 text-center text-hub-muted text-xs">
                  No commits found matching filter.
                </div>
              ) : (
                filteredCommits.map((commit) => {
                  const isSelected = selectedCommit?.sha === commit.sha;
                  const isAgent = Boolean(commit.agentRunId || commit.trailer);

                  return (
                    <div
                      key={commit.sha}
                      onClick={() => setSelectedCommit(commit)}
                      className={`p-3 cursor-pointer text-xs space-y-1.5 transition-colors ${
                        isSelected ? 'bg-hub-accent/15 border-l-2 border-l-hub-accent' : 'hover:bg-hub-subtle/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-hub-link font-semibold">
                          {commit.shortSha}
                        </span>
                        <span className="text-[11px] text-hub-muted">
                          {commit.date}
                        </span>
                      </div>

                      <p className="font-semibold text-hub-text line-clamp-2 leading-relaxed">
                        {commit.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-hub-muted pt-0.5">
                        <div className="flex items-center space-x-1.5 truncate">
                          {isAgent ? (
                            <Bot className="w-3.5 h-3.5 text-hub-purple-text shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-hub-accent text-zinc-950 font-bold text-[8px] flex items-center justify-center shrink-0">
                              {commit.author.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{commit.author}</span>
                        </div>

                        {isAgent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-hub-purple/15 text-hub-purple-text border border-hub-purple/35">
                            Helper
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Panel: Selected Commit Details & Diff */}
          <div className="flex-1 flex flex-col bg-hub-bg overflow-y-auto">
            {selectedCommit ? (
              <div className="p-5 space-y-4">
                {/* Commit Header Card */}
                <div className="bg-hub-surface border border-hub-border rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hub-border pb-3">
                    <h3 className="font-bold text-sm sm:text-base text-hub-text">
                      {selectedCommit.message}
                    </h3>

                    <button
                      onClick={() => handleCopySha(selectedCommit.sha)}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-hub-bg border border-hub-border hover:bg-hub-subtle rounded text-xs font-mono text-hub-text transition-colors shrink-0"
                      title="Copy full commit SHA"
                    >
                      {copiedSha ? (
                        <>
                          <Check className="w-3 h-3 text-hub-success-text" />
                          <span className="text-hub-success-text">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-hub-muted" />
                          <span>{selectedCommit.shortSha}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-hub-muted">
                    <div>
                      Author: <strong className="text-hub-text">{selectedCommit.author}</strong> {selectedCommit.authorEmail && `<${selectedCommit.authorEmail}>`}
                    </div>
                    <div>•</div>
                    <div>Committed: <span className="text-hub-text">{selectedCommit.date}</span></div>
                    {selectedCommit.trailer && (
                      <>
                        <div>•</div>
                        <div className="font-mono text-hub-purple-text">
                          {selectedCommit.trailer}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Files in Commit */}
                <div className="space-y-3">
                  <span className="font-bold text-hub-text text-xs uppercase tracking-wider block">
                    Changed Files ({commitDiffs.length})
                  </span>

                  {isLoadingCommitDiffs ? (
                    <div className="py-8 text-center text-hub-muted flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                      <span>Loading commit diffs...</span>
                    </div>
                  ) : commitDiffs.length === 0 ? (
                    <div className="p-6 text-center text-hub-muted text-xs border border-hub-border rounded-xl bg-hub-surface">
                      No file diffs recorded for this commit.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {commitDiffs.map((diff) => (
                        <div key={diff.filename} className="border border-hub-border rounded-xl overflow-hidden bg-[#0d1117]">
                          <div className="px-4 py-2 bg-hub-surface border-b border-hub-border flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-hub-text">
                              {diff.filename}
                            </span>
                            <div className="flex items-center space-x-2 font-mono text-[11px]">
                              <span className="text-hub-success-text">+{diff.additions}</span>
                              <span className="text-hub-danger-text">-{diff.deletions}</span>
                            </div>
                          </div>

                          <div className="font-mono text-[12px] divide-y divide-gray-800/40 overflow-x-auto">
                            {diff.lines.map((line, idx) => (
                              <div
                                key={idx}
                                className={`flex items-start leading-5 ${
                                  line.type === 'add'
                                    ? 'bg-hub-success/10 text-hub-success-text'
                                    : line.type === 'delete'
                                    ? 'bg-hub-danger/10 text-hub-danger-text'
                                    : 'text-gray-300'
                                }`}
                              >
                                <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                                  {line.oldLineNumber || ''}
                                </div>
                                <div className="w-10 px-2 py-0.5 text-right select-none text-gray-600 text-[11px] shrink-0 border-r border-hub-border">
                                  {line.newLineNumber || ''}
                                </div>
                                <div className="w-5 text-center select-none shrink-0 font-bold">
                                  {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                                </div>
                                <div className="flex-1 px-2 py-0.5 whitespace-pre">
                                  {line.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-hub-muted text-xs">
                Select a commit on the left to view its diff.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Branch Creation Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-hub-surface border border-hub-border rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hub-border">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-hub-accent" />
                <h3 className="text-sm font-bold text-hub-text">Create New Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="text-hub-muted hover:text-hub-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchInDesktop} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-hub-muted mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. feature/my-new-feature"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3 py-1.5 bg-hub-bg border border-hub-border rounded text-xs text-hub-text font-mono focus:outline-none focus:border-hub-accent"
                />
              </div>

              <div className="text-xs text-hub-muted">
                Branching off: <strong className="text-hub-text font-mono">{currentBranch}</strong>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-hub-border bg-hub-subtle text-xs font-medium text-hub-text hover:bg-hub-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBranch || !newBranchInput.trim()}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-hub-accent text-zinc-950 text-xs font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {isCreatingBranch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create & Switch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

