import React, { useState, useEffect } from 'react';
import { AppHeader, AppTheme } from './components/layout/AppHeader';
import { RepoHeader } from './components/layout/RepoHeader';
import { RepoNavTabs } from './components/layout/RepoNavTabs';
const CodeBrowser = React.lazy(() => import('./components/code/CodeBrowser').then(m => ({ default: m.CodeBrowser })));
const PullRequestsView = React.lazy(() => import('./components/pr/PullRequestsView').then(m => ({ default: m.PullRequestsView })));
const ActionsView = React.lazy(() => import('./components/actions/ActionsView').then(m => ({ default: m.ActionsView })));
const AgentsView = React.lazy(() => import('./components/agents/AgentsView').then(m => ({ default: m.AgentsView })));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const IssuesView = React.lazy(() => import('./components/issues/IssuesView').then(m => ({ default: m.IssuesView })));
const DesktopView = React.lazy(() => import('./components/desktop/DesktopView').then(m => ({ default: m.DesktopView })));
import { HamburgerMenu } from './components/layout/HamburgerMenu';
import { NewRepoModal } from './components/repo/NewRepoModal';
import { DesktopActionBar } from './components/desktop/DesktopActionBar';
import { ProfileModal } from './components/profile/ProfileModal';

import { mockRepo } from './mock/mockData';
import { TabType, Repository, WorkingCopyStatus, UserProfile } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'secrets' | 'keys' | 'tokens' | 'webhooks' | 'providers'>('secrets');
  
  const [theme, setTheme] = useState<AppTheme>(() => 
    (localStorage.getItem('sourcehub_theme') as AppTheme) || 'matrix'
  );

  const [profile, setProfile] = useState<UserProfile>({
    name: 'Forge Operator',
    username: 'operator',
    email: 'operator@sourcehub.local',
    bio: 'Single-Operator Solo Forge Developer',
    initials: 'SH',
    avatarColor: 'indigo',
    theme: 'matrix',
  });

  // Repositories state
  const [repositories, setRepositories] = useState<Repository[]>([mockRepo]);
  const [selectedRepo, setSelectedRepo] = useState<Repository>(mockRepo);
  const [isNewRepoModalOpen, setIsNewRepoModalOpen] = useState(false);

  // Sync theme class to document & local storage
  useEffect(() => {
    document.documentElement.className = (theme === 'high-contrast-light' || theme === 'sepia') ? 'light' : 'dark';
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('sourcehub_theme', theme);
  }, [theme]);

  // Load user profile and saved theme from SQLite
  useEffect(() => {
    api.fetchUserProfile().then(p => {
      if (p) {
        setProfile(p);
        if (p.theme) setTheme(p.theme);
      }
    }).catch(err => console.warn('Could not fetch user profile:', err));
  }, []);

  // Load real git repositories on mount
  useEffect(() => {
    api.fetchRepositories().then(repos => {
      if (repos && repos.length > 0) {
        setRepositories(repos);
        const sourceHub = repos.find(r => r.name.toLowerCase() === 'sourcehub');
        setSelectedRepo(sourceHub || repos[0]);
      }
    }).catch(err => {
      console.warn('Could not fetch real repositories:', err);
    });
  }, []);

  // Active agent runs count from real API
  const [activeAgentRunsCount, setActiveAgentRunsCount] = useState<number>(0);

  useEffect(() => {
    if (selectedRepo?.name) {
      api.fetchAgentRuns(selectedRepo.name).then(runs => {
        setActiveAgentRunsCount(runs.filter(r => r.state !== 'ready_for_review' && r.state !== 'failed').length);
      }).catch(() => setActiveAgentRunsCount(0));
    }
  }, [selectedRepo?.name, activeTab]);

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

  const [agentInitialPrompt, setAgentInitialPrompt] = useState<string>('');

  const handleAssignIssueToAgent = (issue: { id: number; title: string; body?: string }) => {
    const formattedPrompt = `Fix Issue #${issue.id}: ${issue.title}${issue.body ? `\n\n${issue.body}` : ''}`;
    setAgentInitialPrompt(formattedPrompt);
    setActiveTab('agents');
  };

  const handleCreateRepo = async (name: string, description: string) => {
    const newRepo = await api.createRepository(name, description);
    setRepositories([newRepo, ...repositories]);
    setSelectedRepo(newRepo);
    setActiveTab('code');
  };

  const [openPRsCount, setOpenPRsCount] = useState<number>(0);
  const [desktopStatus, setDesktopStatus] = useState<WorkingCopyStatus | null>(null);

  // Sync working copy status for GitHub Desktop
  const loadDesktopStatus = () => {
    if (selectedRepo?.name) {
      api.fetchDesktopStatus(selectedRepo.name)
        .then(setDesktopStatus)
        .catch(() => setDesktopStatus(null));
    }
  };

  useEffect(() => {
    loadDesktopStatus();
    const interval = setInterval(loadDesktopStatus, 4000);
    return () => clearInterval(interval);
  }, [selectedRepo?.name, activeTab]);

  const handleBranchSwitched = async () => {
    loadDesktopStatus();
    if (selectedRepo?.name) {
      const updated = await api.fetchRepository(selectedRepo.name).catch(() => null);
      if (updated) setSelectedRepo(updated);
    }
  };

  // Sync open PR count from real API
  useEffect(() => {
    if (selectedRepo?.name) {
      api.fetchPRs(selectedRepo.name)
        .then(prs => setOpenPRsCount(prs.filter(p => p.state === 'open').length))
        .catch(() => setOpenPRsCount(0));
    }
  }, [selectedRepo?.name, activeTab]);

  return (
    <div className={`min-h-screen bg-hub-bg text-hub-text flex flex-col font-sans selection:bg-purple-900 selection:text-white theme-${theme}`}>
      {/* 1. Global Navigation Bar */}
      <AppHeader
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onToggleHamburger={() => setIsHamburgerOpen(!isHamburgerOpen)}
        isHamburgerOpen={isHamburgerOpen}
        activeAgentRunsCount={activeAgentRunsCount}
        theme={theme}
        onChangeTheme={setTheme}
        repositories={repositories}
        selectedRepo={selectedRepo}
        onSelectRepo={setSelectedRepo}
        onOpenNewRepoModal={() => setIsNewRepoModalOpen(true)}
        profile={profile}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* 2. Repository Chrome Header */}
      <RepoHeader repo={selectedRepo} />

      {/* 2.5 GitHub Desktop Action Bar (Current Repo, Current Branch, Fetch/Push/Pull) */}
      <DesktopActionBar
        repo={selectedRepo}
        status={desktopStatus}
        onRefresh={loadDesktopStatus}
        onBranchSwitched={handleBranchSwitched}
      />

      {/* 3. Repo Navigation Tabs (Code, Desktop*, Issues, PRs, Actions, Agents, Settings) */}
      <RepoNavTabs
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        openPRsCount={openPRsCount}
        activeAgentsCount={activeAgentRunsCount}
        uncommittedCount={desktopStatus?.files?.length || 0}
      />

      {/* 4. Main Tab Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-5 sm:px-6 py-6 sm:py-7 transition-all">
        <React.Suspense fallback={
          <div className="py-16 flex items-center justify-center space-x-2 text-hub-muted text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-hub-accent animate-pulse"></span>
            <span>Loading forge view...</span>
          </div>
        }>
          {activeTab === 'code' && (
            <CodeBrowser
              repo={selectedRepo}
              onNavigateToAgentRun={handleNavigateToAgentRun}
            />
          )}

          {activeTab === 'desktop' && (
            <DesktopView
              repo={selectedRepo}
              status={desktopStatus}
              onRefreshStatus={loadDesktopStatus}
              profile={profile}
              onBranchSwitched={handleBranchSwitched}
            />
          )}

          {activeTab === 'issues' && (
            <IssuesView
              repoName={selectedRepo.name}
              onAssignToAgent={handleAssignIssueToAgent}
            />
          )}

          {activeTab === 'pulls' && (
            <PullRequestsView
              repoName={selectedRepo.name}
              branches={selectedRepo.branches || [selectedRepo.defaultBranch]}
              defaultBase={selectedRepo.defaultBranch}
              onNavigateToAgentRun={handleNavigateToAgentRun}
              onNavigateToActionsRun={handleNavigateToActionsRun}
            />
          )}

          {activeTab === 'actions' && (
            <ActionsView
              repoName={selectedRepo.name}
            />
          )}

          {activeTab === 'agents' && (
            <AgentsView
              repoName={selectedRepo.name}
              branches={selectedRepo.branches || [selectedRepo.defaultBranch]}
              defaultBranch={selectedRepo.defaultBranch}
              onNavigateToPR={handleNavigateToPR}
              onNavigateToActionsRun={handleNavigateToActionsRun}
              initialPrompt={agentInitialPrompt}
              onClearInitialPrompt={() => setAgentInitialPrompt('')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              repoName={selectedRepo.name}
              initialSection={settingsSection}
            />
          )}
        </React.Suspense>
      </main>

      {/* 5. Slide-Out Hamburger Configuration & Settings Drawer */}
      <HamburgerMenu
        isOpen={isHamburgerOpen}
        onClose={() => setIsHamburgerOpen(false)}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onNavigateSettings={(section) => {
          setSettingsSection(section);
          setActiveTab('settings');
        }}
        theme={theme}
        onChangeTheme={setTheme}
        selectedRepo={selectedRepo}
        desktopStatus={desktopStatus}
        onOpenNewRepoModal={() => setIsNewRepoModalOpen(true)}
        profile={profile}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* 6. New Repository Modal */}
      <NewRepoModal
        isOpen={isNewRepoModalOpen}
        onClose={() => setIsNewRepoModalOpen(false)}
        onCreate={handleCreateRepo}
      />

      {/* 6.5 User Profile Customization Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        onUpdateProfile={(updated) => {
          setProfile(updated);
          if (updated.theme) setTheme(updated.theme);
        }}
        currentTheme={theme}
        onChangeTheme={setTheme}
      />

      {/* 7. Footer */}
      <footer className="border-t border-hub-border py-4 px-6 text-center text-xs text-hub-muted bg-hub-surface/40 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-hub-text">SourceHub</span>
            <span>•</span>
            <span>Single-Operator Self-Hosted Forge for {profile.name}</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span>Repos: {repositories.length} Active</span>
            <span>•</span>
            <span>Git: Native</span>
            <span>•</span>
            <span className="text-hub-accent">v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
