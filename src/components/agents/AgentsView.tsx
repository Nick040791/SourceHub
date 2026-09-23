import React, { useState, useEffect } from 'react';
import { 
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
import { MarkdownContent } from '../common/MarkdownDocView';
import { HelperAvatar } from './HelperAvatar';

interface AgentsViewProps {
  repoName: string;
  branches?: string[];
  defaultBranch?: string;
  onNavigateToPR: (prId: number) => void;
  onNavigateToActionsRun: (runId: string) => void;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  repoName,
  branches = ['main'],
  defaultBranch = 'main',
  onNavigateToPR,
  onNavigateToActionsRun,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  
  // Available models & provider info
  const [availableModels, setAvailableModels] = useState<string[]>(['glm-5.3-flash:cloud']);
  const [activeProviderName, setActiveProviderName] = useState<string>('Ollama');
  const [activeThinkingEffort, setActiveThinkingEffort] = useState<string>('none');
  
  // New task form state
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [baseBranch, setBaseBranch] = useState(defaultBranch);
  const [mode, setMode] = useState<'open_pr' | 'branch_only'>('open_pr');
  const [model, setModel] = useState('glm-5.3-flash:cloud');
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

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

  // Load available models from active provider
  const loadModels = async () => {
    try {
      const aiSettings = await api.fetchAISettings().catch(() => null);
      if (aiSettings) {
        const pid = aiSettings.activeProvider || 'ollama';
        const activeCfg = aiSettings.providers?.[pid];
        if (activeCfg) {
          setActiveProviderName(activeCfg.name || pid);
          setActiveThinkingEffort(activeCfg.thinkingEffort || 'none');
          if (activeCfg.availableModels && activeCfg.availableModels.length > 0) {
            setAvailableModels(activeCfg.availableModels);
          }
          if (activeCfg.defaultModel) {
            setModel(activeCfg.defaultModel);
          }
        }
      } else {
        const modelsData = await api.fetchOllamaModels().catch(() => ({ models: ['glm-5.3-flash:cloud'], defaultModel: 'glm-5.3-flash:cloud' }));
        if (modelsData.models?.length) setAvailableModels(modelsData.models);
        if (modelsData.defaultModel) setModel(modelsData.defaultModel);
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
    { key: 'preparing_workspace', label: 'Preparing' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'pushing', label: 'Pushing' },
    { key: 'checks_pending', label: 'CI Checks' },
    { key: 'ready_for_review', label: 'Ready' },
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
    <div className="space-y-5">
      {/* Helper hero — quieter chrome, lime CTA emphasis */}
      <div className="bg-hub-surface border border-hub-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <HelperAvatar size="md" className="w-5 h-5 text-hub-accent" />
              <h2 className="text-base font-semibold text-hub-text tracking-tight">
                Helper
              </h2>
              <span className="text-hub-muted text-xs font-medium">Async repository agent</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide text-hub-muted bg-hub-bg border border-hub-border/80">
                {activeProviderName}
              </span>
              {activeThinkingEffort && activeThinkingEffort !== 'none' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide text-hub-muted bg-hub-bg border border-hub-border/80">
                  Think: {activeThinkingEffort}
                </span>
              )}
            </div>
            <p className="text-xs text-hub-muted max-w-2xl leading-relaxed">
              Prompt a coding task. Helper uses {activeProviderName}, works on an isolated branch, commits with audit trailers, and stops at review.
            </p>
          </div>

          <button
            onClick={loadRuns}
            disabled={isLoadingRuns}
            className="self-start p-1.5 text-hub-muted hover:text-hub-text bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded-lg transition-colors"
            title="Refresh agent runs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingRuns ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <form onSubmit={handleLaunchTask} className="mt-4 pt-4 border-t border-hub-border/40 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should Helper analyze, build, or refactor?"
            rows={2}
            className="w-full bg-hub-bg border border-hub-border rounded-xl p-3 text-xs text-hub-text placeholder-hub-muted focus:outline-none focus:border-hub-accent/50 transition-colors resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-hub-bg border border-hub-border rounded-lg px-2 py-1.5">
                <GitBranch className="w-3.5 h-3.5 text-hub-muted" />
                <span className="text-hub-muted">Base</span>
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

              <div className="flex items-center bg-hub-bg border border-hub-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('open_pr')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    mode === 'open_pr'
                      ? 'bg-hub-subtle text-hub-text'
                      : 'text-hub-muted hover:text-hub-text'
                  }`}
                >
                  Open PR
                </button>
                <button
                  type="button"
                  onClick={() => setMode('branch_only')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    mode === 'branch_only'
                      ? 'bg-hub-subtle text-hub-text'
                      : 'text-hub-muted hover:text-hub-text'
                  }`}
                >
                  Branch only
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-hub-bg border border-hub-border rounded-lg px-2 py-1.5 font-mono text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-hub-muted" />
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-transparent text-hub-text focus:outline-none cursor-pointer max-w-[180px]"
                >
                  {availableModels.map(m => (
                    <option key={m} value={m} className="bg-hub-surface">
                      {m}{m === 'glm-5.3-flash:cloud' ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLaunching || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Launching…</span>
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

      {runs.length === 0 ? (
        <div className="border border-hub-border border-dashed rounded-xl p-10 text-center space-y-2.5 bg-hub-bg/30">
          <HelperAvatar size="lg" className="w-8 h-8 text-hub-accent/80 mx-auto" />
          <h3 className="font-semibold text-hub-text text-sm">No Helper tasks yet</h3>
          <p className="text-xs text-hub-muted max-w-md mx-auto leading-relaxed">
            Enter a prompt above to launch your first session against{' '}
            <code className="text-hub-text/80 font-mono text-[11px]">{model}</code>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Runs list */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold text-hub-muted uppercase tracking-wider">
                Runs
              </span>
              <span className="text-[11px] text-hub-muted font-mono">{runs.length}</span>
            </div>

            <div className="border border-hub-border rounded-xl bg-hub-surface overflow-hidden divide-y divide-hub-border/50">
              {runs.map((run) => {
                const isSelected = selectedRun?.id === run.id;
                const isRunning = run.state !== 'ready_for_review' && run.state !== 'failed';
                const isReady = run.state === 'ready_for_review';
                const isFailed = run.state === 'failed';

                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`p-3 cursor-pointer transition-colors text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-hub-subtle/90 ring-1 ring-inset ring-hub-accent/35'
                        : 'hover:bg-hub-subtle/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-hub-text flex items-center gap-1.5 min-w-0">
                        <HelperAvatar
                          size="sm"
                          className={`w-3.5 h-3.5 ${isRunning ? 'text-hub-accent animate-pulse' : 'text-hub-accent/70'}`}
                        />
                        <span className="truncate font-mono text-[11px]">{run.id}</span>
                      </span>

                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${
                        isReady
                          ? 'bg-hub-success/15 text-hub-success-text border border-hub-success/30'
                          : isFailed
                          ? 'bg-hub-danger/15 text-hub-danger-text border border-hub-danger/30'
                          : isRunning
                          ? 'bg-hub-accent/12 text-hub-accent border border-hub-accent/30'
                          : 'bg-hub-bg text-hub-muted border border-hub-border'
                      }`}>
                        {run.state.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-hub-text/90 font-medium line-clamp-2 text-xs leading-snug">
                      {run.prompt}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-hub-muted font-mono pt-0.5">
                      <span className="flex items-center gap-1 min-w-0">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[120px]">{run.targetBranch}</span>
                      </span>
                      <span className="shrink-0">{run.createdAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected run detail */}
          {selectedRun && (
            <div className="lg:col-span-8 space-y-3">
              <div className="border border-hub-border rounded-xl bg-hub-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-hub-border/50 pb-3.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <HelperAvatar size="sm" className="w-4 h-4 text-hub-accent" />
                      <h3 className="font-semibold text-sm text-hub-text tracking-tight truncate">
                        {selectedRun.slug}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-hub-muted bg-hub-bg border border-hub-border">
                        {selectedRun.model}
                      </span>
                    </div>
                    <div className="text-xs text-hub-muted">
                      On behalf of <span className="text-hub-text/80">{selectedRun.operator}</span>
                      {' · '}Base <code className="text-hub-text/80">{selectedRun.baseBranch}</code>
                    </div>
                  </div>

                  {selectedRun.prId && (
                    <button
                      onClick={() => onNavigateToPR(selectedRun.prId!)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded-lg text-xs font-semibold text-hub-link transition-colors shrink-0"
                    >
                      <GitPullRequest className="w-3.5 h-3.5 text-hub-success-text" />
                      <span>PR #{selectedRun.prId}</span>
                    </button>
                  )}
                </div>

                <div className="bg-hub-bg border border-hub-border/70 rounded-xl p-3.5 text-xs space-y-1">
                  <span className="text-[10px] font-semibold text-hub-muted uppercase tracking-wider block">
                    Instruction
                  </span>
                  <p className="font-sans leading-relaxed text-hub-text">
                    {selectedRun.prompt}
                  </p>
                </div>

                {/* Pipeline — purple reserved for Helper mark; progress uses accent/success */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-hub-text">
                      <Layers className="w-3.5 h-3.5 text-hub-muted" />
                      <span>Pipeline</span>
                    </span>
                    <span className="font-mono text-hub-muted text-[11px]">
                      {selectedRun.state.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                    {stateSteps.map((step) => {
                      const status = getStepStatus(step.key, selectedRun.state);
                      return (
                        <div
                          key={step.key}
                          className={`p-2 rounded-lg border text-center text-[10px] font-medium transition-all ${
                            status === 'completed'
                              ? 'bg-hub-success/10 border-hub-success/30 text-hub-success-text'
                              : status === 'current'
                              ? 'bg-hub-accent/12 border-hub-accent/50 text-hub-accent'
                              : 'bg-hub-bg border-hub-border text-hub-muted opacity-50'
                          }`}
                        >
                          <div className="flex justify-center mb-0.5">
                            {status === 'completed' ? (
                              <Check className="w-3 h-3 text-hub-success-text" />
                            ) : status === 'current' ? (
                              <Loader2 className="w-3 h-3 text-hub-accent animate-spin" />
                            ) : (
                              <Clock className="w-3 h-3 text-hub-muted" />
                            )}
                          </div>
                          <div className="truncate">{step.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedRun.filesTouched && selectedRun.filesTouched.length > 0 && (
                  <div className="bg-hub-bg border border-hub-border/70 rounded-xl p-3 text-xs space-y-2">
                    <span className="text-[10px] font-semibold text-hub-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-hub-muted" />
                      <span>Files ({selectedRun.filesTouched.length})</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedRun.filesTouched.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded-md bg-hub-surface border border-hub-border/60 font-mono text-[11px] text-hub-text">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-semibold text-hub-muted uppercase tracking-wider block">
                    Timeline ({selectedRun.timeline.length})
                  </span>

                  <div className="space-y-2 pl-3 border-l border-hub-border ml-1.5">
                    {selectedRun.timeline.map((event) => (
                      <div key={event.id} className="bg-hub-bg border border-hub-border/70 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-hub-text min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-hub-accent shrink-0" />
                            <span className="truncate">{event.title}</span>
                          </div>
                          <span className="text-[10px] text-hub-muted font-mono shrink-0">{event.timestamp}</span>
                        </div>

                        <div className="text-hub-muted text-[11px] leading-relaxed">
                          <MarkdownContent content={event.description} />
                        </div>

                        {event.metadata?.commitSha && (
                          <div className="pt-0.5 text-[10px] font-mono text-hub-link">
                            Commit: {event.metadata.commitSha} · SourceHub-Agent-Run: {selectedRun.slug}
                          </div>
                        )}
                        {event.metadata?.prId && (
                          <div className="pt-0.5 text-[10px] font-mono text-hub-success-text">
                            Pull Request #{event.metadata.prId}
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
