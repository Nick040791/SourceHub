import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Globe,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  Bot,
  Bell,
  Key,
  Lock,
  Terminal,
  Contrast,
  FolderGit2,
  Laptop,
  GitBranch,
  PlayCircle,
  Keyboard,
  Server,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { TabType, Repository, WorkingCopyStatus, NetworkInfo, UserProfile } from '../../types';
import { AppTheme } from './AppHeader';
import { api } from '../../services/api';
import { THEME_OPTIONS, AVATAR_COLOR_GRADIENTS } from '../profile/ProfileModal';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  onNavigateTab: (tab: TabType) => void;
  onNavigateSettings: (section: 'secrets' | 'keys' | 'tokens' | 'webhooks' | 'providers') => void;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  selectedRepo: Repository;
  desktopStatus: WorkingCopyStatus | null;
  onOpenNewRepoModal: () => void;
  profile?: UserProfile;
  onOpenProfileModal?: () => void;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigateTab,
  onNavigateSettings,
  theme,
  onChangeTheme,
  selectedRepo,
  desktopStatus,
  onOpenNewRepoModal,
  profile,
  onOpenProfileModal,
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copiedLan, setCopiedLan] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'settings' | 'network' | 'system' | 'shortcuts'>('settings');

  // Load network & system info when menu opens
  useEffect(() => {
    if (isOpen) {
      api.fetchNetworkInfo()
        .then(setNetworkInfo)
        .catch(err => console.warn('Could not fetch network info:', err));
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPort = window.location.port || '5173';
  const primaryIp = networkInfo?.primaryLanIp || (window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1');
  const lanUrl = `http://${primaryIp}:${currentPort}`;
  const localhostUrl = `http://localhost:${currentPort}`;

  const handleCopyLanUrl = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopiedLan(true);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  const unstagedCount = desktopStatus?.files?.filter(f => !f.staged).length || 0;
  const stagedCount = desktopStatus?.files?.filter(f => f.staged).length || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Dark backdrop blur */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-lg bg-hub-surface border-l border-hub-border flex flex-col h-full shadow-2xl z-10 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-hub-border flex items-center justify-between bg-hub-surface">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hub-accent to-purple-600 flex items-center justify-center shadow-md">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-hub-text leading-tight flex items-center space-x-2">
                <span>Configurations & Menu</span>
                <span className="px-1.5 py-0.2 text-[10px] font-mono bg-hub-accent/15 text-hub-accent rounded border border-hub-accent/30">
                  Forge
                </span>
              </h2>
              <p className="text-[11px] text-hub-muted font-mono leading-none mt-0.5">
                SourceHub • Self-Hosted Forge
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-hub-muted hover:text-hub-text hover:bg-hub-subtle transition-colors"
            title="Close menu (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center border-b border-hub-border px-3 bg-hub-bg/60 text-xs font-medium">
          <button
            onClick={() => setActiveTabSection('settings')}
            className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTabSection === 'settings'
                ? 'border-hub-accent text-hub-text font-bold'
                : 'border-transparent text-hub-muted hover:text-hub-text'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => setActiveTabSection('network')}
            className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTabSection === 'network'
                ? 'border-hub-accent text-hub-text font-bold'
                : 'border-transparent text-hub-muted hover:text-hub-text'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Local Network</span>
          </button>
          <button
            onClick={() => setActiveTabSection('system')}
            className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTabSection === 'system'
                ? 'border-hub-accent text-hub-text font-bold'
                : 'border-transparent text-hub-muted hover:text-hub-text'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>System & Git</span>
          </button>
          <button
            onClick={() => setActiveTabSection('shortcuts')}
            className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 transition-colors ${
              activeTabSection === 'shortcuts'
                ? 'border-hub-accent text-hub-text font-bold'
                : 'border-transparent text-hub-muted hover:text-hub-text'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: SETTINGS DIRECT JUMPS */}
          {activeTabSection === 'settings' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider mb-2.5">
                  Repository Settings & Configurations
                </h3>
                <p className="text-xs text-hub-muted mb-3">
                  Jump directly to configure services, secrets, and automations for{' '}
                  <span className="font-semibold text-hub-text font-mono">{selectedRepo.name}</span>.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {/* AI Provider & Models */}
                  <button
                    onClick={() => {
                      onNavigateSettings('providers');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-hub-border bg-hub-bg hover:bg-hub-subtle hover:border-hub-accent/40 transition-all text-left group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-md bg-purple-950/60 border border-purple-800 text-purple-400 group-hover:scale-105 transition-transform">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-hub-text group-hover:text-hub-accent transition-colors flex items-center space-x-1.5">
                          <span>AI Provider & Models</span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-purple-900/40 text-purple-300 rounded border border-purple-700/50">
                            Ollama / Cloud
                          </span>
                        </div>
                        <p className="text-[11px] text-hub-muted mt-0.5">
                          Configure Ollama endpoint, default model (e.g. glm-5.3-flash), and agent reasoning engine.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted group-hover:text-hub-text shrink-0 ml-2" />
                  </button>

                  {/* Outbound Webhooks */}
                  <button
                    onClick={() => {
                      onNavigateSettings('webhooks');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-hub-border bg-hub-bg hover:bg-hub-subtle hover:border-hub-accent/40 transition-all text-left group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-md bg-blue-950/60 border border-blue-800 text-blue-400 group-hover:scale-105 transition-transform">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-hub-text group-hover:text-hub-accent transition-colors flex items-center space-x-1.5">
                          <span>Outbound Webhooks</span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-blue-900/40 text-blue-300 rounded border border-blue-700/50">
                            Active Dispatcher
                          </span>
                        </div>
                        <p className="text-[11px] text-hub-muted mt-0.5">
                          Configure HTTP POST webhooks, HMAC-SHA256 signatures, events, and live delivery pings.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted group-hover:text-hub-text shrink-0 ml-2" />
                  </button>

                  {/* Secrets */}
                  <button
                    onClick={() => {
                      onNavigateSettings('secrets');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-hub-border bg-hub-bg hover:bg-hub-subtle hover:border-hub-accent/40 transition-all text-left group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-md bg-amber-950/60 border border-amber-800 text-amber-400 group-hover:scale-105 transition-transform">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-hub-text group-hover:text-hub-accent transition-colors">
                          Repository Secrets & Env
                        </div>
                        <p className="text-[11px] text-hub-muted mt-0.5">
                          Encrypted environment variables injected into CI workflow runner and Helper agent runs.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted group-hover:text-hub-text shrink-0 ml-2" />
                  </button>

                  {/* Deploy Keys & SSH */}
                  <button
                    onClick={() => {
                      onNavigateSettings('keys');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-hub-border bg-hub-bg hover:bg-hub-subtle hover:border-hub-accent/40 transition-all text-left group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-md bg-emerald-950/60 border border-emerald-800 text-emerald-400 group-hover:scale-105 transition-transform">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-hub-text group-hover:text-hub-accent transition-colors">
                          Deploy Keys & SSH
                        </div>
                        <p className="text-[11px] text-hub-muted mt-0.5">
                          Manage public keys for read-only or read/write git remote operations.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted group-hover:text-hub-text shrink-0 ml-2" />
                  </button>

                  {/* Personal Access Tokens */}
                  <button
                    onClick={() => {
                      onNavigateSettings('tokens');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-hub-border bg-hub-bg hover:bg-hub-subtle hover:border-hub-accent/40 transition-all text-left group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-md bg-hub-subtle border border-hub-border text-hub-link group-hover:scale-105 transition-transform">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-hub-text group-hover:text-hub-accent transition-colors">
                          Personal Access Tokens
                        </div>
                        <p className="text-[11px] text-hub-muted mt-0.5">
                          Scoped tokens (`sh_pat_...`) for `sh` CLI, scripts, and automated integrations.
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-hub-muted group-hover:text-hub-text shrink-0 ml-2" />
                  </button>
                </div>
              </div>

              {/* Display & Appearance */}
              <div className="pt-4 border-t border-hub-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider flex items-center space-x-1.5">
                    <Contrast className="w-3.5 h-3.5 text-hub-accent" />
                    <span>Display & Theme ({THEME_OPTIONS.length} Presets)</span>
                  </h3>
                  {onOpenProfileModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenProfileModal();
                      }}
                      className="text-[11px] text-hub-accent hover:underline font-semibold"
                    >
                      Profile Settings...
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEME_OPTIONS.map((opt) => {
                    const isSelected = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeTheme(opt.id)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-hub-accent bg-hub-accent/15 ring-1 ring-hub-accent text-hub-text'
                            : 'border-hub-border bg-hub-bg hover:bg-hub-subtle text-hub-muted'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs">{opt.icon}</span>
                          <span className="font-semibold text-xs text-hub-text truncate">
                            {opt.label}
                          </span>
                        </div>
                        <div className="text-[9px] text-hub-muted mt-0.5 truncate">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL NETWORK SHARING & URLS */}
          {activeTabSection === 'network' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Wifi className="w-3.5 h-3.5 text-hub-success-text" />
                  <span>Local Area Network Access</span>
                </h3>
                <p className="text-xs text-hub-muted">
                  SourceHub is configured to listen across all network interfaces (`0.0.0.0`). Any device on your local Wi-Fi or wired network can access this forge directly.
                </p>
              </div>

              {/* Primary Network Card */}
              <div className="p-4 rounded-xl border border-hub-border bg-hub-bg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-hub-success animate-pulse" />
                    <span className="text-xs font-bold text-hub-text">Network LAN URL</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-hub-success/20 text-hub-success-text border border-hub-success/30 font-semibold">
                    Port {currentPort}
                  </span>
                </div>

                <div className="flex items-center space-x-2 bg-hub-surface border border-hub-border rounded-lg px-3 py-2">
                  <Globe className="w-4 h-4 text-hub-link shrink-0" />
                  <span className="font-mono text-xs text-hub-text flex-1 select-all font-semibold">
                    {lanUrl}
                  </span>
                  <button
                    onClick={handleCopyLanUrl}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-hub-subtle hover:bg-hub-border text-hub-text text-xs font-medium transition-colors shrink-0"
                    title="Copy LAN address"
                  >
                    {copiedLan ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-hub-success-text" />
                        <span className="text-hub-success-text">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-hub-muted" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-hub-muted space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Local Host Loopback:</span>
                    <a
                      href={localhostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-hub-link hover:underline inline-flex items-center space-x-1"
                    >
                      <span>{localhostUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {networkInfo?.lanIps && networkInfo.lanIps.length > 1 && (
                    <div className="pt-2 border-t border-hub-border mt-2">
                      <span className="block text-hub-muted text-[10px] uppercase font-bold mb-1">
                        All Detected Network Adapters:
                      </span>
                      <div className="space-y-1">
                        {networkInfo.lanIps.map(ip => (
                          <div key={ip} className="font-mono text-[11px] text-hub-text flex items-center justify-between">
                            <span>http://{ip}:{currentPort}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`http://${ip}:${currentPort}`);
                              }}
                              className="text-[10px] text-hub-link hover:underline"
                            >
                              copy
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions on connecting from other devices */}
              <div className="p-3.5 rounded-lg border border-hub-border bg-hub-surface text-xs space-y-2">
                <div className="font-semibold text-hub-text flex items-center space-x-1.5">
                  <Laptop className="w-3.5 h-3.5 text-hub-accent" />
                  <span>Connecting from Phones, Tablets or Laptops:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-hub-muted text-[11px]">
                  <li>Ensure your device is connected to the same Wi-Fi network.</li>
                  <li>Open any web browser (Safari, Chrome, Firefox).</li>
                  <li>Enter <code className="bg-hub-bg px-1 rounded text-hub-text font-mono">{lanUrl}</code>.</li>
                  <li>Full desktop forge, git staging, and AI features are available on the device!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM DAEMON & GIT ENVIRONMENT */}
          {activeTabSection === 'system' && (
            <div className="space-y-5">
              {/* Standalone Daemon Service */}
              <div>
                <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Server className="w-3.5 h-3.5 text-hub-accent" />
                  <span>Background Daemon & Service</span>
                </h3>

                <div className="p-4 rounded-xl border border-hub-border bg-hub-bg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-hub-text">Systemd User Service</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      networkInfo?.serviceStatus === 'active'
                        ? 'bg-hub-success/20 text-hub-success-text border border-hub-success/30'
                        : networkInfo?.serviceStatus === 'inactive'
                        ? 'bg-amber-950/40 text-amber-300 border border-amber-800'
                        : 'bg-hub-subtle text-hub-muted border border-hub-border'
                    }`}>
                      {networkInfo?.serviceStatus || 'Checking...'}
                    </span>
                  </div>

                  <p className="text-[11px] text-hub-muted">
                    SourceHub includes a persistent headless HTTP server (`server/index.ts`) that runs on boot via user systemd.
                  </p>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="p-2 rounded bg-hub-surface border border-hub-border flex items-center justify-between text-[11px]">
                      <span className="text-hub-muted">./scripts/install-service.sh</span>
                      <button
                        onClick={() => navigator.clipboard.writeText('./scripts/install-service.sh')}
                        className="text-hub-link hover:underline text-[10px]"
                      >
                        copy
                      </button>
                    </div>
                    <div className="p-2 rounded bg-hub-surface border border-hub-border flex items-center justify-between text-[11px]">
                      <span className="text-hub-muted">npm run serve (Port 5999)</span>
                      <button
                        onClick={() => navigator.clipboard.writeText('npm run serve')}
                        className="text-hub-link hover:underline text-[10px]"
                      >
                        copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Git Working Copy Status */}
              <div>
                <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-hub-link" />
                  <span>Git Workspace & Working Copy</span>
                </h3>

                <div className="p-3.5 rounded-xl border border-hub-border bg-hub-bg space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-hub-muted">Current Branch:</span>
                    <span className="font-mono font-bold text-hub-text flex items-center space-x-1">
                      <GitBranch className="w-3.5 h-3.5 text-hub-accent" />
                      <span>{desktopStatus?.branch || selectedRepo.defaultBranch}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-hub-muted">Changes Status:</span>
                    <span className="font-mono text-hub-text">
                      {stagedCount} staged, {unstagedCount} unstaged
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-hub-muted">Stashes:</span>
                    <span className="font-mono text-hub-text">
                      {desktopStatus?.stashes?.length || 0} stashed
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-hub-muted">Git Engine:</span>
                    <span className="font-mono text-hub-text text-[11px]">
                      Native Local Git (CLI / IPC)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-hub-border flex items-center space-x-2">
                    <button
                      onClick={() => {
                        onNavigateTab('desktop');
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded bg-hub-subtle hover:bg-hub-border border border-hub-border text-hub-text text-xs font-medium transition-colors"
                    >
                      <Laptop className="w-3.5 h-3.5 text-hub-accent" />
                      <span>Open Desktop Staging</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenNewRepoModal();
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded bg-hub-subtle hover:bg-hub-border border border-hub-border text-hub-accent text-xs font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Repo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Host Hardware & Node Metadata */}
              <div className="p-3 rounded-lg border border-hub-border bg-hub-surface text-[11px] font-mono text-hub-muted space-y-1">
                <div className="flex justify-between">
                  <span>Host:</span>
                  <span className="text-hub-text">{networkInfo?.hostname || 'ubuntu'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform:</span>
                  <span className="text-hub-text">{networkInfo?.platform || 'linux'}</span>
                </div>
                <div className="flex justify-between">
                  <span>System Uptime:</span>
                  <span className="text-hub-text">
                    {networkInfo?.uptime ? `${Math.floor(networkInfo.uptime / 3600)}h ${Math.floor((networkInfo.uptime % 3600) / 60)}m` : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Author:</span>
                  <span className="text-hub-text">{profile?.name || 'Forge Operator'}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KEYBOARD SHORTCUTS & QUICK KEYS */}
          {activeTabSection === 'shortcuts' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-hub-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-hub-accent" />
                  <span>Keyboard Shortcuts Cheat Sheet</span>
                </h3>
                <p className="text-xs text-hub-muted">
                  Quick keybindings to navigate SourceHub like a desktop powerhouse.
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Focus Global Search</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-accent font-mono text-[11px]">
                    /
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Close Modal / Menu</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-accent font-mono text-[11px]">
                    Esc
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Go to Code Browser</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-muted font-mono text-[11px]">
                    Tab: Code
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Go to Desktop Staging</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-muted font-mono text-[11px]">
                    Tab: Desktop
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Stage / Unstage All</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-muted font-mono text-[11px]">
                    Desktop Checkbox
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-hub-bg border border-hub-border">
                  <span className="text-hub-text font-medium">Launch Helper Agent Run</span>
                  <kbd className="px-2 py-0.5 rounded bg-hub-surface border border-hub-border text-hub-muted font-mono text-[11px]">
                    Tab: Agents
                  </kbd>
                </div>
              </div>

              {/* Navigation Quick Links */}
              <div className="pt-3 border-t border-hub-border space-y-2">
                <span className="block text-xs font-bold text-hub-muted uppercase tracking-wider">
                  Quick Navigation Jumps
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => { onNavigateTab('code'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    📁 Code Browser
                  </button>
                  <button
                    onClick={() => { onNavigateTab('desktop'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    💻 Desktop Git
                  </button>
                  <button
                    onClick={() => { onNavigateTab('pulls'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    🔀 Pull Requests
                  </button>
                  <button
                    onClick={() => { onNavigateTab('issues'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    🎯 Issues
                  </button>
                  <button
                    onClick={() => { onNavigateTab('actions'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    ⚡ Actions CI
                  </button>
                  <button
                    onClick={() => { onNavigateTab('agents'); onClose(); }}
                    className="p-2 rounded bg-hub-bg border border-hub-border hover:bg-hub-subtle text-left text-hub-text transition-colors"
                  >
                    🤖 Helper Agents
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hub-border bg-hub-surface flex items-center justify-between text-xs text-hub-muted">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-hub-text">SourceHub</span>
            <span>•</span>
            <span className="font-mono text-hub-accent">v0.1.0-alpha</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-hub-subtle hover:bg-hub-border text-hub-text font-medium text-xs transition-colors"
          >
            Close Menu
          </button>
        </div>
      </div>
    </div>
  );
};
