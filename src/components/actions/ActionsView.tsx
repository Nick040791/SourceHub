import React, { useState } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  RotateCw, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck,
  Send,
  GitBranch,
  Bot
} from 'lucide-react';
import { WorkflowRun, JobStep } from '../../types';

interface ActionsViewProps {
  workflowRuns: WorkflowRun[];
}

export const ActionsView: React.FC<ActionsViewProps> = ({ workflowRuns }) => {
  const [selectedRun, setSelectedRun] = useState<WorkflowRun>(workflowRuns[0]);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
  });
  const [isDispatching, setIsDispatching] = useState(false);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleDispatch = () => {
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      alert("Manual workflow dispatch event sent to container runner!");
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Workflows selector & Dispatch Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-hub-border gap-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-surface border border-hub-border rounded-md text-xs font-semibold text-hub-text">
            <PlayCircle className="w-4 h-4 text-hub-accent" />
            <span>CI Pipeline (.sourcehub/workflows/ci.yml)</span>
          </div>
          <span className="text-xs text-hub-muted font-mono">laptop-first runner</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDispatch}
            disabled={isDispatching}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-subtle hover:bg-hub-border border border-hub-border rounded-md text-xs font-medium text-hub-text transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-hub-muted" />
            <span>{isDispatching ? 'Dispatching...' : 'Run workflow'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Runs List */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-bold text-hub-muted uppercase tracking-wider px-1">
            Recent Workflow Runs
          </div>
          <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border overflow-hidden">
            {workflowRuns.map((run) => {
              const isSelected = selectedRun.id === run.id;
              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className={`p-3 cursor-pointer transition-colors text-xs space-y-1.5 ${
                    isSelected ? 'bg-hub-subtle border-l-2 border-l-hub-accent' : 'hover:bg-hub-subtle/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 font-bold text-hub-text">
                      <CheckCircle2 className="w-3.5 h-3.5 text-hub-success-text" />
                      <span>{run.id}</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-hub-bg text-hub-muted border border-hub-border uppercase">
                      {run.event}
                    </span>
                  </div>

                  <p className="text-hub-text line-clamp-1 font-medium">
                    {run.commitMessage}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-hub-muted font-mono">
                    <span className="flex items-center space-x-1">
                      <GitBranch className="w-3 h-3" />
                      <span className="truncate max-w-[130px]">{run.branch}</span>
                    </span>
                    <span>{run.duration}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Run Detail & Steps/Logs */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hub-border pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-hub-text">
                    {selectedRun.commitMessage}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-green-950 text-hub-success-text border border-green-800">
                    Passed
                  </span>
                </div>
                <div className="text-xs text-hub-muted mt-1">
                  Triggered by <strong>{selectedRun.author}</strong> via <code className="text-hub-link">{selectedRun.event}</code> event • Commit <code className="text-hub-text font-mono">{selectedRun.commitSha}</code>
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
            <div className="flex items-center justify-between text-xs bg-hub-bg border border-hub-border rounded-md px-3 py-2">
              <span className="flex items-center space-x-2 text-hub-muted">
                <ShieldCheck className="w-4 h-4 text-hub-success-text" />
                <span>Encrypted KMS secrets redacted • Ephemeral Docker container sandbox</span>
              </span>
              <span className="font-mono text-hub-text text-[11px]">Runner: local-laptop-01</span>
            </div>

            {/* Job Step Accordion */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-hub-text">Job: build-and-test</div>

              {selectedRun.steps.map((step, idx) => {
                const isExpanded = !!expandedSteps[idx];
                return (
                  <div key={idx} className="border border-hub-border rounded-md overflow-hidden bg-hub-bg">
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-hub-success-text" />
                        <span>{step.name}</span>
                      </div>
                      <span className="text-hub-muted font-mono text-[11px]">{step.duration}</span>
                    </button>

                    {isExpanded && (
                      <div className="p-3 bg-black/90 font-mono text-xs text-emerald-400 space-y-1 overflow-x-auto leading-relaxed border-t border-hub-border">
                        {step.logs.map((log, logIdx) => (
                          <div key={logIdx} className="whitespace-pre">
                            {log.includes('***') ? (
                              <span>
                                {log.split('***')[0]}
                                <span className="bg-yellow-500/20 text-yellow-300 px-1 rounded font-bold">*** [REDACTED SECRET] ***</span>
                                {log.split('***')[1]}
                              </span>
                            ) : (
                              log
                            )}
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
      </div>
    </div>
  );
};
