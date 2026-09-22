import React, { useState } from 'react';
import { 
  CircleDot, 
  CheckCircle2, 
  Bot, 
  Plus, 
  MessageSquare, 
  Tag, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface IssuesViewProps {
  onAssignToAgent: (title: string) => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({ onAssignToAgent }) => {
  const [issues, setIssues] = useState([
    {
      id: 21,
      title: 'Implement token scope verification middleware for /api/v1/repos',
      body: 'Endpoints must enforce repo:read, repo:write, or admin scopes as specified in §8.',
      status: 'open',
      author: 'Nicholas Beighley',
      createdAt: '3 hours ago',
      assignedToAgent: true,
      agentRunId: 'run-84f2',
      comments: 2,
    },
    {
      id: 20,
      title: 'Configure laptop-first Docker compose reverse proxy and KMS key mount',
      body: 'Mount encryption master key from /run/secrets/kms_master.key into container memory.',
      status: 'open',
      author: 'Nicholas Beighley',
      createdAt: 'yesterday',
      assignedToAgent: false,
      comments: 1,
    },
    {
      id: 19,
      title: 'Support Ollama qwen2.5-coder tool-calling in agent-worker container',
      body: 'Validate read_file, edit_file, and exec_cmd sandbox primitives.',
      status: 'closed',
      author: 'Nicholas Beighley',
      createdAt: '2 days ago',
      assignedToAgent: true,
      agentRunId: 'run-44a1',
      comments: 4,
    }
  ]);

  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newIssue = {
      id: issues.length + 20,
      title: newTitle,
      body: newBody,
      status: 'open',
      author: 'Nicholas Beighley',
      createdAt: 'Just now',
      assignedToAgent: false,
      comments: 0,
    };
    setIssues([newIssue, ...issues]);
    setNewTitle('');
    setNewBody('');
    setShowNewIssue(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner explaining MVP-lite status per §6.4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-hub-border gap-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-hub-text flex items-center space-x-1.5">
            <CircleDot className="w-4 h-4 text-hub-success-text" />
            <span>Issues (MVP-lite • §6.4)</span>
          </span>
          <span className="text-[11px] text-hub-muted">
            Used for "Assign issue to Helper Agent" GitHub parity
          </span>
        </div>

        <button
          onClick={() => setShowNewIssue(!showNewIssue)}
          className="px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
        >
          New Issue
        </button>
      </div>

      {showNewIssue && (
        <form onSubmit={handleCreateIssue} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-3 text-xs">
          <span className="font-bold text-hub-text block">Create Issue</span>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-hub-bg border border-hub-border rounded px-3 py-1.5 text-hub-text"
          />
          <textarea
            placeholder="Leave a description for Nicholas or Helper..."
            rows={3}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="w-full bg-hub-bg border border-hub-border rounded p-2 text-hub-text"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowNewIssue(false)}
              className="px-3 py-1 bg-hub-subtle text-hub-muted rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-hub-success text-white rounded font-semibold"
            >
              Submit Issue
            </button>
          </div>
        </form>
      )}

      {/* Issues List */}
      <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border overflow-hidden">
        {issues.map((issue) => (
          <div key={issue.id} className="p-3.5 hover:bg-hub-subtle/50 transition-colors flex items-start justify-between text-xs gap-3">
            <div className="flex items-start space-x-2.5">
              {issue.status === 'open' ? (
                <CircleDot className="w-4 h-4 text-hub-success-text mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="font-bold text-hub-text hover:text-hub-link cursor-pointer">
                    {issue.title}
                  </span>
                  {issue.assignedToAgent && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span>Assigned to Helper</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-hub-muted">
                  #{issue.id} opened {issue.createdAt} by {issue.author}
                </div>
              </div>
            </div>

            {/* Quick Action: Assign to Helper */}
            <div className="flex items-center space-x-2">
              {!issue.assignedToAgent && issue.status === 'open' && (
                <button
                  onClick={() => onAssignToAgent(issue.title)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-300 text-[11px] font-medium transition-colors"
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
    </div>
  );
};
