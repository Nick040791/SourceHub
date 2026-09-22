import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Play, 
  GitBranch, 
  GitPullRequest, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  AlertCircle, 
  ExternalLink, 
  Sparkles, 
  Cpu, 
  StopCircle, 
  RotateCcw,
  Check,
  Send,
  Loader2,
  FileCode,
  Layers,
  ArrowRight,
  RotateCw
} from 'lucide-react';
import { AgentRun, AgentRunState, AgentTimelineEvent } from '../../types';
import { api } from '../../services/api';

interface AgentsViewProps {
  repoName: string;
  branches?: string[];
  defaultBranch?: string;
  onNavigateToPR: (prId: number) => void;
  onNavigateToActionsRun: (runId: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  repoName,
  branches = ['main'],
  defaultBranch = 'main',
  onNavigateToPR,
}) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  
  // Available models from Ollama endpoint
  const [availableModels, setAvailableModels] = useState<string[]>(['glm-5.3-flash:cloud']);
  
  // New task form state
  const [prompt, setPrompt] = useState('');
  const [baseBranch, setBaseBranch] = useState(defaultBranch);
  const [mode, setMode] = useState<'open_pr' | 'branch_only'>('open_pr');
  const [model, setModel] = useState('glm-5.3-flash:cloud');
  const [isLaunching, setIsLaunching] = useState(false);

  // Load runs from SQLite
  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const data = await api.fetchAgentRuns(repoName);
      setRuns(data);
      if (data.length > 0) {
        setSelectedRunId(prev => (prev && data.some(r => r.id === prev) ? prev : data[0].id));
      } else {
        setSelectedRunId('');
      }
    } catch (err) {
      console.warn('Could not load agent runs:', err);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  // Load available models from Ollama endpoint
  const loadModels = async () => {
    try {
      const [modelsData, aiSettings] = await Promise.all([
        api.fetchOllamaModels().catch(() => ({ models: ['glm-5.3-flash:cloud'], defaultModel: 'glm-5.3-flash:cloud' })),
        api.fetchAISettings().catch(() => null),
      ]);
      if (modelsData.models && modelsData.models.length > 0) {
        setAvailableModels(modelsData.models);
      }
      if (aiSettings?.defaultModel) {
        setModel(aiSettings.defaultModel);
      } else if (modelsData.defaultModel) {
        setModel(modelsData.defaultModel);
      }
    } catch (e) {
      console.warn('Could not load models for agents view:', e);
    }
  };

  useEffect(() => {
    loadRuns();
    loadModels();
    setBaseBranch(defaultBranch);
  }, [repoName, defaultBranch]);

  // Polling while any run is in progress
  useEffect(() => {
    const hasActiveRun = runs.some(r => r.state !== 'ready_for_review' && r.state !== 'failed');
    if (!hasActiveRun) return;

    const interval = setInterval(() => {
      api.fetchAgentRuns(repoName).then(data => {
        setRuns(data);
      }).catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [runs, repoName]);

  const selectedRun = runs.find(r => r.id === selectedRunId) || runs[0];

  // Helper State Machine steps for visual progress tracker (§9.2)
  const stateSteps: { key: AgentRunState; label: string }[] = [
    { key: 'queued', label: 'Queued' },
    { key: 'preparing_workspace', label: 'Preparing Workspace' },
    { key: 'in_progress', label: 'In Progress (Ollama)' },
    { key: 'pushing', label: 'Pushing Commits' },
    { key: 'checks_pending', label: 'Actions CI Checks' },
    { key: 'ready_for_review', label: 'Ready for Review' },
  ];

  const getStepStatus = (stepKey: AgentRunState, currentRunState: AgentRunState) => {
    const order: AgentRunState[] = [
      'queued', 
      'preparing_workspace', 
      'in_progress', 
      'pushing', 
      'checks_pending', 
      'ready_for_review'
    ];
    const currentIndex = order.indexOf(currentRunState);
    const stepIndex = order.indexOf(stepKey);

    if (currentRunState === 'failed') return 'failed';
    if (stepIndex < currentIndex || currentRunState === 'ready_for_review') return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  // Launch real Agent task
  const handleLaunchTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const taskPrompt = prompt.trim();
    if (!taskPrompt) return;

    setIsLaunching(true);
    try {
      const newRun = await api.launchAgentTask(repoName, {
        prompt: taskPrompt,
        baseBranch,
        mode,
        model,
      });
      setRuns(prev => [newRun, ...prev.filter(r => r.id !== newRun.id)]);
      setSelectedRunId(newRun.id);
      setPrompt('');
    } catch (err: any) {
      alert(`Error launching Helper task: ${err.message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Helper Hero & North Star UX (§4 & §9) */}
      <div className="bg-gradient-to-r from-purple-950/40 via-hub-surface to-hub-surface border border-purple-900/40 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-md bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-hub-text">
                SourceHub Helper — Async Repository Agent
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-900/60 text-purple-300 border border-purple-700">
                Ollama Endpoint Active
              </span>
            </div>
            <p className="text-xs text-hub-muted max-w-3xl">
              Prompt an asynchronous coding task. Helper connects directly to the Ollama endpoint, creates an isolated branch on Nicholas's behalf, commits changes with audit trailers, and stops at the review gate.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadRuns}
              disabled={isLoadingRuns}
              className="p-1.5 text-hub-muted hover:text-hub-text bg-hub-surface border border-hub-border rounded-md"
              title="Refresh agent runs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingRuns ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Prompt Input Form (§9.1) */}
        <form onSubmit={handleLaunchTask} className="mt-4 pt-4 border-t border-hub-border/60 space-y-3">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should Helper analyze, build, or refactor? (e.g. 'Optimize repository branch diffing and add test coverage')"
              rows={2}
              className="w-full bg-hub-bg border border-hub-border rounded-lg p-3 text-xs text-hub-text placeholder-hub-muted focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Target base branch */}
              <div className="flex items-center space-x-1.5 bg-hub-bg border border-hub-border rounded px-2.5 py-1">
                <GitBranch className="w-3.5 h-3.5 text-hub-muted" />
                <span className="text-hub-muted">Base:</span>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="bg-transparent text-hub-text font-mono text-xs focus:outline-none cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b} value={b} className="bg-hub-surface">{b}</option>
                  ))}
                </select>
              </div>

              {/* Mode toggle: Branch only vs Open PR (§3 A4 & §9.1) */}
              <div className="flex items-center space-x-1 bg-hub-bg border border-hub-border rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('open_pr')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    mode === 'open_pr'
                      ? 'bg-hub-subtle text-purple-300 font-semibold'
                      : 'text-hub-muted hover:text-white'
                  }`}
                >
                  Open PR (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('branch_only')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    mode === 'branch_only'
                      ? 'bg-hub-subtle text-purple-300 font-semibold'
                      : 'text-hub-muted hover:text-white'
                  }`}
                >
                  Branch only
                </button>
              </div>

              {/* Model / Runtime Selector populated from Ollama endpoint */}
              <div className="flex items-center space-x-1.5 bg-hub-bg border border-hub-border rounded px-2.5 py-1 font-mono text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-hub-muted">Model:</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-transparent text-hub-text focus:outline-none cursor-pointer"
                >
                  {availableModels.map(m => (
                    <option key={m} value={m} className="bg-hub-surface">
                      {m} {m === 'glm-5.3-flash:cloud' ? '★ (Cloud)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLaunching || !prompt.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Launching Agent...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Launch Helper Task</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Main Agent Runs Grid: List on Left, Active Run Inspection on Right */}
      {runs.length === 0 ? (
        <div className="border border-hub-border border-dashed rounded-md p-10 text-center space-y-3 bg-hub-surface/40">
          <Bot className="w-8 h-8 text-purple-400 mx-auto" />
          <h3 className="font-bold text-hub-text text-sm">No Helper agent tasks yet</h3>
          <p className="text-xs text-hub-muted max-w-md mx-auto">
            Helper runs locally or against cloud Ollama models (<code className="text-purple-300">glm-5.3-flash:cloud</code>). Enter a task prompt above to launch your first session.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Runs List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-hub-muted uppercase tracking-wider">
                Agent Runs ({runs.length})
              </span>
              <span className="text-[11px] text-hub-muted font-mono">{runs.length} sessions</span>
            </div>

            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border overflow-hidden">
              {runs.map((run) => {
                const isSelected = selectedRun?.id === run.id;
                const isRunning = run.state !== 'ready_for_review' && run.state !== 'failed';

                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-2 ${
                      isSelected ? 'bg-hub-subtle border-l-2 border-l-purple-500' : 'hover:bg-hub-subtle/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-hub-text flex items-center space-x-1.5">
                        <Bot className={`w-3.5 h-3.5 ${isRunning ? 'text-hub-accent animate-pulse' : 'text-purple-400'}`} />
                        <span>{run.id}</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                        run.state === 'ready_for_review'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : run.state === 'in_progress' || run.state === 'pushing' || run.state === 'checks_pending'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-hub-bg text-hub-muted border border-hub-border'
                      }`}>
                        {run.state.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-hub-text font-medium line-clamp-2 text-xs">
                      {run.prompt}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-hub-muted font-mono pt-1">
                      <span className="flex items-center space-x-1">
                        <GitBranch className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{run.targetBranch}</span>
                      </span>
                      <span>{run.createdAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Run Inspection */}
          {selectedRun && (
            <div className="lg:col-span-8 space-y-4">
              <div className="border border-hub-border rounded-md bg-hub-surface p-5 space-y-4">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hub-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-hub-text">
                        {selectedRun.slug}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800">
                        {selectedRun.model}
                      </span>
                    </div>
                    <div className="text-xs text-hub-muted">
                      Started on behalf of <strong>{selectedRun.operator}</strong> • Base: <code className="text-hub-text">{selectedRun.baseBranch}</code>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {selectedRun.prId && (
                      <button
                        onClick={() => onNavigateToPR(selectedRun.prId!)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-subtle hover:bg-hub-border border border-hub-border rounded-md text-xs font-semibold text-hub-link transition-colors"
                      >
                        <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text" />
                        <span>View PR #{selectedRun.prId}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt Card */}
                <div className="bg-hub-bg border border-hub-border rounded-md p-3.5 text-xs text-hub-text space-y-1">
                  <span className="text-[11px] font-bold text-hub-muted uppercase tracking-wider block">
                    User Instruction
                  </span>
                  <p className="font-sans leading-relaxed text-hub-text">
                    "{selectedRun.prompt}"
                  </p>
                </div>

                {/* Visual State Machine Progress Bar (§9.2) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-hub-text">
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>State Machine Pipeline (§9.2)</span>
                    </span>
                    <span className="font-mono text-purple-300 text-[11px]">
                      State: {selectedRun.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {stateSteps.map((step) => {
                      const status = getStepStatus(step.key, selectedRun.state);
                      return (
                        <div
                          key={step.key}
                          className={`p-2 rounded border text-center text-[11px] font-medium transition-all ${
                            status === 'completed'
                              ? 'bg-purple-950/40 border-purple-800 text-purple-300'
                              : status === 'current'
                              ? 'bg-hub-accent/20 border-hub-accent text-white shadow-sm shadow-blue-500/20 animate-pulse'
                              : 'bg-hub-bg border-hub-border text-hub-muted opacity-60'
                          }`}
                        >
                          <div className="flex justify-center mb-1">
                            {status === 'completed' ? (
                              <Check className="w-3.5 h-3.5 text-purple-400" />
                            ) : status === 'current' ? (
                              <Loader2 className="w-3.5 h-3.5 text-hub-accent animate-spin" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-hub-muted" />
                            )}
                          </div>
                          <div className="truncate">{step.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Run Timeline Events (§9.2) */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-hub-text block">
                    Run Timeline Events ({selectedRun.timeline.length})
                  </span>

                  <div className="space-y-2 pl-4 border-l-2 border-purple-900/80 ml-2">
                    {selectedRun.timeline.map((event) => (
                      <div key={event.id} className="bg-hub-bg border border-hub-border rounded-md p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 font-bold text-hub-text">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            <span>{event.title}</span>
                          </div>
                          <span className="text-[11px] text-hub-muted font-mono">{event.timestamp}</span>
                        </div>

                        <p className="text-hub-muted text-[11px] leading-relaxed">
                          {event.description}
                        </p>

                        {event.metadata?.commitSha && (
                          <div className="pt-1 text-[11px] font-mono text-hub-link">
                            Commit: {event.metadata.commitSha} (Trailer: SourceHub-Agent-Run: {selectedRun.slug})
                          </div>
                        )}
                        {event.metadata?.prId && (
                          <div className="pt-1 text-[11px] font-mono text-hub-success-text">
                            Pull Request: #{event.metadata.prId}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
