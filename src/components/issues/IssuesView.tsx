import React, { useState, useEffect } from 'react';
import { 
  CircleDot, 
  CheckCircle2, 
  Bot, 
  Plus, 
  MessageSquare, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { api } from '../../services/api';

interface IssuesViewProps {
  repoName: string;
  onAssignToAgent: (issue: { id: number; title: string; body?: string }) => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({ repoName, onAssignToAgent }) => {
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [filter, setFilter] = useState<'open' | 'closed'>('open');

  const loadIssues = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchIssues(repoName);
      setIssues(data);
    } catch (err) {
      console.warn('Failed to load issues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [repoName]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api.createIssue(repoName, {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle('');
      setNewBody('');
      setShowNewIssue(false);
      loadIssues();
    } catch (err: any) {
      alert(`Error creating issue: ${err.message}`);
    }
  };

  const handleToggleStatus = async (issueId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await api.updateIssue(repoName, issueId, { status: newStatus });
      loadIssues();
    } catch (err: any) {
      alert(`Error updating issue: ${err.message}`);
    }
  };

  const handleAssignAgent = async (issue: any) => {
    try {
      await api.updateIssue(repoName, issue.id, { assignedToAgent: true });
      loadIssues();
      onAssignToAgent({ id: issue.id, title: issue.title, body: issue.body });
    } catch (err: any) {
      alert(`Error assigning agent: ${err.message}`);
    }
  };

  const openIssues = issues.filter(i => i.status === 'open');
  const closedIssues = issues.filter(i => i.status !== 'open');
  const filteredIssues = filter === 'open' ? openIssues : closedIssues;

  return (
    <div className="space-y-4">
      {/* Top Banner explaining MVP-lite status per §6.4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hub-border gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('open')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === 'open' ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5 text-hub-success-text" />
            <span>{openIssues.length} Open</span>
          </button>

          <button
            onClick={() => setFilter('closed')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === 'closed' ? 'bg-hub-subtle text-hub-text border-hub-border font-bold' : 'text-hub-muted border-transparent hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-hub-purple-text" />
            <span>{closedIssues.length} Closed</span>
          </button>
        </div>

        <button
          onClick={() => setShowNewIssue(!showNewIssue)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg text-xs font-bold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Issue</span>
        </button>
      </div>

      {showNewIssue && (
        <form onSubmit={handleCreateIssue} className="border border-hub-border rounded-xl p-5 bg-hub-surface space-y-3 text-xs">
          <span className="font-bold text-hub-text block">Create Issue in {repoName}</span>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            className="w-full bg-hub-bg border border-hub-border rounded-lg px-3 py-1.5 text-hub-text focus:outline-none focus:border-hub-link"
          />
          <textarea
            placeholder="Leave a description for the operator or Helper..."
            rows={3}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="w-full bg-hub-bg border border-hub-border rounded-lg p-2 text-hub-text focus:outline-none focus:border-hub-link"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowNewIssue(false)}
              className="px-3 py-1 bg-hub-subtle text-hub-muted hover:text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-3 py-1 bg-hub-accent hover:brightness-110 disabled:opacity-50 text-zinc-950 rounded-lg font-bold"
            >
              Submit Issue
            </button>
          </div>
        </form>
      )}

      {/* Issues List */}
      {isLoading ? (
        <div className="p-8 flex items-center justify-center space-x-2 text-xs text-hub-muted">
          <Loader2 className="w-4 h-4 animate-spin text-hub-accent" />
          <span>Loading issues...</span>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="border border-dashed border-hub-border rounded-md p-8 text-center text-xs text-hub-muted space-y-2">
          <CircleDot className="w-6 h-6 mx-auto text-hub-muted" />
          <p>No {filter} issues in {repoName}.</p>
        </div>
      ) : (
        <div className="border border-hub-border rounded-xl bg-hub-surface divide-y divide-hub-border overflow-hidden">
          {filteredIssues.map((issue) => (
            <div key={issue.id} className="p-3.5 hover:bg-hub-subtle/50 transition-colors flex items-start justify-between text-xs gap-3">
              <div className="flex items-start space-x-2.5">
                <button
                  onClick={() => handleToggleStatus(issue.id, issue.status)}
                  title={issue.status === 'open' ? 'Click to close issue' : 'Click to reopen issue'}
                  className="mt-0.5"
                >
                  {issue.status === 'open' ? (
                    <CircleDot className="w-4 h-4 text-hub-success-text hover:text-hub-success-text" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-hub-purple-text hover:text-hub-purple-text" />
                  )}
                </button>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-hub-text">
                      {issue.title}
                    </span>
                    {issue.assignedToAgent && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-mono bg-hub-purple/15 text-hub-purple-text border border-hub-purple/35">
                        <Bot className="w-3 h-3 text-hub-purple-text" />
                        <span>Assigned to Helper</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-hub-muted">
                    #{issue.id} opened {issue.createdAt} by {issue.author}
                  </div>
                  {issue.body && (
                    <p className="text-hub-muted text-xs leading-relaxed line-clamp-2 pt-1">
                      {issue.body}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Action: Assign to Helper */}
              <div className="flex items-center space-x-2 shrink-0">
                {!issue.assignedToAgent && issue.status === 'open' && (
                  <button
                    onClick={() => handleAssignAgent(issue)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-hub-purple/15 hover:bg-hub-purple/25 border border-hub-purple/35 text-hub-purple-text text-[11px] font-medium transition-colors"
                    title="Kick off Helper Agent task for this issue"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Assign to Helper</span>
                  </button>
                )}

                {issue.comments > 0 && (
                  <div className="flex items-center space-x-1 text-hub-muted text-[11px] font-mono">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{issue.comments}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
