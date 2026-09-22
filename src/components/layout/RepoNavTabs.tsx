import React from 'react';
import { 
  Code2, 
  CircleDot, 
  GitPullRequest, 
  PlayCircle, 
  Bot, 
  Settings,
  Sparkles
} from 'lucide-react';
import { TabType } from '../../types';

interface RepoNavTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  openPRsCount: number;
  activeAgentsCount: number;
}

interface TabItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
  badge?: string;
  count?: number;
  highlight?: boolean;
  pulse?: boolean;
}

export const RepoNavTabs: React.FC<RepoNavTabsProps> = ({
  activeTab,
  onSelectTab,
  openPRsCount,
  activeAgentsCount,
}) => {
  const tabs: TabItem[] = [
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'issues', label: 'Issues', icon: CircleDot, badge: 'MVP-lite' },
    { id: 'pulls', label: 'Pull requests', icon: GitPullRequest, count: openPRsCount },
    { id: 'actions', label: 'Actions', icon: PlayCircle },
    { 
      id: 'agents', 
      label: 'Agents', 
      icon: Bot, 
      highlight: true, 
      badge: 'Helper', 
      pulse: activeAgentsCount > 0 
    },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="bg-hub-surface border-b border-hub-border px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={`flex items-center space-x-2 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-hub-accent text-hub-text font-semibold'
                  : 'border-transparent text-hub-muted hover:text-hub-text hover:border-hub-border'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive 
                    ? tab.highlight ? 'text-hub-accent' : 'text-hub-text' 
                    : tab.highlight ? 'text-purple-400' : 'text-hub-muted'
                }`}
              />
              <span>{tab.label}</span>

              {/* Count badge for PRs */}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] font-mono bg-hub-subtle text-hub-text border border-hub-border">
                  {tab.count}
                </span>
              )}

              {/* Special Badge for Helper / MVP-lite */}
              {tab.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-flex items-center space-x-1 ${
                    tab.highlight
                      ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                      : 'bg-hub-bg text-hub-muted border border-hub-border'
                  }`}
                >
                  {tab.pulse && (
                    <span className="w-1.5 h-1.5 rounded-full bg-hub-success-text mr-1 animate-pulse" />
                  )}
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
