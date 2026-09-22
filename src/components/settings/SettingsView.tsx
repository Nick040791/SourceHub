import React, { useState } from 'react';
import { 
  Key, 
  Lock, 
  ShieldAlert, 
  Globe, 
  Cpu, 
  Plus, 
  Trash2, 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Sliders, 
  AlertCircle,
  FileCode,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { 
  Secret, 
  SSHKey, 
  PersonalAccessToken, 
  TokenScope, 
  Webhook 
} from '../../types';

interface SettingsViewProps {
  secrets: Secret[];
  sshKeys: SSHKey[];
  tokens: PersonalAccessToken[];
  webhooks: Webhook[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  secrets: initialSecrets,
  sshKeys: initialSSHKeys,
  tokens: initialTokens,
  webhooks: initialWebhooks,
}) => {
  const [activeSection, setActiveSection] = useState<'secrets' | 'keys' | 'tokens' | 'webhooks' | 'providers'>('secrets');

  // Secrets state
  const [secretsList, setSecretsList] = useState<Secret[]>(initialSecrets);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretScope, setNewSecretScope] = useState<'actions' | 'agent' | 'webhook'>('actions');

  // Tokens state
  const [tokensList, setTokensList] = useState<PersonalAccessToken[]>(initialTokens);
  const [showAddToken, setShowAddToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<TokenScope[]>(['repo:read', 'pr:write']);

  // SSH Keys state
  const [sshKeysList] = useState<SSHKey[]>(initialSSHKeys);

  // Webhooks state
  const [webhooksList, setWebhooksList] = useState<Webhook[]>(initialWebhooks);
  const [showWebhookPayload, setShowWebhookPayload] = useState(false);

  // Provider state
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:32b');
  const [savedProvider, setSavedProvider] = useState(false);

  const availableScopes: { scope: TokenScope; desc: string }[] = [
    { scope: 'repo:read', desc: 'Read code, commits, and branches' },
    { scope: 'repo:write', desc: 'Push commits and create branches' },
    { scope: 'pr:write', desc: 'Open, update, and merge pull requests' },
    { scope: 'actions:read', desc: 'View workflow runs and job logs' },
    { scope: 'actions:write', desc: 'Trigger manual workflow dispatches' },
    { scope: 'secrets:write', desc: 'Manage encrypted repository secrets' },
    { scope: 'agents:run', desc: 'Trigger and interact with Helper Agent tasks' },
    { scope: 'admin', desc: 'Full administrative access to the repository' },
  ];

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName || !newSecretValue) return;
    const newSec: Secret = {
      id: `sec-${Date.now()}`,
      name: newSecretName.toUpperCase(),
      scope: newSecretScope,
      maskedValue: '••••••••••••••••••••••••••••••••',
      updatedAt: 'Just now',
    };
    setSecretsList([...secretsList, newSec]);
    setNewSecretName('');
    setNewSecretValue('');
    setShowAddSecret(false);
  };

  const handleDeleteSecret = (id: string) => {
    setSecretsList(secretsList.filter(s => s.id !== id));
  };

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName) return;
    const newToken: PersonalAccessToken = {
      id: `tok-${Date.now()}`,
      name: newTokenName,
      tokenPrefix: `sh_pat_${Math.random().toString(36).substring(2, 6)}...`,
      scopes: selectedScopes,
      createdAt: 'Just now',
      expiresAt: 'In 90 days',
      lastUsed: 'Never'
    };
    setTokensList([...tokensList, newToken]);
    setNewTokenName('');
    setShowAddToken(false);
  };

  const toggleScope = (scope: TokenScope) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleSaveProvider = () => {
    setSavedProvider(true);
    setTimeout(() => setSavedProvider(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Settings Sub-Sidebar */}
      <div className="md:col-span-3 space-y-1 text-xs font-medium">
        <button
          onClick={() => setActiveSection('secrets')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'secrets' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4 text-hub-muted" />
          <span>Secrets & Encryption</span>
        </button>

        <button
          onClick={() => setActiveSection('tokens')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'tokens' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 text-hub-muted" />
          <span>Access Tokens (PATs)</span>
        </button>

        <button
          onClick={() => setActiveSection('keys')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'keys' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 text-hub-muted" />
          <span>SSH & Deploy Keys</span>
        </button>

        <button
          onClick={() => setActiveSection('webhooks')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'webhooks' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 text-hub-muted" />
          <span>Outbound Webhooks</span>
        </button>

        <button
          onClick={() => setActiveSection('providers')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'providers' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4 text-purple-400" />
          <span>AI Model Providers</span>
        </button>
      </div>

      {/* Main Settings Content Area */}
      <div className="md:col-span-9 space-y-6">
        {/* SECRETS SECTION (§7) */}
        {activeSection === 'secrets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hub-border">
              <div>
                <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-hub-accent" />
                  <span>Repository & Actions Secrets (§7)</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Secrets are encrypted at rest with envelope encryption and are strictly <strong>write-only</strong>. Values cannot be retrieved after creation.
                </p>
              </div>

              <button
                onClick={() => setShowAddSecret(!showAddSecret)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Secret</span>
              </button>
            </div>

            {/* Add Secret Form */}
            {showAddSecret && (
              <form onSubmit={handleAddSecret} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-3 text-xs">
                <span className="font-bold text-hub-text block">Add Encrypted Secret</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-hub-muted text-[11px] mb-1">Secret Name</label>
                    <input
                      type="text"
                      placeholder="e.g. DOCKER_AUTH_TOKEN"
                      value={newSecretName}
                      onChange={(e) => setNewSecretName(e.target.value)}
                      className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-xs text-hub-text uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-hub-muted text-[11px] mb-1">Scope</label>
                    <select
                      value={newSecretScope}
                      onChange={(e) => setNewSecretScope(e.target.value as any)}
                      className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-xs text-hub-text"
                    >
                      <option value="actions">Actions (${`{{ secrets.NAME }}`})</option>
                      <option value="agent">Agent / Helper Sandbox (Explicit Allowlist)</option>
                      <option value="webhook">Webhook HMAC Secret</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Secret Value (Write-Only)</label>
                  <textarea
                    rows={2}
                    placeholder="Paste secret ciphertext or token..."
                    value={newSecretValue}
                    onChange={(e) => setNewSecretValue(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded p-2 text-xs font-mono text-hub-text"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSecret(false)}
                    className="px-3 py-1 bg-hub-subtle hover:bg-hub-border text-hub-muted rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded font-semibold"
                  >
                    Save Encrypted Secret
                  </button>
                </div>
              </form>
            )}

            {/* Secrets List */}
            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
              {secretsList.map((sec) => (
                <div key={sec.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-hub-text">{sec.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-hub-subtle text-hub-muted border border-hub-border">
                        {sec.scope}
                      </span>
                    </div>
                    <div className="text-[11px] text-hub-muted font-mono">
                      <span>Value: {sec.maskedValue}</span> • <span>Updated {sec.updatedAt}</span>
                      {sec.lastUsed && <span> • Last used: {sec.lastUsed}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSecret(sec.id)}
                    className="p-1.5 text-hub-muted hover:text-hub-danger-text hover:bg-hub-subtle rounded transition-colors"
                    title="Delete secret"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOKENS SECTION (§8) */}
        {activeSection === 'tokens' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hub-border">
              <div>
                <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                  <Key className="w-4 h-4 text-hub-accent" />
                  <span>Personal Access Tokens (PATs) (§8)</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Fine-grained tokens for `sh` CLI, VS Code extension, and local AI agent teammates.
                </p>
              </div>

              <button
                onClick={() => setShowAddToken(!showAddToken)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate New Token</span>
              </button>
            </div>

            {/* Add Token Form */}
            {showAddToken && (
              <form onSubmit={handleCreateToken} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-4 text-xs">
                <span className="font-bold text-hub-text block">Generate Personal Access Token</span>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Token Name / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. laptop-terminal-cli"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-xs text-hub-text"
                  />
                </div>

                <div>
                  <label className="block text-hub-muted text-[11px] mb-2 font-bold uppercase tracking-wider">
                    Select Scopes (§8 Scope Matrix)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableScopes.map((item) => (
                      <label
                        key={item.scope}
                        className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition-colors ${
                          selectedScopes.includes(item.scope)
                            ? 'bg-hub-subtle border-hub-accent text-hub-text'
                            : 'bg-hub-bg border-hub-border text-hub-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(item.scope)}
                          onChange={() => toggleScope(item.scope)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-mono font-bold text-xs">{item.scope}</div>
                          <div className="text-[10px] text-hub-muted">{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddToken(false)}
                    className="px-3 py-1 bg-hub-subtle hover:bg-hub-border text-hub-muted rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded font-semibold"
                  >
                    Generate Token
                  </button>
                </div>
              </form>
            )}

            {/* Tokens List */}
            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
              {tokensList.map((tok) => (
                <div key={tok.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-hub-text">{tok.name}</span>
                    <span className="text-[11px] text-hub-muted font-mono">{tok.expiresAt}</span>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                    {tok.scopes.map((sc) => (
                      <span key={sc} className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-hub-bg text-hub-accent border border-hub-border">
                        {sc}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-hub-muted font-mono pt-1">
                    <span>Prefix: <code className="text-hub-text">{tok.tokenPrefix}</code></span>
                    <span>Last used: {tok.lastUsed || 'Never'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SSH & DEPLOY KEYS SECTION (§8) */}
        {activeSection === 'keys' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-hub-border">
              <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-hub-accent" />
                <span>SSH User Keys & Deploy Keys (§8)</span>
              </h3>
              <p className="text-xs text-hub-muted mt-0.5">
                Operator SSH keys for cloning and repo-scoped deploy keys for worker containers.
              </p>
            </div>

            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
              {sshKeysList.map((key) => (
                <div key={key.id} className="p-3 text-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-hub-text">{key.title}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-hub-subtle text-hub-muted border border-hub-border uppercase">
                        {key.type} key
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-hub-muted">
                      Fingerprint: {key.fingerprint}
                    </div>
                  </div>
                  <span className="text-[11px] text-hub-muted font-mono">{key.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WEBHOOKS SECTION (§10) */}
        {activeSection === 'webhooks' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-hub-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-hub-accent" />
                  <span>Outbound Webhooks (§10)</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Signed payloads (HMAC SHA-256) dispatched on push, PR, and agent run events.
                </p>
              </div>
            </div>

            {webhooksList.map((wh) => (
              <div key={wh.id} className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-hub-link" />
                    <span className="font-mono font-bold text-hub-text">{wh.url}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-green-950 text-hub-success-text border border-green-800 font-mono">
                    Active
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-hub-muted text-[11px]">
                  <span>Subscribed events:</span>
                  {wh.events.map((ev) => (
                    <span key={ev} className="px-1.5 py-0.2 rounded font-mono bg-hub-bg text-hub-text border border-hub-border">
                      {ev}
                    </span>
                  ))}
                </div>

                <div className="border-t border-hub-border pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-hub-text text-xs">Recent Deliveries</span>
                    <button
                      onClick={() => setShowWebhookPayload(!showWebhookPayload)}
                      className="text-hub-link hover:underline text-[11px]"
                    >
                      {showWebhookPayload ? 'Hide Payload' : 'Inspect Payload'}
                    </button>
                  </div>

                  {wh.deliveries.map((del) => (
                    <div key={del.id} className="bg-hub-bg border border-hub-border rounded p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-hub-success-text font-bold">[{del.statusCode}] {del.event}</span>
                        <span className="text-hub-muted">{del.duration} • {del.deliveredAt}</span>
                      </div>
                      {showWebhookPayload && (
                        <pre className="p-2 bg-black rounded text-[10px] font-mono text-emerald-400 overflow-x-auto">
                          {del.requestPayload}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODEL PROVIDERS SECTION (§9.4) */}
        {activeSection === 'providers' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-hub-border">
              <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>AI Model & Runtime Providers (§2 G6 & §9.4)</span>
              </h3>
              <p className="text-xs text-hub-muted mt-0.5">
                Pluggable model endpoints for Helper Agents. Ollama is default for MVP; OpenAI-compatible, Anthropic, and Azure Foundry in Phase 4.
              </p>
            </div>

            <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-hub-success-text animate-pulse" />
                  <span className="font-bold text-hub-text">Primary Local Provider: Ollama (MVP)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  Direct Executor Loop
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Ollama Base URL</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text"
                  />
                </div>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Default Model Tag</label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProvider}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded font-semibold transition-colors"
                >
                  {savedProvider ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedProvider ? 'Saved!' : 'Save Endpoint'}</span>
                </button>
              </div>
            </div>

            {/* Post-MVP Providers preview (§9.4) */}
            <div className="border border-dashed border-hub-border rounded-md p-4 text-xs space-y-2 opacity-70">
              <span className="font-bold text-hub-text">Phase 4 Adapters (Post-MVP)</span>
              <p className="text-hub-muted text-[11px]">
                OpenAI-compatible, Anthropic-compatible, Azure AI Foundry, OpenClaw worktree exec, and Hermes coding agent adapters will plug into the same SourceHub AgentRun state machine.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
