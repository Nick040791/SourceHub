import React, { useState, useEffect } from 'react';
import { AppHeader, AppTheme } from './components/layout/AppHeader';
import { RepoHeader } from './components/layout/RepoHeader';
import { RepoNavTabs } from './components/layout/RepoNavTabs';
import { CodeBrowser } from './components/code/CodeBrowser';
import { PullRequestsView } from './components/pr/PullRequestsView';
import { ActionsView } from './components/actions/ActionsView';
import { AgentsView } from './components/agents/AgentsView';
import { SettingsView } from './components/settings/SettingsView';
import { IssuesView } from './components/issues/IssuesView';
import { BrainstormPanel } from './components/brainstorm/BrainstormPanel';

import { 
  mockRepo, 
  mockFiles, 
  mockCommits, 
  mockPullRequests, 
  mockWorkflowRuns, 
  mockAgentRuns, 
  mockSecrets, 
  mockSSHKeys, 
  mockTokens, 
  mockWebhooks 
} from './mock/mockData';
import { TabType } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('agents');
  const [isBrainstormOpen, setIsBrainstormOpen] = useState(true);
  const [theme, setTheme] = useState<AppTheme>('high-contrast-dark');

  // Sync theme class to document
  React.useEffect(() => {
    document.documentElement.className = theme === 'high-contrast-light' ? 'light' : 'dark';
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  // Active agent runs count
  const activeAgentRunsCount = mockAgentRuns.filter(
    r => r.state !== 'ready_for_review' && r.state !== 'failed' && r.state !== 'cancelled'
  ).length;

  // Handlers for seamless cross-navigation
  const handleNavigateToAgentRun = (runId: string) => {
    setActiveTab('agents');
  };

  const handleNavigateToPR = (prId: number) => {
    setActiveTab('pulls');
  };

  const handleNavigateToActionsRun = (runId: string) => {
    setActiveTab('actions');
  };

  const handleAssignIssueToAgent = (title: string) => {
    setActiveTab('agents');
  };

  return (
    <div className={`min-h-screen bg-hub-bg text-hub-text flex flex-col font-sans selection:bg-purple-900 selection:text-white theme-${theme}`}>
      {/* 1. Global Navigation Bar */}
      <AppHeader
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onToggleBrainstorm={() => setIsBrainstormOpen(!isBrainstormOpen)}
        isBrainstormOpen={isBrainstormOpen}
        activeAgentRunsCount={activeAgentRunsCount}
        theme={theme}
        onChangeTheme={setTheme}
      />

      {/* 2. Repository Chrome Header */}
      <RepoHeader repo={mockRepo} />

      {/* 3. Repo Navigation Tabs (Code, Issues*, PRs, Actions, Agents, Settings) */}
      <RepoNavTabs
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        openPRsCount={mockPullRequests.filter(p => p.state === 'open').length}
        activeAgentsCount={activeAgentRunsCount}
      />

      {/* 4. Main Tab Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 transition-all">
        {activeTab === 'code' && (
          <CodeBrowser
            repo={mockRepo}
            files={mockFiles}
            latestCommit={mockCommits[0]}
            onNavigateToAgentRun={handleNavigateToAgentRun}
          />
        )}

        {activeTab === 'issues' && (
          <IssuesView onAssignToAgent={handleAssignIssueToAgent} />
        )}

        {activeTab === 'pulls' && (
          <PullRequestsView
            pullRequests={mockPullRequests}
            onNavigateToAgentRun={handleNavigateToAgentRun}
            onNavigateToActionsRun={handleNavigateToActionsRun}
          />
        )}

        {activeTab === 'actions' && (
          <ActionsView workflowRuns={mockWorkflowRuns} />
        )}

        {activeTab === 'agents' && (
          <AgentsView
            agentRuns={mockAgentRuns}
            onNavigateToPR={handleNavigateToPR}
            onNavigateToActionsRun={handleNavigateToActionsRun}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            secrets={mockSecrets}
            sshKeys={mockSSHKeys}
            tokens={mockTokens}
            webhooks={mockWebhooks}
          />
        )}
      </main>

      {/* 5. Collapsible Brainstorm & Spec Panel (§1 - §16 reference) */}
      <BrainstormPanel
        isOpen={isBrainstormOpen}
        onClose={() => setIsBrainstormOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        activeTab={activeTab}
      />

      {/* 6. Footer */}
      <footer className="border-t border-hub-border py-4 px-6 text-center text-xs text-hub-muted bg-hub-surface/40 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-hub-text">SourceHub</span>
            <span>•</span>
            <span>Single-Operator Self-Hosted Forge for Nicholas Beighley</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span>Ollama: Ready</span>
            <span>•</span>
            <span>Compose: Active</span>
            <span>•</span>
            <span className="text-hub-accent">v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
