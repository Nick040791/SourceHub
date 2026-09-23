import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Terminal, 
  ChevronDown,
  Contrast,
  Check,
  FolderGit2,
  Menu,
} from 'lucide-react';
import { Repository, UserProfile, AppTheme } from '../../types';
import { THEME_OPTIONS, AVATAR_COLOR_GRADIENTS } from '../profile/ProfileModal';

export type { AppTheme };

interface AppHeaderProps {
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onToggleHamburger: () => void;
  isHamburgerOpen: boolean;
  activeAgentRunsCount: number;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  repositories: Repository[];
  selectedRepo: Repository;
  onSelectRepo: (repo: Repository) => void;
  onOpenNewRepoModal: () => void;
  profile?: UserProfile;
  onOpenProfileModal?: () => void;
}

/** Quiet forge hex — Style D brand mark (flare, not a busy tile). */
const SourceHubMark: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
    <path
      d="M16 1.8L29.2 9.4V22.6L16 30.2L2.8 22.6V9.4L16 1.8Z"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Inner facet */}
    <path
      d="M16 6.2L24.4 11V21L16 25.8L7.6 21V11L16 6.2Z"
      fill="currentColor"
      fillOpacity="0.08"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.55"
      strokeLinejoin="round"
    />
    {/* Forge spark / flare */}
    <path
      d="M16 10.2L17.15 14.05L21.1 14.2L18 16.7L19 20.5L16 18.35L13 20.5L14 16.7L10.9 14.2L14.85 14.05L16 10.2Z"
      fill="currentColor"
    />
  </svg>
);

