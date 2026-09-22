import React, { useState } from 'react';
import { FolderGit2, X, Plus, Lock, Check } from 'lucide-react';
import { Repository } from '../../types';

interface NewRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export const NewRepoModal: React.FC<NewRepoModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Repository name is required');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-xs">
        {/* Header */}
        <div className="bg-hub-subtle px-4 py-3 border-b border-hub-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderGit2 className="w-4 h-4 text-hub-accent" />
            <h3 className="font-bold text-hub-text text-sm">Create a New Repository</h3>
          </div>
          <button
            onClick={onClose}
            className="text-hub-muted hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-950/50 border border-red-800 text-red-300 rounded text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-hub-muted font-bold text-[11px] uppercase tracking-wider">
              Owner / Repository Name *
            </label>
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              <span className="text-hub-muted bg-hub-bg px-2.5 py-1.5 rounded border border-hub-border">
                nicholas /
              </span>
              <input
                type="text"
                placeholder="my-awesome-project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1 bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-hub-text focus:outline-none focus:border-hub-link"
              />
            </div>
            <p className="text-[10px] text-hub-muted">
              Great repository names are short and memorable.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-hub-muted font-bold text-[11px] uppercase tracking-wider">
              Description <span className="font-normal lowercase text-hub-muted/70">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-hub-bg border border-hub-border rounded p-2 text-hub-text focus:outline-none focus:border-hub-link"
            />
          </div>

          <div className="p-3 bg-hub-bg border border-hub-border rounded space-y-2">
            <div className="flex items-center space-x-2 text-hub-text">
              <Lock className="w-3.5 h-3.5 text-hub-accent" />
              <span className="font-semibold text-xs">Private Repository</span>
            </div>
            <p className="text-[11px] text-hub-muted">
              Hosted locally on your single-operator SourceHub instance at <code>/home/mrnicholas/Dev/{name || '<repo>'}</code>.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-hub-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-hub-subtle hover:bg-hub-border text-hub-muted hover:text-hub-text rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-3.5 py-1.5 bg-hub-success hover:bg-green-700 disabled:opacity-50 text-white rounded font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create repository'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
