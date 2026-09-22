import React, { useState } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Folder, 
  FileText, 
  Bot, 
  Clock, 
  Check, 
  Copy, 
  FileCode, 
  History, 
  ChevronRight,
  BookOpen,
  Eye,
  FileCheck
} from 'lucide-react';
import { Repository, FileItem, Commit } from '../../types';

interface CodeBrowserProps {
  repo: Repository;
  files: FileItem[];
  latestCommit: Commit;
  onNavigateToAgentRun?: (runId: string) => void;
}

export const CodeBrowser: React.FC<CodeBrowserProps> = ({
  repo,
  files,
  latestCommit,
  onNavigateToAgentRun,
}) => {
  const [selectedBranch, setSelectedBranch] = useState(repo.defaultBranch);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw' | 'blame'>('preview');

  const defaultReadme = files.find(f => f.name === 'README.md');

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Branch selector & repo toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          {/* Branch dropdown */}
          <div className="relative inline-flex items-center bg-hub-surface border border-hub-border rounded-md px-3 py-1.5 text-xs font-medium text-hub-text hover:bg-hub-subtle cursor-pointer">
            <GitBranch className="w-3.5 h-3.5 mr-1.5 text-hub-muted" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent border-none text-hub-text text-xs focus:outline-none cursor-pointer pr-2 font-mono"
            >
              {repo.branches.map((b) => (
                <option key={b} value={b} className="bg-hub-surface text-hub-text">
                  {b} {b.startsWith('agent/') ? '🤖 (Helper)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-hub-muted hidden sm:flex items-center space-x-2">
            <span>{repo.branches.length} branches</span>
            <span>•</span>
            <span>{repo.tags.length} tags</span>
          </div>
        </div>

        {/* Git stats quick summary */}
        <div className="flex items-center space-x-2 text-xs">
          <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-surface hover:bg-hub-subtle border border-hub-border rounded-md text-hub-text transition-colors">
            <History className="w-3.5 h-3.5 text-hub-muted" />
            <span>3 Commits</span>
          </button>
        </div>
      </div>

      {/* Latest commit banner */}
      <div className="bg-hub-surface border border-hub-border rounded-t-md px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
            NB
          </div>
          <span className="font-semibold text-hub-text">{latestCommit.author}</span>
          <span className="text-hub-muted truncate max-w-md">{latestCommit.message}</span>

          {/* Agent trailer badge if present */}
          {latestCommit.trailer && (
            <span 
              onClick={() => onNavigateToAgentRun && latestCommit.agentRunId && onNavigateToAgentRun(latestCommit.agentRunId)}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-950/60 border border-purple-700/60 text-purple-300 cursor-pointer hover:bg-purple-900/80 transition-colors"
              title="Authored via SourceHub Helper"
            >
              <Bot className="w-3 h-3 text-purple-400" />
              <span>{latestCommit.trailer.split(': ')[1]}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-hub-muted font-mono text-[11px]">
          <span className="text-hub-link hover:underline cursor-pointer">
            {latestCommit.shortSha}
          </span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{latestCommit.date}</span>
          </span>
        </div>
      </div>

      {/* File Explorer Table */}
      <div className="border border-hub-border border-t-0 rounded-b-md overflow-hidden bg-hub-bg">
        <table className="w-full text-left text-xs border-collapse">
          <tbody>
            {files.map((file, idx) => {
              const isSelected = activeFile?.path === file.path;
              return (
                <tr
                  key={file.path}
                  onClick={() => file.type === 'file' ? setActiveFile(file) : null}
                  className={`border-b border-hub-border/60 hover:bg-hub-surface/60 transition-colors cursor-pointer ${
                    isSelected ? 'bg-hub-surface/80' : ''
                  }`}
                >
                  <td className="py-2.5 px-4 w-64 text-hub-text font-medium flex items-center space-x-2">
                    {file.type === 'dir' ? (
                      <Folder className="w-4 h-4 text-hub-link fill-hub-link/20" />
                    ) : (
                      <FileCode className="w-4 h-4 text-hub-muted" />
                    )}
                    <span className="hover:text-hub-link hover:underline">
                      {file.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-hub-muted truncate max-w-md">
                    {file.lastCommitMessage}
                  </td>
                  <td className="py-2.5 px-4 text-right text-hub-muted whitespace-nowrap">
                    {file.lastCommitDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Active File or README Viewer */}
      {activeFile ? (
        <div className="border border-hub-border rounded-md overflow-hidden bg-hub-surface mt-6">
          <div className="bg-hub-subtle px-4 py-2.5 border-b border-hub-border flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-hub-muted" />
              <span className="font-semibold text-hub-text font-mono">{activeFile.path}</span>
              {activeFile.size && (
                <span className="text-hub-muted font-mono text-[11px]">({activeFile.size})</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-hub-bg border border-hub-border rounded-md overflow-hidden text-[11px]">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2.5 py-1 ${viewMode === 'preview' ? 'bg-hub-border text-hub-text' : 'text-hub-muted hover:text-white'}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 ${viewMode === 'raw' ? 'bg-hub-border text-hub-text' : 'text-hub-muted hover:text-white'}`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setViewMode('blame')}
                  className={`px-2.5 py-1 ${viewMode === 'blame' ? 'bg-hub-border text-hub-text' : 'text-hub-muted hover:text-white'}`}
                >
                  Blame
                </button>
              </div>

              <button
                onClick={() => handleCopy(activeFile.content || '')}
                className="p-1.5 text-hub-muted hover:text-hub-text hover:bg-hub-border rounded"
                title="Copy file contents"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-hub-success-text" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setActiveFile(null)}
                className="text-hub-muted hover:text-white text-xs px-2"
                title="Close file preview"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="p-4 bg-hub-bg overflow-x-auto font-mono text-xs leading-relaxed text-hub-text">
            {viewMode === 'blame' ? (
              <div className="space-y-1 text-hub-muted">
                <div className="flex items-center space-x-4 border-b border-hub-border pb-1 mb-2 text-[11px] text-hub-text font-bold">
                  <span className="w-16">Commit</span>
                  <span className="w-24">Author</span>
                  <span className="w-20">Age</span>
                  <span>Code</span>
                </div>
                {(activeFile.content || '').split('\n').map((line, i) => (
                  <div key={i} className="flex items-center space-x-4 hover:bg-hub-surface py-0.5">
                    <span className="w-16 text-hub-link">{latestCommit.shortSha}</span>
                    <span className="w-24 truncate text-hub-muted">Nicholas (Helper)</span>
                    <span className="w-20 text-[11px] text-hub-muted">2h ago</span>
                    <span className="text-hub-text">{line}</span>
                  </div>
                ))}
              </div>
            ) : viewMode === 'raw' ? (
              <pre className="text-hub-text">{activeFile.content}</pre>
            ) : (
              <div className="space-y-1">
                {(activeFile.content || '').split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="w-8 select-none text-hub-muted/50 text-right pr-4 text-[11px]">
                      {i + 1}
                    </span>
                    <span className="text-hub-text whitespace-pre">{line || ' '}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : defaultReadme ? (
        /* Default README Viewer */
        <div className="border border-hub-border rounded-md overflow-hidden bg-hub-surface mt-6">
          <div className="bg-hub-subtle px-4 py-2.5 border-b border-hub-border flex items-center space-x-2 text-xs font-semibold text-hub-text">
            <BookOpen className="w-4 h-4 text-hub-muted" />
            <span>README.md</span>
          </div>

          <div className="p-6 bg-hub-surface text-hub-text text-sm leading-relaxed space-y-4">
            <h1 className="text-2xl font-bold border-b border-hub-border pb-2 text-hub-text">
              SourceHub 🛸
            </h1>
            <p className="text-hub-muted italic">
              Single-user, self-hosted git forge for solo + AI-assistant workflows.
            </p>
            <p>
              SourceHub replaces GitHub for solo operators who build with AI agents. It hosts git repositories with a clean, fast Web UI, Actions-class CI/CD, encrypted secrets, first-class deploy keys and scoped tokens, and an asynchronous <strong>Helper (Agents)</strong> system.
            </p>
            
            <div className="bg-hub-bg border border-hub-border rounded-md p-4 text-xs font-mono space-y-2">
              <div className="text-hub-muted font-bold"># Quick clone via SSH:</div>
              <div className="text-hub-text">git clone ssh://git@sourcehub.local:2222/{repo.owner}/{repo.name}.git</div>
              <div className="text-hub-muted font-bold mt-2"># Or kick off an async AI agent run:</div>
              <div className="text-hub-text">sh agent run "Implement JWT scope verification for /api/v1/repos and run tests"</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-hub-bg border border-hub-border rounded-md">
                <span className="font-bold text-hub-text block mb-1">🤖 Async Agents (Helper)</span>
                <span className="text-hub-muted">Prompt → working branch → containerized runner → pull request → operator review.</span>
              </div>
              <div className="p-3 bg-hub-bg border border-hub-border rounded-md">
                <span className="font-bold text-hub-text block mb-1">🔒 Write-Only Secrets</span>
                <span className="text-hub-muted">KMS envelope encryption for Actions and scoped agent allowlists.</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