export const AppHeader: React.FC<AppHeaderProps> = ({
  onSelectTab,
  onToggleHamburger,
  isHamburgerOpen,
  activeAgentRunsCount,
  theme,
  onChangeTheme,
  repositories,
  selectedRepo,
  onSelectRepo,
  onOpenNewRepoModal,
  profile,
  onOpenProfileModal,
}) => {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showRepoMenu, setShowRepoMenu] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const filteredRepos = repositories.filter(r => 
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const helperActive = activeAgentRunsCount > 0;

  return (
    <header className="bg-hub-surface border-b border-hub-border sticky top-0 z-40 px-5 py-3.5 text-sm">
      <div className="flex items-center gap-5">
        {/* LEFT: Brand + repo capsule */}
        <div className="flex items-center gap-3.5 shrink-0 min-w-0">
          <div 
            onClick={() => onSelectTab('code')}
            className="flex items-center gap-2.5 cursor-pointer group min-w-0"
          >
            <SourceHubMark className="w-7 h-7 text-hub-accent shrink-0 group-hover:scale-105 transition-transform" />
            <span className="font-semibold text-hub-text text-[15px] tracking-tight shrink-0">SourceHub</span>
            {/* Quiet aside — Solo Forge + subtitle stacked, does not compete with wordmark */}
            <span className="hidden sm:inline-flex flex-col items-start justify-center gap-0.5 pl-2 ml-0.5 border-l border-hub-border/45 leading-none">
              <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-hub-accent/75">
                Solo Forge
              </span>
              <span className="text-[9px] text-hub-muted/55 font-mono tracking-tight">self-hosted • local</span>
            </span>
          </div>

          {/* Repository Switcher capsule */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowRepoMenu(!showRepoMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-hub-bg hover:bg-hub-subtle border transition-all text-hub-text ${
                showRepoMenu
                  ? 'border-hub-warning shadow-[0_0_0_1px_rgba(var(--hub-warning),0.35),0_0_14px_rgba(var(--hub-warning),0.2)]'
                  : 'border-hub-border'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-hub-muted" />
              <span className="font-mono text-hub-muted">{selectedRepo.owner ? `${selectedRepo.owner} /` : 'repo /'}</span>
              <span className="font-mono font-semibold text-hub-text">{selectedRepo.name}</span>
              <ChevronDown className="w-3 h-3 text-hub-muted" />
            </button>

            {showRepoMenu && (
              <div className="absolute left-0 mt-2.5 w-80 bg-hub-surface border border-hub-border rounded-xl shadow-2xl z-50 p-3 text-xs animate-in fade-in duration-100">
                <div className="pb-2.5 mb-2.5 space-y-2">
                  <span className="text-[10px] font-semibold text-hub-muted uppercase tracking-[0.12em] block px-0.5">
                    Switch Repository
                  </span>
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    autoFocus
                    className="w-full bg-hub-bg border border-hub-border rounded-lg px-3 py-2 text-xs text-hub-text placeholder-hub-muted focus:outline-none focus:border-hub-warning focus:shadow-[0_0_0_1px_rgba(var(--hub-warning),0.45)]"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {filteredRepos.map((r) => {
                    const isCurrent = r.name === selectedRepo.name;
                    return (
                      <button
                        key={r.name}
                        onClick={() => {
                          onSelectRepo(r);
                          setShowRepoMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-left ${
                          isCurrent
                            ? 'bg-hub-accent/10 border border-hub-accent'
                            : 'border border-transparent hover:bg-hub-subtle/70'
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className={`font-mono truncate flex items-center gap-1.5 ${isCurrent ? 'font-semibold text-hub-text' : 'font-medium text-hub-text'}`}>
                            <FolderGit2 className="w-3.5 h-3.5 text-hub-muted shrink-0" />
                            <span>{r.name}</span>
                          </div>
                          <div className="text-[10px] text-hub-muted font-mono pl-5">
                            {r.defaultBranch} • updated {r.updatedAt}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-hub-accent shrink-0" strokeWidth={2.5} />}
                      </button>
                    );
                  })}

                  {filteredRepos.length === 0 && (
                    <div className="text-center py-5 text-hub-muted text-xs">
                      No repositories match &quot;{repoSearch}&quot;
                    </div>
                  )}
                </div>

                <div className="pt-2.5 mt-2.5 border-t border-hub-border">
                  <button
                    onClick={() => {
                      setShowRepoMenu(false);
                      onOpenNewRepoModal();
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-hub-accent/10 text-hub-accent font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    <span>Create New Repository...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: wide search */}
        <div className="hidden md:flex flex-1 justify-center px-2 min-w-0">
          <div className="relative w-full max-w-xl">
            <Search className="w-4 h-4 text-hub-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search repos, PRs, agent runs... (/)"
              className="w-full bg-hub-bg text-hub-text placeholder-hub-muted text-xs pl-9 pr-3 py-2 rounded-lg border border-hub-border focus:outline-none focus:border-hub-accent/50 transition-colors"
            />
          </div>
        </div>

        {/* RIGHT: utilities */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Helper — green-dot active feel (mock), keep agents nav */}
          <button
            onClick={() => onSelectTab('agents')}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-transparent hover:bg-hub-subtle/80 border border-transparent hover:border-hub-border transition-colors text-hub-text"
            title="View active Helper agent runs"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {helperActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hub-success opacity-60" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${helperActive ? 'bg-hub-success-text' : 'bg-hub-success-text/80'}`} />
            </span>
            <span className="text-hub-muted">Helper active</span>
          </button>

          <button
            onClick={onToggleHamburger}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isHamburgerOpen
                ? 'bg-hub-accent/15 border-hub-accent text-hub-accent shadow-sm'
                : 'bg-transparent hover:bg-hub-subtle border-hub-border/80 text-hub-muted hover:text-hub-text'
            }`}
            title="Open Settings & Configurations Menu"
            aria-label="Settings and configurations menu"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-transparent hover:bg-hub-subtle border border-hub-border/80 transition-colors text-hub-muted hover:text-hub-text"
              title="Toggle theme and high-contrast mode"
            >
              <Contrast className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Theme</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-hub-surface border border-hub-border rounded-xl shadow-xl z-50 p-1.5 text-xs animate-in fade-in duration-100 max-h-80 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold text-hub-muted uppercase tracking-wider">
                  Select Display Theme ({THEME_OPTIONS.length} Presets)
                </div>
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { onChangeTheme(opt.id); setShowThemeMenu(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                      theme === opt.id ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-hub-text hover:bg-hub-subtle/50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span>{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {theme === opt.id && <Check className="w-3.5 h-3.5 text-hub-success-text shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hub-border/70 text-[11px] text-hub-muted font-mono">
            <Terminal className="w-3 h-3" />
            <span>sh CLI: ready</span>
          </div>

          {/* Primary CTA — lime + dark text per mock */}
          <button 
            onClick={() => onSelectTab('agents')}
            className="flex items-center gap-1 px-3 py-1.5 bg-hub-accent hover:brightness-110 text-zinc-950 rounded-lg text-xs font-bold shadow-sm transition-all"
            title="Kick off a new Agent task or repo action"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">New Task</span>
          </button>

          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 pl-2 ml-0.5 border-l border-hub-border group hover:opacity-90 transition-opacity text-left cursor-pointer"
            title="Customize Profile & Theme"
          >
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${
              profile?.avatarColor && AVATAR_COLOR_GRADIENTS[profile.avatarColor]
                ? AVATAR_COLOR_GRADIENTS[profile.avatarColor].class
                : 'from-purple-600 to-violet-700'
            } text-white font-bold text-xs flex items-center justify-center ring-1 ring-hub-border group-hover:scale-105 transition-transform shadow-sm`}>
              {profile?.initials || 'NB'}
            </div>
            <span className="hidden xl:inline text-xs font-medium text-hub-text group-hover:text-hub-accent transition-colors">
              {profile?.name?.split(' ')[0] || 'Operator'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
