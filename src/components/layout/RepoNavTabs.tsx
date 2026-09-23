import React from 'react';
import { 
  Code2, 
  CircleDot, 
  GitPullRequest, 
  PlayCircle, 
  Bot, 
  Settings,
  Laptop
} from 'lucide-react';
import { TabType } from '../../types';

interface RepoNavTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  openPRsCount: number;
  activeAgentsCount: number;
  uncommittedCount?: number;
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
  uncommittedCount = 0,
}) => {
  const tabs: TabItem[] = [
    { id: 'code', label: 'Code', icon: Code2 },
    { 
      id: 'desktop', 
      label: 'Desktop', 
      icon: Laptop, 
      count: uncommittedCount,
      badge: uncommittedCount > 0 ? undefined : 'Git',
      pulse: uncommittedCount > 0 
    },
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
    <div className="bg-hub-surface border-b border-hub-border px-5 sm:px-6 pt-0.5">
      <div className="max-w-7xl mx-auto flex items-center gap-0.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs sm:text-[13px] font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-hub-accent text-hub-text font-semibold'
                  : 'border-transparent text-hub-muted hover:text-hub-text/90 hover:border-hub-border/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? 'text-hub-accent'
                    : tab.highlight
                      ? 'text-hub-purple-text'
                      : 'text-hub-muted'
                }`}
              />
              <span>{tab.label}</span>

              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-hub-subtle text-hub-muted border border-hub-border/70">
                  {tab.count}
                </span>
              )}

              {tab.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase inline-flex items-center gap-1 ${
                    tab.highlight
                      ? 'bg-hub-purple/20 text-hub-purple-text border border-hub-purple/40'
                      : 'bg-hub-bg/80 text-hub-muted/80 border border-hub-border/60'
                  }`}
                >
                  {tab.pulse && (
                    <span className="w-1.5 h-1.5 rounded-full bg-hub-success-text animate-pulse" />
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
