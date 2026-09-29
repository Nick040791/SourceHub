import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck, 
  Send, 
  GitBranch, 
  FileCode,
  Loader2,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { WorkflowRun } from '../../types';
import { api } from '../../services/api';

interface ActionsViewProps {
  repoName: string;
  workflowRuns?: WorkflowRun[];
}

export const ActionsView: React.FC<ActionsViewProps> = ({ repoName }) => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({ 0: true, 1: true });
  const [isDispatching, setIsDispatching] = useState(false);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  const loadWorkflows = async () => {
    setIsLoadingWorkflows(true);
    try {
      const wfs = await api.fetchWorkflows(repoName);
      setWorkflows(wfs);
      if (wfs.length > 0) setSelectedWorkflow(wfs[0]);
      else setSelectedWorkflow(null);
    } catch (e) {
      console.warn('Could not fetch workflows:', e);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const data = await api.fetchWorkflowRuns(repoName);
      setRuns(data);
      // Detail renders only after a run card is clicked (#7) — no auto-select
      setSelectedRun(prev => (prev && data.some(r => r.id === prev.id) ? prev : null));
    } catch (e) {
      console.warn('Could not fetch workflow runs:', e);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
    loadRuns();
  }, [repoName]);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const workflowId = selectedWorkflow ? selectedWorkflow.id : 'ci.yml';
      const newRun = await api.dispatchWorkflow(repoName, workflowId);
      setRuns(prev => [newRun, ...prev.filter(r => r.id !== newRun.id)]);
      setSelectedRun(newRun);
      setExpandedSteps({ 0: true, 1: true, 2: true });
    } catch (err: any) {
      alert(`Error dispatching workflow: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Workflows selector & Dispatch Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-hub-border gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {workflows.length > 0 ? (
            <div className="flex items-center space-x-1.5 bg-hub-surface border border-hub-border rounded-xl px-2.5 py-1 text-xs text-hub-text font-mono">
              <PlayCircle className="w-4 h-4 text-hub-accent" />
              <select
                value={selectedWorkflow?.id}
                onChange={(e) => {
                  const wf = workflows.find(w => w.id === e.target.value);
                  if (wf) setSelectedWorkflow(wf);
                }}
                className="bg-transparent text-hub-text font-bold text-xs focus:outline-none cursor-pointer"
              >
                {workflows.map(w => (
                  <option key={w.id} value={w.id} className="bg-hub-surface">{w.name} ({w.path})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-surface border border-hub-border rounded-xl text-xs font-semibold text-hub-text">
              <PlayCircle className="w-4 h-4 text-hub-accent" />
              <span>CI Pipeline (.sourcehub/workflows/ci.yml)</span>
            </div>
          )}
          <span className="text-xs text-hub-muted font-mono">laptop-first runner</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadRuns}
            disabled={isLoadingRuns}
            className="p-1.5 text-hub-muted hover:text-hub-text bg-hub-surface border border-hub-border rounded-xl"
            title="Refresh runs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingRuns ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDispatch}
            disabled={isDispatching}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{isDispatching ? 'Running Workflow...' : 'Run workflow'}</span>
          </button>
        </div>
      </div>

      {/* Real Workflow File Preview Card if available */}
      {selectedWorkflow && (
        <div className="border border-hub-border rounded-xl bg-hub-surface p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-hub-text flex items-center space-x-1.5">
              <FileCode className="w-3.5 h-3.5 text-hub-muted" />
              <span>{selectedWorkflow.path}</span>
            </span>
            <div className="flex items-center space-x-1">
              {selectedWorkflow.events.map((ev: string) => (
                <span key={ev} className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-hub-bg text-hub-accent border border-hub-border">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="border border-hub-border border-dashed rounded-lg p-10 text-center space-y-3 bg-hub-surface/40">
          <PlayCircle className="w-8 h-8 text-hub-muted mx-auto" />
          <h3 className="font-bold text-hub-text text-sm">No workflow runs yet</h3>
          <p className="text-xs text-hub-muted max-w-md mx-auto">
            Workflows defined in <code className="text-hub-accent">.sourcehub/workflows/</code> will execute live on your machine.
          </p>
          <button
            onClick={handleDispatch}
            disabled={isDispatching}
            className="px-4 py-2 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg font-bold text-xs inline-flex items-center space-x-1.5 transition-all"
          >
            {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Execute Workflow Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Runs List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-bold text-hub-muted uppercase tracking-wider px-1">
              Workflow Runs ({runs.length})
            </div>
            <div className="border border-hub-border rounded-xl bg-hub-surface divide-y divide-hub-border overflow-hidden">
              {runs.map((run) => {
                const isSelected = selectedRun?.id === run.id;
                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-1.5 ${
                      isSelected ? 'bg-hub-subtle border-l-2 border-l-hub-accent' : 'hover:bg-hub-subtle/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${
                        run.status === 'success'
                          ? 'bg-hub-success/15 text-hub-success-text border border-hub-success/30'
                          : run.status === 'failed'
                          ? 'bg-hub-danger/15 text-hub-danger-text border border-hub-danger/30'
                          : 'bg-hub-accent/12 text-hub-accent border border-hub-accent/30'
                      }`}>
                        {run.status === 'success' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : run.status === 'failed' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        <span>{run.status === 'success' ? 'Tests pass' : run.status === 'failed' ? 'Tests fail' : run.status === 'cancelled' ? 'Cancelled' : 'Running'}</span>
                      </span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] bg-hub-bg text-hub-muted border border-hub-border uppercase">
                        {run.event}
                      </span>
                    </div>

                    <p className="text-hub-text font-semibold line-clamp-1 leading-snug" title={run.commitMessage}>
                      {run.commitMessage}
                    </p>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-hub-muted font-mono">
                      <span className="flex items-center gap-1 min-w-0">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[130px]" title={run.branch}>{run.branch}</span>
                      </span>
                      <span className="shrink-0">{run.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: run detail — renders after a run card is clicked (#7) */}
          {selectedRun ? (
            <div className="lg:col-span-8 space-y-4">
              <div className="border border-hub-border rounded-xl bg-hub-surface p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hub-border pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-base text-hub-text">
                        {selectedRun.commitMessage}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                        selectedRun.status === 'success'
                          ? 'bg-hub-success/15 text-hub-success-text border-hub-success/40'
                          : selectedRun.status === 'failed'
                          ? 'bg-hub-danger/15 text-hub-danger-text border-hub-danger/40'
                          : 'bg-hub-warning/15 text-hub-warning-text border-hub-warning/40'
                      }`}>
                        {selectedRun.status === 'success' ? 'Passed' : selectedRun.status === 'failed' ? 'Failed' : 'Running'}
                      </span>
                    </div>
                    <div className="text-xs text-hub-muted mt-1">
                      Triggered by <strong>{selectedRun.author}</strong> via <code className="text-hub-link">{selectedRun.event}</code> event • Commit <code className="text-hub-text font-mono">{selectedRun.commitSha}</code> • Run <code className="text-hub-text font-mono">{selectedRun.id}</code>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-hub-muted font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{selectedRun.duration}</span>
                    </span>
                    <span>{selectedRun.createdAt}</span>
                  </div>
                </div>

                {/* Runner Environment Pill */}
                <div className="flex items-center justify-between text-xs bg-hub-bg border border-hub-border rounded-xl px-3 py-2">
                  <span className="flex items-center space-x-2 text-hub-muted">
                    <ShieldCheck className="w-4 h-4 text-hub-success-text" />
                    <span>Workflow executed on host runner • Isolated environment execution</span>
                  </span>
                  <span className="font-mono text-hub-text text-[11px]">Runner: local-host</span>
                </div>

                {/* Job Step Accordion */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-hub-text">Job Execution Steps ({selectedRun.steps.length})</div>

                  {selectedRun.steps.map((step, idx) => {
                    const isExpanded = !!expandedSteps[idx];
                    return (
                      <div key={idx} className="border border-hub-border rounded-xl overflow-hidden bg-hub-bg">
                        <button
                          onClick={() => toggleStep(idx)}
                          className="w-full px-3 py-2 bg-hub-subtle hover:bg-hub-border flex items-center justify-between text-xs font-medium text-hub-text transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-hub-muted" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-hub-muted" />
                            )}
                            {step.status === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-hub-success-text" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-hub-danger-text" />
                            )}
                            <span>{step.name}</span>
                          </div>
                          <span className="text-hub-muted font-mono text-[11px]">{step.duration}</span>
                        </button>

                        {isExpanded && (
                          <div className="p-3 bg-hub-bg font-mono text-xs text-hub-success-text space-y-1 overflow-x-auto leading-relaxed border-t border-hub-border max-h-80">
                            {step.logs.map((log, logIdx) => (
                              <div key={logIdx} className="whitespace-pre">
                                {log}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 border border-hub-border border-dashed rounded-xl bg-hub-surface/40 flex items-center justify-center p-10 text-center">
              <div className="space-y-1.5">
                <PlayCircle className="w-7 h-7 text-hub-muted/60 mx-auto" />
                <h3 className="text-sm font-semibold text-hub-text">Select a run</h3>
                <p className="text-xs text-hub-muted">
                  Click a run card to view full details — steps, logs, and runner info.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
