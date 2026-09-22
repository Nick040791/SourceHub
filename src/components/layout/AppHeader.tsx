import React, { useState } from 'react';
import { 
  Bot, 
  Search, 
  Plus, 
  Bell, 
  Terminal, 
  Sparkles, 
  Code2, 
  GitBranch, 
  SlidersHorizontal,
  ChevronDown,
  Contrast,
  Check
} from 'lucide-react';

export type AppTheme = 'high-contrast-dark' | 'dark' | 'high-contrast-light';

interface AppHeaderProps {
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onToggleBrainstorm: () => void;
  isBrainstormOpen: boolean;
  activeAgentRunsCount: number;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onSelectTab,
  onToggleBrainstorm,
  isBrainstormOpen,
  activeAgentRunsCount,
  theme,
  onChangeTheme,
}) => {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  return (
    <header className="bg-hub-surface border-b border-hub-border sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between text-sm">
      {/* Left: Brand & Forge Breadcrumb */}
      <div className="flex items-center space-x-3">
        <div 
          onClick={() => onSelectTab('code')}
          className="flex items-center space-x-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hub-accent to-purple-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <span className="font-bold text-white text-base tracking-wider">SH</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-hub-text text-base tracking-tight">SourceHub</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-hub-accent/15 text-hub-accent rounded border border-hub-accent/30">
                Solo Forge
              </span>
            </div>
            <span className="text-[11px] text-hub-muted font-mono leading-none">self-hosted • nicholas</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center pl-6">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-hub-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search repos, PRs, agent runs... (/)"
              className="w-full bg-hub-bg text-hub-text placeholder-hub-muted text-xs pl-8 pr-3 py-1.5 rounded-md border border-hub-border focus:outline-none focus:border-hub-link transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Right Controls: Agents badge, Brainstorm Drawer Toggle, Quick actions, User profile */}
      <div className="flex items-center space-x-2.5">
        {/* Active Helper Agent Badge */}
        <button
          onClick={() => onSelectTab('agents')}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-hub-subtle hover:bg-hub-border border border-hub-border transition-colors text-hub-text"
          title="View active Helper agent runs"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-4 h-4 text-hub-accent" />
            {activeAgentRunsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hub-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-hub-success-text"></span>
              </span>
            )}
          </div>
          <span>Helper</span>
          <span className="px-1.5 py-0.2 bg-hub-accent/20 text-hub-accent rounded-full text-[10px] font-mono">
            {activeAgentRunsCount} active
          </span>
        </button>

        {/* Brainstorm & Spec Inspector Toggle */}
        <button
          onClick={onToggleBrainstorm}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
            isBrainstormOpen
              ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm shadow-purple-900/30'
              : 'bg-hub-subtle hover:bg-hub-border border-hub-border text-hub-text hover:text-white'
          }`}
          title="Open SourceHub Plan Spec & Brainstorming Guide"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>Brainstorm Spec</span>
        </button>

        {/* Theme Contrast Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-hub-subtle hover:bg-hub-border border border-hub-border transition-colors text-hub-text"
            title="Toggle theme and high-contrast mode"
          >
            <Contrast className="w-3.5 h-3.5 text-hub-accent" />
            <span className="hidden sm:inline">Theme</span>
            <ChevronDown className="w-3 h-3 text-hub-muted" />
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-hub-surface border border-hub-border rounded-lg shadow-xl z-50 p-1.5 text-xs animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-bold text-hub-muted uppercase tracking-wider">
                Select Display Theme
              </div>
              <button
                onClick={() => { onChangeTheme('high-contrast-dark'); setShowThemeMenu(false); }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                  theme === 'high-contrast-dark' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-hub-text hover:bg-hub-subtle/50'
                }`}
              >
                <span>⚡ High Contrast Dark (Default)</span>
                {theme === 'high-contrast-dark' && <Check className="w-3.5 h-3.5 text-hub-success-text" />}
              </button>
              <button
                onClick={() => { onChangeTheme('dark'); setShowThemeMenu(false); }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                  theme === 'dark' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-hub-text hover:bg-hub-subtle/50'
                }`}
              >
                <span>🌑 GitHub Dark (Dimmed)</span>
                {theme === 'dark' && <Check className="w-3.5 h-3.5 text-hub-success-text" />}
              </button>
              <button
                onClick={() => { onChangeTheme('high-contrast-light'); setShowThemeMenu(false); }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors text-left ${
                  theme === 'high-contrast-light' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-hub-text hover:bg-hub-subtle/50'
                }`}
              >
                <span>☀️ High Contrast Light</span>
                {theme === 'high-contrast-light' && <Check className="w-3.5 h-3.5 text-hub-success-text" />}
              </button>
            </div>
          )}
        </div>

        {/* CLI status tooltip indicator */}
        <div className="hidden sm:flex items-center space-x-1 px-2 py-1 bg-hub-bg rounded border border-hub-border text-[11px] text-hub-muted font-mono">
          <Terminal className="w-3 h-3 text-hub-muted" />
          <span>sh CLI: ready</span>
        </div>

        {/* New Item dropdown button */}
        <button 
          onClick={() => onSelectTab('agents')}
          className="flex items-center space-x-1 px-2.5 py-1 bg-hub-success hover:bg-green-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
          title="Kick off a new Agent task or repo action"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </button>

        {/* User avatar */}
        <div className="flex items-center space-x-2 pl-1 border-l border-hub-border">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center ring-1 ring-hub-border">
            NB
          </div>
          <span className="hidden xl:inline text-xs font-medium text-hub-text">Nicholas</span>
        </div>
      </div>
    </header>
  );
};
