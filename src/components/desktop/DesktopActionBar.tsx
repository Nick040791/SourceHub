import React, { useState } from 'react';
import { 
  GitBranch, 
  FolderGit2, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Globe, 
  Plus, 
  Search, 
  ChevronDown, 
  Check, 
  Loader2,
  Archive,
  Trash2,
  RotateCw,
  Sliders,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { WorkingCopyStatus, Repository } from '../../types';
import { api } from '../../services/api';
import { RemoteSettingsModal } from './RemoteSettingsModal';

interface DesktopActionBarProps {
  repo: Repository;
  status: WorkingCopyStatus | null;
  onRefresh: () => void;
  onBranchSwitched: () => void;
}

export const DesktopActionBar: React.FC<DesktopActionBarProps> = ({
  repo,
  status,
  onRefresh,
  onBranchSwitched,
}) => {
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [pushErrorModal, setPushErrorModal] = useState<{ message: string; remoteUrl?: string } | null>(null);

  const branches = repo.branches || [repo.defaultBranch || 'main'];
  const filteredBranches = branches.filter(b => 
    b.toLowerCase().includes(branchFilter.toLowerCase())
  );

  const currentBranch = status?.branch || repo.currentBranch || 'main';
  const hasRemotes = status?.remotes && status.remotes.length > 0;
  const ahead = status?.ahead || 0;
  const behind = status?.behind || 0;

  const handleSwitchBranch = async (branchName: string) => {
    if (branchName === currentBranch) {
      setIsBranchMenuOpen(false);
      return;
    }
    setIsActionLoading(true);
    setActionMessage(`Switching to ${branchName}...`);
    try {
      await api.switchBranch(repo.name, branchName);
      setIsBranchMenuOpen(false);
      onBranchSwitched();
    } catch (e: any) {
      alert(`Could not switch branch: ${e.message}`);
    } finally {
      setIsActionLoading(false);
      setActionMessage(null);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setIsActionLoading(true);
    setActionMessage(`Creating branch ${newBranchName}...`);
    try {
      await api.createAndSwitchBranch(repo.name, newBranchName.trim(), currentBranch);
      setNewBranchName('');
      setIsCreatingBranch(false);
      setIsBranchMenuOpen(false);
      onBranchSwitched();
    } catch (e: any) {
      alert(`Could not create branch: ${e.message}`);
    } finally {
      setIsActionLoading(false);
      setActionMessage(null);
    }
  };

  const handleFetch = async () => {
    setIsActionLoading(true);
    setActionMessage('Fetching from remote...');
    try {
      await api.fetchRemote(repo.name, 'origin');
      onRefresh();
    } catch (e: any) {
      alert(`Fetch error: ${e.message}`);
    } finally {
      setIsActionLoading(false);
      setActionMessage(null);
    }
  };

  const handlePull = async () => {
    setIsActionLoading(true);
    setActionMessage('Pulling incoming commits...');
    try {
      await api.pullRemote(repo.name, 'origin', currentBranch);
      onRefresh();
    } catch (e: any) {
      alert(`Pull error: ${e.message}`);
    } finally {
      setIsActionLoading(false);
      setActionMessage(null);
    }
  };

  const handlePush = async () => {
    setIsActionLoading(true);
    setActionMessage('Pushing commits to remote...');
    try {
      await api.pushRemote(repo.name, 'origin', currentBranch, true);
      onRefresh();
    } catch (e: any) {
      const originRemote = status?.remotes.find(r => r.name === 'origin')?.fetchUrl || '';
      setPushErrorModal({
        message: e.message,
        remoteUrl: originRemote,
      });
    } finally {
      setIsActionLoading(false);
      setActionMessage(null);
    }
  };

  return (
    <>
      <div className="bg-hub-surface border-b border-hub-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Desktop Core Controls (Repo & Branch) */}
        <div className="flex items-center space-x-2">
          {/* Current Repository indicator */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-hub-bg border border-hub-border text-hub-text font-medium">
            <FolderGit2 className="w-3.5 h-3.5 text-hub-link" />
            <span className="text-hub-muted text-[11px]">Repository:</span>
            <span className="font-bold font-mono">{repo.name}</span>
            {!status?.isClean && (
              <span className="w-2 h-2 rounded-full bg-yellow-400" title="Uncommitted changes present" />
            )}
          </div>

          {/* Current Branch Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-text font-medium transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-hub-muted text-[11px]">Current Branch:</span>
              <span className="font-bold font-mono text-purple-300">{currentBranch}</span>
              <ChevronDown className="w-3 h-3 text-hub-muted ml-0.5" />
            </button>

            {isBranchMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-hub-surface border border-hub-border rounded-lg shadow-2xl z-50 p-2 text-xs animate-in fade-in duration-100">
                <div className="pb-2 border-b border-hub-border mb-2 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-hub-muted uppercase tracking-wider">
                      Switch Branch
                    </span>
                    <button
                      onClick={() => setIsCreatingBranch(!isCreatingBranch)}
                      className="text-hub-accent hover:text-blue-400 text-[11px] font-semibold flex items-center space-x-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>

                  {isCreatingBranch ? (
                    <form onSubmit={handleCreateBranch} className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="New branch name..."
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        className="w-full px-2.5 py-1 bg-hub-bg border border-hub-border rounded font-mono text-xs text-hub-text focus:outline-none focus:border-hub-accent"
                        autoFocus
                      />
                      <div className="flex justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => setIsCreatingBranch(false)}
                          className="px-2 py-0.5 text-hub-muted hover:text-hub-text text-[11px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newBranchName.trim()}
                          className="px-2 py-0.5 bg-hub-accent text-white rounded text-[11px] font-semibold"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="relative">
                      <Search className="w-3 h-3 text-hub-muted absolute left-2 top-2" />
                      <input
                        type="text"
                        placeholder="Filter branches..."
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="w-full pl-7 pr-2 py-1 bg-hub-bg border border-hub-border rounded text-xs text-hub-text focus:outline-none focus:border-hub-accent"
                      />
                    </div>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredBranches.map((b) => (
                    <button
                      key={b}
                      onClick={() => handleSwitchBranch(b)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left font-mono text-xs transition-colors ${
                        b === currentBranch
                          ? 'bg-hub-accent/15 text-hub-accent font-bold'
                          : 'text-hub-text hover:bg-hub-subtle'
                      }`}
                    >
                      <span className="truncate">{b}</span>
                      {b === currentBranch && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center / Action Message Indicator */}
        {actionMessage && (
          <div className="flex items-center space-x-1.5 text-hub-accent font-medium text-xs animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Right: GitHub Desktop Sync Button & Remote Config */}
        <div className="flex items-center space-x-2">
          {!hasRemotes ? (
            <button
              onClick={() => setIsRemoteModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-200 rounded-md font-semibold transition-colors shadow-sm"
              title="Add remote to push and fetch"
            >
              <Globe className="w-3.5 h-3.5 text-purple-300" />
              <span>Add Remote</span>
            </button>
          ) : behind > 0 ? (
            <button
              onClick={handlePull}
              disabled={isActionLoading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors shadow-sm disabled:opacity-50"
              title="Pull changes from remote"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Pull origin ({behind})</span>
            </button>
          ) : ahead > 0 ? (
            <button
              onClick={handlePush}
              disabled={isActionLoading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-hub-accent hover:bg-blue-600 text-white rounded-md font-semibold transition-colors shadow-sm disabled:opacity-50"
              title="Push local commits to remote"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Push origin ({ahead})</span>
            </button>
          ) : (
            <button
              onClick={handleFetch}
              disabled={isActionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-text rounded-md font-semibold transition-colors disabled:opacity-50"
              title={status?.lastFetched ? `Last fetched ${status.lastFetched}` : 'Fetch latest remote refs'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-hub-muted ${isActionLoading ? 'animate-spin' : ''}`} />
              <span>Fetch origin</span>
              {status?.lastFetched && (
                <span className="text-[10px] text-hub-muted font-normal">({status.lastFetched})</span>
              )}
            </button>
          )}

          {/* Remote Settings Modal Trigger */}
          <button
            onClick={() => setIsRemoteModalOpen(true)}
            className="p-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-muted hover:text-hub-text rounded-md transition-colors"
            title="Manage Git Remotes"
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          {/* Refresh Status */}
          <button
            onClick={onRefresh}
            className="p-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-muted hover:text-hub-text rounded-md transition-colors"
            title="Refresh working copy status"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <RemoteSettingsModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        repoName={repo.name}
        onRemotesChanged={onRefresh}
      />

      {pushErrorModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center space-x-2.5 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-hub-text">Push to Remote Failed</h3>
            </div>

            <p className="text-xs text-hub-muted leading-relaxed">
              Git was unable to push <span className="font-mono text-purple-300 font-semibold">{currentBranch}</span> to the remote repository.
            </p>

            <div className="p-3 bg-red-950/30 border border-red-900/60 rounded font-mono text-[11px] text-red-200 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
              {pushErrorModal.message}
            </div>

            <div className="p-3 bg-hub-bg border border-hub-border rounded space-y-2 text-xs">
              <div className="font-semibold text-hub-text flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-hub-accent" />
                <span>Does this repository exist on GitHub?</span>
              </div>
              <p className="text-[11px] text-hub-muted">
                If the repository does not exist on GitHub yet, you can create it with the matching repository name <code className="font-mono text-hub-text font-bold">{repo.name}</code>:
              </p>
              <a
                href={`https://github.com/new?name=${encodeURIComponent(repo.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-hub-accent hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors shadow-sm"
              >
                <span>Create repository on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-hub-border">
              <button
                onClick={() => {
                  setPushErrorModal(null);
                  setIsRemoteModalOpen(true);
                }}
                className="px-3 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded text-xs text-hub-text transition-colors"
              >
                Configure Remote URL
              </button>
              <button
                onClick={() => setPushErrorModal(null)}
                className="px-3 py-1.5 bg-hub-subtle hover:bg-hub-border rounded text-xs font-semibold text-hub-text transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
