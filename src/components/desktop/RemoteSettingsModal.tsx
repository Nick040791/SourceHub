import React, { useState, useEffect } from 'react';
import { X, Globe, Plus, Trash2, Edit2, Check, ExternalLink, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { GitRemote } from '../../types';
import { api } from '../../services/api';

interface RemoteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoName: string;
  onRemotesChanged: () => void;
}

export const RemoteSettingsModal: React.FC<RemoteSettingsModalProps> = ({
  isOpen,
  onClose,
  repoName,
  onRemotesChanged,
}) => {
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('origin');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');
  const [editingRemoteName, setEditingRemoteName] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRemotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.fetchRemotes(repoName);
      setRemotes(data);
    } catch (e: any) {
      setError(e.message || 'Could not load remotes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRemotes();
      setNewRemoteUrl('');
      setError(null);
    }
  }, [isOpen, repoName]);

  if (!isOpen) return null;

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.addRemote(repoName, newRemoteName.trim(), newRemoteUrl.trim());
      setNewRemoteUrl('');
      await loadRemotes();
      onRemotesChanged();
    } catch (e: any) {
      setError(e.message || 'Failed to add remote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRemote = async (name: string) => {
    if (!editingUrl.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.addRemote(repoName, name, editingUrl.trim(), true);
      setEditingRemoteName(null);
      await loadRemotes();
      onRemotesChanged();
    } catch (e: any) {
      setError(e.message || 'Failed to update remote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRemote = async (name: string) => {
    if (!window.confirm(`Are you sure you want to remove remote "${name}"?`)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.deleteRemote(repoName, name);
      await loadRemotes();
      onRemotesChanged();
    } catch (e: any) {
      setError(e.message || 'Failed to remove remote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-hub-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-hub-accent" />
            <h3 className="font-bold text-hub-text text-sm sm:text-base">
              Git Remotes for {repoName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-hub-muted hover:text-hub-text rounded-md hover:bg-hub-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-md flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Configured Remotes List */}
          <div className="space-y-3">
            <span className="font-bold text-hub-text uppercase tracking-wider text-[11px] block">
              Configured Remotes ({remotes.length})
            </span>

            {isLoading ? (
              <div className="py-6 flex items-center justify-center text-hub-muted space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
                <span>Loading remotes...</span>
              </div>
            ) : remotes.length === 0 ? (
              <div className="border border-hub-border border-dashed rounded-md p-6 text-center text-hub-muted space-y-1 bg-hub-bg/50">
                <Globe className="w-6 h-6 text-hub-muted mx-auto mb-1 opacity-60" />
                <p className="font-medium text-hub-text">No remote repositories configured</p>
                <p className="text-[11px]">Add a remote below (e.g. GitHub or GitLab) to push and fetch commits.</p>
              </div>
            ) : (
              <div className="divide-y divide-hub-border border border-hub-border rounded-md bg-hub-bg overflow-hidden">
                {remotes.map((remote) => (
                  <div key={remote.name} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-hub-text px-2 py-0.5 rounded bg-hub-subtle border border-hub-border text-xs">
                          {remote.name}
                        </span>
                        {remote.fetchUrl.includes('github.com') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800 font-mono">
                            GitHub
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {editingRemoteName !== remote.name ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingRemoteName(remote.name);
                                setEditingUrl(remote.fetchUrl);
                              }}
                              className="p-1 hover:bg-hub-subtle text-hub-muted hover:text-white rounded"
                              title="Edit URL"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRemote(remote.name)}
                              className="p-1 hover:bg-red-950 text-hub-muted hover:text-red-400 rounded"
                              title="Remove remote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingRemoteName(null)}
                            className="text-hub-muted hover:text-white text-[11px] px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {editingRemoteName === remote.name ? (
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          type="text"
                          value={editingUrl}
                          onChange={(e) => setEditingUrl(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-hub-surface border border-hub-border rounded text-xs font-mono text-hub-text focus:outline-none focus:border-hub-accent"
                        />
                        <button
                          onClick={() => handleUpdateRemote(remote.name)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 bg-hub-accent hover:bg-blue-600 text-white rounded text-xs font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="font-mono text-[11px] text-hub-muted break-all">
                        {remote.fetchUrl}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Remote Form */}
          <form onSubmit={handleAddRemote} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-3">
            <span className="font-bold text-hub-text uppercase tracking-wider text-[11px] block flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5 text-hub-accent" />
              <span>Add New Remote</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] text-hub-muted block">Remote Name</label>
                <input
                  type="text"
                  placeholder="origin"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-hub-bg border border-hub-border rounded text-xs font-mono text-hub-text focus:outline-none focus:border-hub-accent"
                  required
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] text-hub-muted block">
                  Remote Git URL (SSH or HTTPS)
                </label>
                <input
                  type="text"
                  placeholder="git@github.com:username/repository.git"
                  value={newRemoteUrl}
                  onChange={(e) => setNewRemoteUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-hub-bg border border-hub-border rounded text-xs font-mono text-hub-text focus:outline-none focus:border-hub-accent"
                  required
                />
              </div>
            </div>

            <p className="text-[11px] text-hub-muted leading-relaxed">
              <strong>Tip:</strong> For GitHub, use the SSH format (<code>git@github.com:username/repo.git</code>) to leverage your configured SSH keys with zero password prompts.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !newRemoteName.trim() || !newRemoteUrl.trim()}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-hub-accent hover:bg-blue-600 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding Remote...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Remote</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-hub-border bg-hub-subtle/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded text-xs font-semibold text-hub-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
