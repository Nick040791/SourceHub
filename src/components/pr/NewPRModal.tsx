import React, { useState, useEffect } from 'react';
import { GitPullRequest, X, GitBranch, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { Commit, DiffFile } from '../../types';

interface NewPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoName: string;
  branches: string[];
  defaultBase: string;
  onPRCreated: () => void;
}

export const NewPRModal: React.FC<NewPRModalProps> = ({
  isOpen,
  onClose,
  repoName,
  branches,
  defaultBase,
  onPRCreated,
}) => {
  if (!isOpen) return null;

  const [baseBranch, setBaseBranch] = useState(defaultBase || branches[0] || 'main');
  const [headBranch, setHeadBranch] = useState(branches.find(b => b !== baseBranch) || branches[0] || 'main');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [diffs, setDiffs] = useState<DiffFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Compare branches whenever base or head changes
  useEffect(() => {
    if (!baseBranch || !headBranch || baseBranch === headBranch) {
      setCommits([]);
      setDiffs([]);
      return;
    }

    let isMounted = true;
    setIsComparing(true);
    api.compareBranches(repoName, baseBranch, headBranch)
      .then(res => {
        if (isMounted) {
          setCommits(res.commits || []);
          setDiffs(res.diffs || []);
          if (res.commits && res.commits.length > 0 && !title) {
            setTitle(res.commits[0].message);
          }
        }
      })
      .catch(e => {
        console.warn('Compare failed:', e);
      })
      .finally(() => {
        if (isMounted) setIsComparing(false);
      });

    return () => { isMounted = false; };
  }, [repoName, baseBranch, headBranch]);

  const handleGenerateDescription = async () => {
    if (!repoName || !baseBranch || !headBranch || baseBranch === headBranch) return;
    setIsGeneratingDescription(true);
    setError(null);
    try {
      const res = await api.generatePRDescription(repoName, {
        base: baseBranch,
        head: headBranch,
        commits,
        diffs,
      });
      if (res && res.description) {
        setBody(res.description);
      }
      if (res && res.title && !title) {
        setTitle(res.title);
      }
    } catch (err: any) {
      console.error('Failed to generate PR description:', err);
      setError(err.message || 'Failed to generate description with Helper');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await api.createPR(repoName, {
        title: title.trim(),
        body: body.trim(),
        sourceBranch: headBranch,
        targetBranch: baseBranch,
      });
      setTitle('');
      setBody('');
      onPRCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create PR');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAdditions = diffs.reduce((acc, d) => acc + d.additions, 0);
  const totalDeletions = diffs.reduce((acc, d) => acc + d.deletions, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col text-xs overflow-hidden">
        {/* Header */}
        <div className="bg-hub-subtle px-4 py-3 border-b border-hub-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-4 h-4 text-hub-success-text" />
            <h3 className="font-bold text-hub-text text-sm">Open a Pull Request</h3>
          </div>
          <button onClick={onClose} className="text-hub-muted hover:text-white p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form & Comparison Bar */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-hub-danger/15 border border-hub-danger/40 text-hub-danger-text rounded text-xs">
              {error}
            </div>
          )}

          {/* Branch Comparator Box */}
          <div className="p-3 bg-hub-bg border border-hub-border rounded-lg space-y-2">
            <span className="text-[10px] font-bold text-hub-muted uppercase tracking-wider block">
              Compare Branches
            </span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-hub-surface border border-hub-border rounded px-2.5 py-1">
                <GitBranch className="w-3.5 h-3.5 text-hub-muted" />
                <span className="text-hub-muted text-[11px]">base:</span>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="bg-transparent text-hub-text font-mono font-medium focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b} value={b} className="bg-hub-surface">{b}</option>
                  ))}
                </select>
              </div>

              <ArrowRight className="w-3.5 h-3.5 text-hub-muted" />

              <div className="flex items-center space-x-1.5 bg-hub-surface border border-hub-border rounded px-2.5 py-1">
                <GitBranch className="w-3.5 h-3.5 text-hub-link" />
                <span className="text-hub-muted text-[11px]">compare:</span>
                <select
                  value={headBranch}
                  onChange={(e) => setHeadBranch(e.target.value)}
                  className="bg-transparent text-hub-text font-mono font-medium focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b} value={b} className="bg-hub-surface">{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Stats */}
            <div className="pt-2 border-t border-hub-border/60 flex items-center justify-between text-[11px]">
              {isComparing ? (
                <div className="flex items-center space-x-1.5 text-hub-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Comparing branches...</span>
                </div>
              ) : baseBranch === headBranch ? (
                <span className="text-hub-warning-text">Choose two different branches to compare.</span>
              ) : (
                <>
                  <div className="flex items-center space-x-1.5 text-hub-success-text font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Able to merge automatically</span>
                  </div>
                  <div className="flex items-center space-x-3 font-mono text-hub-muted">
                    <span>{commits.length} commit{commits.length === 1 ? '' : 's'}</span>
                    <span>{diffs.length} file{diffs.length === 1 ? '' : 's'}</span>
                    <span className="text-hub-success-text">+{totalAdditions}</span>
                    <span className="text-hub-danger-text">-{totalDeletions}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Title & Body */}
          <div className="space-y-1">
            <label className="block text-hub-muted font-bold text-[11px] uppercase tracking-wider">
              Title *
            </label>
            <input
              type="text"
              placeholder="Pull request title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-hub-bg border border-hub-border rounded px-3 py-1.5 text-hub-text font-medium focus:outline-none focus:border-hub-link"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-hub-muted font-bold text-[11px] uppercase tracking-wider">
                Description
              </label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription || baseBranch === headBranch}
                className="text-xs text-hub-purple-text hover:text-hub-purple-text flex items-center space-x-1.5 disabled:opacity-50 transition-colors font-medium px-2 py-0.5 rounded bg-hub-purple/10 border border-hub-purple/30 hover:bg-hub-purple/15"
                title="Use Helper to analyze commits and diffs to generate a description"
              >
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Generating description with Helper...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-hub-purple-text" />
                    <span>Generate description with Helper</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={5}
              placeholder="Explain the changes in this pull request... or click 'Generate description with Helper'"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-hub-bg border border-hub-border rounded p-2.5 text-hub-text focus:outline-none focus:border-hub-link"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-hub-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-hub-subtle hover:bg-hub-border text-hub-muted hover:text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || baseBranch === headBranch}
              className="px-3.5 py-1.5 bg-hub-accent hover:brightness-110 disabled:opacity-50 text-zinc-950 rounded-lg font-semibold transition-colors flex items-center space-x-1.5"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create pull request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
