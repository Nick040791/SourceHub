import React, { useState, useEffect } from 'react';
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
  FileCheck,
  Plus,
  ArrowLeft,
  Loader2,
  FolderGit2
} from 'lucide-react';
import { Repository, FileItem, Commit } from '../../types';
import { api } from '../../services/api';
import { MarkdownDocView } from '../common/MarkdownDocView';

interface CodeBrowserProps {
  repo: Repository;
  onNavigateToAgentRun?: (runId: string) => void;
}

export const CodeBrowser: React.FC<CodeBrowserProps> = ({
  repo,
  onNavigateToAgentRun,
}) => {
  const [selectedBranch, setSelectedBranch] = useState(repo.defaultBranch || 'main');
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [activeFile, setActiveFile] = useState<{ path: string; name: string; content: string; size?: string } | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw' | 'blame'>('preview');

  // Branch creation modal state
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // History view modal toggle
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Sync selected branch when repo changes
  useEffect(() => {
    setSelectedBranch(repo.defaultBranch || repo.branches[0] || 'main');
    setCurrentPath('');
    setActiveFile(null);
  }, [repo.name, repo.defaultBranch]);

  // Fetch file tree and commits when repo, branch, or subpath changes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoadingTree(true);
      try {
        const [treeData, commitData] = await Promise.all([
          api.fetchTree(repo.name, selectedBranch, currentPath),
          api.fetchCommits(repo.name, selectedBranch, 20).catch(() => []),
        ]);
        if (isMounted) {
          setFiles(treeData);
          setCommits(commitData);
        }
      } catch (err) {
        console.error('Failed to load git data:', err);
      } finally {
        if (isMounted) setIsLoadingTree(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [repo.name, selectedBranch, currentPath]);

  // Handle clicking a file or directory
  const handleItemClick = async (item: FileItem) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path);
      setActiveFile(null);
    } else {
      setIsLoadingFile(true);
      try {
        const content = await api.fetchBlob(repo.name, selectedBranch, item.path);
        setActiveFile({
          path: item.path,
          name: item.name,
          content,
          size: item.size,
        });
      } catch (err) {
        console.error('Failed to load blob:', err);
      } finally {
        setIsLoadingFile(false);
      }
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await api.createBranch(repo.name, newBranchName.trim(), selectedBranch);
      setSelectedBranch(newBranchName.trim());
      repo.branches.push(newBranchName.trim());
      setNewBranchName('');
      setShowNewBranchModal(false);
    } catch (err: any) {
      alert(`Error creating branch: ${err.message}`);
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      setCurrentPath(pathParts.slice(0, index + 1).join('/'));
    }
    setActiveFile(null);
  };

  const latestCommit = commits[0] || repo.lastCommit;

  // Find README if in root directory
  const readmeFile = files.find(f => f.name.toLowerCase() === 'readme.md');

  return (
    <div className="space-y-4">
      {/* Branch selector & repo toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Branch dropdown */}
          <div className="relative inline-flex items-center bg-hub-surface border border-hub-border rounded-md px-3 py-1.5 text-xs font-medium text-hub-text hover:bg-hub-subtle cursor-pointer">
            <GitBranch className="w-3.5 h-3.5 mr-1.5 text-hub-muted" />
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setActiveFile(null);
              }}
              className="bg-transparent border-none text-hub-text text-xs focus:outline-none cursor-pointer pr-2 font-mono"
            >
              {repo.branches.map((b) => (
                <option key={b} value={b} className="bg-hub-surface text-hub-text">
                  {b} {b.startsWith('agent/') ? '🤖 (Helper)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* New branch button */}
          <button
            onClick={() => setShowNewBranchModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-hub-surface hover:bg-hub-subtle border border-hub-border rounded-md text-xs text-hub-text transition-colors"
            title="Create new branch"
          >
            <Plus className="w-3 h-3 text-hub-muted" />
            <span>New branch</span>
          </button>

          <div className="text-xs text-hub-muted hidden sm:flex items-center space-x-2">
            <span>{repo.branches.length} branches</span>
            <span>•</span>
            <span>{repo.tags.length} tags</span>
          </div>
        </div>

        {/* History button */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-surface hover:bg-hub-subtle border border-hub-border rounded-md text-hub-text transition-colors"
          >
            <History className="w-3.5 h-3.5 text-hub-muted" />
            <span>{commits.length} Commits</span>
          </button>
        </div>
      </div>

      {/* Directory Breadcrumbs Bar if navigated deep */}
      {currentPath && (
        <div className="flex items-center space-x-1.5 text-xs font-mono bg-hub-subtle px-3 py-2 rounded-md border border-hub-border">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-hub-link hover:underline font-bold"
          >
            {repo.name}
          </button>
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span className="text-hub-muted">/</span>
              {idx === pathParts.length - 1 && !activeFile ? (
                <span className="text-hub-text font-bold">{part}</span>
              ) : (
                <button
                  onClick={() => navigateToBreadcrumb(idx)}
                  className="text-hub-link hover:underline"
                >
                  {part}
                </button>
              )}
            </React.Fragment>
          ))}
          {activeFile && (
            <>
              <span className="text-hub-muted">/</span>
              <span className="text-hub-text font-bold">{activeFile.name}</span>
            </>
          )}
        </div>
      )}

      {/* Latest commit banner */}
      {latestCommit && (
        <div className="bg-hub-surface border border-hub-border rounded-t-md px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
              {latestCommit.author ? latestCommit.author.substring(0, 2).toUpperCase() : 'NB'}
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
                <span>{latestCommit.trailer.replace('SourceHub-Agent-Run: ', '')}</span>
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
      )}

      {/* File Explorer Table */}
      <div className="border border-hub-border border-t-0 rounded-b-md overflow-hidden bg-hub-bg">
        {isLoadingTree ? (
          <div className="p-8 flex items-center justify-center text-xs text-hub-muted space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
            <span>Reading Git tree...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-xs text-hub-muted">
            This directory or repository is empty.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <tbody>
              {currentPath && (
                <tr
                  onClick={() => navigateToBreadcrumb(pathParts.length - 2)}
                  className="border-b border-hub-border/60 hover:bg-hub-surface/60 transition-colors cursor-pointer"
                >
                  <td colSpan={3} className="py-2 px-4 text-hub-link font-medium flex items-center space-x-2">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>.. (Up one level)</span>
                  </td>
                </tr>
              )}
              {files.map((file) => {
                const isSelected = activeFile?.path === file.path;
                return (
                  <tr
                    key={file.path}
                    onClick={() => handleItemClick(file)}
                    className={`border-b border-hub-border/60 hover:bg-hub-surface/60 transition-colors cursor-pointer ${
                      isSelected ? 'bg-hub-surface/80' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 w-72 text-hub-text font-medium flex items-center space-x-2">
                      {file.type === 'dir' ? (
                        <Folder className="w-4 h-4 text-hub-link fill-hub-link/20 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-hub-muted shrink-0" />
                      )}
                      <span className="hover:text-hub-link hover:underline truncate">
                        {file.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-hub-muted truncate max-w-md">
                      {file.lastCommitMessage}
                    </td>
                    <td className="py-2.5 px-4 text-right text-hub-muted whitespace-nowrap font-mono text-[11px]">
                      {file.size ? <span className="mr-3 text-hub-muted/70">{file.size}</span> : null}
                      {file.lastCommitDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Active File Content Viewer */}
      {activeFile && (
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
                  className={`px-2.5 py-1 ${viewMode === 'preview' ? 'bg-hub-border text-hub-text font-bold' : 'text-hub-muted hover:text-white'}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 ${viewMode === 'raw' ? 'bg-hub-border text-hub-text font-bold' : 'text-hub-muted hover:text-white'}`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setViewMode('blame')}
                  className={`px-2.5 py-1 ${viewMode === 'blame' ? 'bg-hub-border text-hub-text font-bold' : 'text-hub-muted hover:text-white'}`}
                >
                  Blame
                </button>
              </div>

              <button
                onClick={() => handleCopy(activeFile.content)}
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

          {isLoadingFile ? (
            <div className="p-12 flex items-center justify-center space-x-2 text-hub-muted">
              <Loader2 className="w-5 h-5 animate-spin text-hub-accent" />
              <span>Reading Git blob...</span>
            </div>
          ) : viewMode === 'raw' ? (
            <div className="p-4 bg-hub-bg overflow-x-auto font-mono text-xs leading-relaxed text-hub-text">
              <pre className="text-hub-text">{activeFile.content}</pre>
            </div>
          ) : viewMode === 'blame' ? (
            <div className="p-4 bg-hub-bg overflow-x-auto font-mono text-xs leading-relaxed text-hub-text space-y-1">
              <div className="flex items-center space-x-4 border-b border-hub-border pb-1 mb-2 text-[11px] text-hub-text font-bold">
                <span className="w-16">Commit</span>
                <span className="w-24">Author</span>
                <span>Code</span>
              </div>
              {activeFile.content.split('\n').map((line, i) => (
                <div key={i} className="flex items-center space-x-4 hover:bg-hub-surface py-0.5">
                  <span className="w-16 text-hub-link">{latestCommit ? latestCommit.shortSha : 'git'}</span>
                  <span className="w-24 truncate text-hub-muted">{latestCommit ? latestCommit.author : 'Nick'}</span>
                  <span className="text-hub-text">{line}</span>
                </div>
              ))}
            </div>
          ) : (activeFile.name.endsWith('.md') || activeFile.name.endsWith('.markdown')) ? (
            <MarkdownDocView content={activeFile.content} filename={activeFile.name} />
          ) : (
            <div className="p-4 bg-hub-bg overflow-x-auto font-mono text-xs leading-relaxed text-hub-text space-y-0.5">
              {activeFile.content.split('\n').map((line, i) => (
                <div key={i} className="flex hover:bg-hub-surface/40">
                  <span className="w-10 select-none text-hub-muted/40 text-right pr-4 text-[11px]">
                    {i + 1}
                  </span>
                  <span className="text-hub-text whitespace-pre flex-1">{line || ' '}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Branch Modal */}
      {showNewBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl w-full max-w-sm p-4 space-y-3 text-xs">
            <h4 className="font-bold text-hub-text text-sm">Create Branch</h4>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-hub-muted text-[11px] mb-1">Branch Name</label>
                <input
                  type="text"
                  placeholder="feat/my-feature"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  autoFocus
                  className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-xs text-hub-text focus:outline-none focus:border-hub-link font-mono"
                />
              </div>
              <div className="text-[11px] text-hub-muted">
                Will branch from current HEAD of <code className="text-hub-text font-bold">{selectedBranch}</code>.
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBranchModal(false)}
                  className="px-3 py-1 bg-hub-subtle hover:bg-hub-border text-hub-muted rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded font-semibold"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-hub-surface border border-hub-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col text-xs">
            <div className="bg-hub-subtle px-4 py-3 border-b border-hub-border flex items-center justify-between">
              <span className="font-bold text-hub-text text-sm flex items-center space-x-2">
                <History className="w-4 h-4 text-hub-accent" />
                <span>Commits on {selectedBranch} ({commits.length})</span>
              </span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-hub-muted hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-hub-border p-2">
              {commits.map((c) => (
                <div key={c.sha} className="p-3 hover:bg-hub-subtle/50 transition-colors flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold text-hub-text">{c.message}</div>
                    <div className="text-[11px] text-hub-muted">
                      {c.author} committed {c.date}
                    </div>
                    {c.trailer && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded font-mono text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
                        <Bot className="w-3 h-3 text-purple-400" />
                        <span>{c.trailer}</span>
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-hub-link text-[11px] shrink-0">
                    {c.shortSha}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
