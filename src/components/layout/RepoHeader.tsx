import React, { useState } from 'react';
import { 
  GitFork, 
  Star, 
  Eye, 
  Lock, 
  Terminal, 
  Download, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Repository } from '../../types';

interface RepoHeaderProps {
  repo: Repository;
}

export const RepoHeader: React.FC<RepoHeaderProps> = ({ repo }) => {
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneProtocol, setCloneProtocol] = useState<'http' | 'ssh' | 'local' | 'cli'>('http');
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:5173';
  const owner = repo.owner || 'operator';
  const repoPath = (repo as any).path || repo.name;
  const httpUrl = `${origin}/git/${repo.name}.git`;
  const sshUrl = `ssh://git@sourcehub.local:2222/${owner}/${repo.name}.git`;
  const localPath = `git clone ${repoPath}`;
  const cliCmd = `sh repo clone ${owner}/${repo.name}`;

  const currentCommand = 
    cloneProtocol === 'http' ? `git clone ${httpUrl}` :
    cloneProtocol === 'ssh' ? `git clone ${sshUrl}` : 
    cloneProtocol === 'local' ? localPath : 
    cliCmd;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-hub-surface border-b border-hub-border pt-4 pb-1 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Repo title & badges */}
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-hub-link hover:underline text-lg font-medium cursor-pointer">
              {repo.owner}
            </span>
            <span className="text-hub-muted text-lg">/</span>
            <span className="text-hub-text text-lg font-bold">
              {repo.name}
            </span>

            <span className="ml-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium border border-hub-border text-hub-muted bg-hub-bg">
              <Lock className="w-3 h-3" />
              <span>Private</span>
            </span>

            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-hub-border text-hub-muted bg-hub-subtle">
              Single-operator
            </span>
          </div>

          <p className="text-xs text-hub-muted max-w-2xl">
            {repo.description}
          </p>
        </div>

        {/* Action buttons (Watch, Star, Fork, Clone) */}
        <div className="flex items-center space-x-2 relative">
          <div className="flex items-center border border-hub-border rounded-md bg-hub-subtle overflow-hidden text-xs">
            <button className="flex items-center space-x-1 px-2.5 py-1.5 hover:bg-hub-border text-hub-text border-r border-hub-border transition-colors">
              <Eye className="w-3.5 h-3.5 text-hub-muted" />
              <span>Watch</span>
            </button>
            <span className="px-2 py-1.5 bg-hub-bg text-hub-muted font-mono text-[11px]">1</span>
          </div>

          <div className="flex items-center border border-hub-border rounded-md bg-hub-subtle overflow-hidden text-xs">
            <button className="flex items-center space-x-1 px-2.5 py-1.5 hover:bg-hub-border text-hub-text border-r border-hub-border transition-colors">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" />
              <span>Star</span>
            </button>
            <span className="px-2 py-1.5 bg-hub-bg text-hub-muted font-mono text-[11px]">{repo.starsCount}</span>
          </div>

          {/* Clone / Code Button */}
          <div className="relative">
            <button
              onClick={() => setShowCloneModal(!showCloneModal)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Code</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Dropdown Menu */}
            {showCloneModal && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-hub-surface border border-hub-border rounded-lg shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-hub-border mb-3">
                  <span className="text-xs font-bold text-hub-text flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4 text-hub-accent" />
                    <span>Clone Repository</span>
                  </span>
                  <button 
                    onClick={() => setShowCloneModal(false)}
                    className="text-hub-muted hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                {/* Protocol Tabs */}
                <div className="flex space-x-1 bg-hub-bg p-1 rounded-md mb-2 border border-hub-border text-xs">
                  <button
                    onClick={() => setCloneProtocol('http')}
                    className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                      cloneProtocol === 'http' ? 'bg-hub-subtle text-hub-text font-bold shadow-sm' : 'text-hub-muted hover:text-hub-text'
                    }`}
                  >
                    HTTP (Live)
                  </button>
                  <button
                    onClick={() => setCloneProtocol('ssh')}
                    className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                      cloneProtocol === 'ssh' ? 'bg-hub-subtle text-hub-text font-bold shadow-sm' : 'text-hub-muted hover:text-hub-text'
                    }`}
                  >
                    SSH
                  </button>
                  <button
                    onClick={() => setCloneProtocol('local')}
                    className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                      cloneProtocol === 'local' ? 'bg-hub-subtle text-hub-text font-bold shadow-sm' : 'text-hub-muted hover:text-hub-text'
                    }`}
                  >
                    Local
                  </button>
                  <button
                    onClick={() => setCloneProtocol('cli')}
                    className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                      cloneProtocol === 'cli' ? 'bg-hub-subtle text-hub-accent font-semibold shadow-sm' : 'text-hub-muted hover:text-hub-text'
                    }`}
                  >
                    sh CLI
                  </button>
                </div>

                {/* Command with copy */}
                <div className="flex items-center bg-hub-bg border border-hub-border rounded-md px-2 py-1.5 mb-3 font-mono text-[11px] text-hub-text">
                  <span className="truncate flex-1 select-all">{currentCommand}</span>
                  <button
                    onClick={() => copyToClipboard(currentCommand)}
                    className="ml-2 text-hub-muted hover:text-hub-link p-1"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-hub-success-text" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* VS Code and Editor integrations (§11.2) */}
                <div className="pt-2 border-t border-hub-border space-y-1 text-xs">
                  <button 
                    onClick={() => alert(`Launching VS Code with remote: vscode://sourcehub/${repo.name}`)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-hub-subtle text-hub-text transition-colors"
                  >
                    <span className="flex items-center space-x-2">
                      <span>Open with SourceHub VS Code</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted" />
                  </button>
                  <div className="text-[11px] text-hub-muted px-2.5">
                    Connects directly via your scoped Personal Access Token (PAT).
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
