import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  BookOpen, 
  HelpCircle, 
  CheckCircle2, 
  Bot, 
  ShieldCheck, 
  Terminal, 
  ExternalLink,
  ChevronRight,
  Flame,
  Lightbulb,
  FileCode
} from 'lucide-react';
import { TabType } from '../../types';

interface BrainstormPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType) => void;
  activeTab: TabType;
}

export const BrainstormPanel: React.FC<BrainstormPanelProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  activeTab,
}) => {
  if (!isOpen) return null;

  const [activeTopic, setActiveTopic] = useState<string>('agents');

  const topics = [
    {
      id: 'brief',
      title: '§1 & §2 Brief & Goals',
      summary: 'Single-user, self-hosted git forge for solo + AI-assistant workflows. No GitHub dependency.',
      targetTab: 'code' as TabType,
      questions: [
        'How minimal can the single-operator auth layer be while maintaining token security?',
        'Does laptop-first Docker compose meet all local dev & testing requirements for phase 0?'
      ]
    },
    {
      id: 'agents',
      title: '§9 Helper / Agents UX',
      summary: 'Async coding agent (prompt → branch → CI checks → review). Not a distracting chat bot.',
      targetTab: 'agents' as TabType,
      questions: [
        'Is "Open PR" the right default mode, or should it default to "Branch only" for small refactors?',
        'How should the agent notify Nicholas when ready for review (desktop notification, webhook, or terminal ring)?',
        'Is the state machine (queued → preparing_workspace → in_progress → pushing → checks_pending → ready_for_review) complete?'
      ]
    },
    {
      id: 'pr',
      title: '§6.2 PR & Merge Gate',
      summary: 'Diff review, merge strategies (squash/merge/rebase), Actions status rollup, and review comments.',
      targetTab: 'pulls' as TabType,
      questions: [
        'How should "Have Agent address review comments" pass line comments back into the prompt context?',
        'Should squash and merge automatically format the commit message using the PR summary?'
      ]
    },
    {
      id: 'actions',
      title: '§6.3 Actions & CI Runner',
      summary: 'Containerized workflow execution (.sourcehub/workflows/*.yml) with encrypted secret injection.',
      targetTab: 'actions' as TabType,
      questions: [
        'Should we use Forgejo runner compatibility or a lightweight native container runner?',
        'How are stdout secrets masked reliably when arbitrary user code or agent scripts run?'
      ]
    },
    {
      id: 'secrets',
      title: '§7 Secrets & KMS',
      summary: 'Envelope encryption at rest, write-only UI, strict agent allowlist.',
      targetTab: 'settings' as TabType,
      questions: [
        'What should the default agent secrets policy be? (Never inject Actions secrets unless explicitly allowlisted in run config).',
        'Where is the master KMS key stored locally on Nicholas’s laptop?'
      ]
    },
    {
      id: 'tokens',
      title: '§8 Scoped PATs & CLI',
      summary: 'Fine-grained scopes (repo:read, pr:write, agents:run, admin) for sh CLI and VS Code.',
      targetTab: 'settings' as TabType,
      questions: [
        'What should `sh agent run` output in the terminal while the background task is running?',
        'What MCP tools should be exposed first to AI teammate bots (Design, Development, Deployment)?'
      ]
    }
  ];

  return (
    <aside className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-hub-surface border-l border-hub-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-hub-border flex items-center justify-between bg-hub-subtle">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="font-bold text-xs text-hub-text uppercase tracking-wider">
            Brainstorm & Spec Guide
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-hub-muted hover:text-hub-text p-1 rounded hover:bg-hub-border"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* SourceHub Plan Reference Banner */}
        <div className="bg-hub-bg border border-hub-border rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-hub-text flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-hub-link" />
              <span>SOURCEHUB_PLAN.md</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-hub-accent/15 text-hub-accent">
              10/10 Score
            </span>
          </div>
          <p className="text-[11px] text-hub-muted leading-relaxed">
            This UI scaffold models the architecture plan. Use these topic guides to explore design decisions and test workflows.
          </p>
        </div>

        {/* Brainstorm Topics Accordion / List */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-hub-muted uppercase tracking-wider">
            Architecture Sections
          </div>

          {topics.map((t) => {
            const isSelected = activeTopic === t.id;
            return (
              <div
                key={t.id}
                className={`border rounded-md overflow-hidden transition-all ${
                  isSelected
                    ? 'border-purple-600/60 bg-purple-950/20'
                    : 'border-hub-border bg-hub-bg hover:border-hub-muted/40'
                }`}
              >
                <div
                  onClick={() => setActiveTopic(t.id)}
                  className="p-3 cursor-pointer flex items-center justify-between"
                >
                  <div className="font-bold text-hub-text text-xs">{t.title}</div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-hub-muted transition-transform ${
                      isSelected ? 'rotate-90 text-purple-400' : ''
                    }`}
                  />
                </div>

                {isSelected && (
                  <div className="px-3 pb-3 pt-1 border-t border-hub-border/60 space-y-3">
                    <p className="text-[11px] text-hub-muted leading-relaxed">
                      {t.summary}
                    </p>

                    {/* Interactive Tab Switcher */}
                    <button
                      onClick={() => onNavigateTab(t.targetTab)}
                      className="w-full flex items-center justify-center space-x-1.5 py-1.5 bg-hub-subtle hover:bg-hub-border rounded text-[11px] font-semibold text-hub-text transition-colors border border-hub-border"
                    >
                      <span>Jump to View ({t.targetTab.toUpperCase()})</span>
                      <ExternalLink className="w-3 h-3 text-hub-muted" />
                    </button>

                    {/* Open Brainstorm Questions */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center space-x-1 text-[11px] font-bold text-purple-300">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Brainstorm Discussion:</span>
                      </div>
                      <ul className="space-y-1.5 pl-2">
                        {t.questions.map((q, idx) => (
                          <li key={idx} className="text-[11px] text-hub-muted leading-relaxed flex items-start space-x-1.5">
                            <span className="text-purple-400 font-bold">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Phase delivery roadmap (§12) */}
        <div className="border border-hub-border rounded-lg p-3 bg-hub-bg space-y-2">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-hub-text">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Phased Delivery Gate (§12)</span>
          </div>
          <div className="space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between text-hub-success-text">
              <span>Phase 0: Skeleton & Compose</span>
              <CheckCircle2 className="w-3 h-3" />
            </div>
            <div className="flex items-center justify-between text-hub-success-text">
              <span>Phase 1: Repo Management</span>
              <CheckCircle2 className="w-3 h-3" />
            </div>
            <div className="flex items-center justify-between text-hub-accent">
              <span>Phase 2: Actions & Secrets</span>
              <span>[In Review]</span>
            </div>
            <div className="flex items-center justify-between text-purple-400">
              <span>Phase 3: Helper / Agents MVP</span>
              <span>[Current Focus]</span>
            </div>
            <div className="flex items-center justify-between text-hub-muted">
              <span>Phase 4: Gateway & OpenClaw</span>
              <span>[Post-MVP]</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
