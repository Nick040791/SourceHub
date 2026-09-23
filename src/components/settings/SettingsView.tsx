import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Lock, 
  Globe, 
  Cpu, 
  Plus, 
  Trash2, 
  Check, 
  Terminal, 
  ShieldCheck,
  Loader2,
  RotateCw,
  Send
} from 'lucide-react';
import { 
  Secret, 
  SSHKey, 
  PersonalAccessToken, 
  TokenScope, 
  Webhook 
} from '../../types';
import { api } from '../../services/api';

interface SettingsViewProps {
  repoName: string;
  webhooks?: Webhook[];
  initialSection?: 'secrets' | 'keys' | 'tokens' | 'webhooks' | 'providers';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  repoName,
  webhooks: initialWebhooks = [],
  initialSection = 'secrets',
}) => {
  const [activeSection, setActiveSection] = useState<'secrets' | 'keys' | 'tokens' | 'webhooks' | 'providers'>(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Secrets state
  const [secretsList, setSecretsList] = useState<Secret[]>([]);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretScope, setNewSecretScope] = useState<'actions' | 'agent' | 'webhook'>('actions');

  // Tokens state
  const [tokensList, setTokensList] = useState<PersonalAccessToken[]>([]);
  const [showAddToken, setShowAddToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<TokenScope[]>(['repo:read', 'pr:write']);

  // SSH Keys state
  const [sshKeysList, setSshKeysList] = useState<SSHKey[]>([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyTitle, setNewKeyTitle] = useState('');
  const [newKeyPublic, setNewKeyPublic] = useState('');

  // Webhooks state
  const [webhooksList, setWebhooksList] = useState<Webhook[]>(initialWebhooks);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [showWebhookPayload, setShowWebhookPayload] = useState(false);
  const [pingStatus, setPingStatus] = useState<Record<string, { loading?: boolean; success?: boolean; message?: string }>>({});

  // Provider state
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('glm-5.3-flash:cloud');
  const [availableModels, setAvailableModels] = useState<string[]>(['glm-5.3-flash:cloud']);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [savedProvider, setSavedProvider] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);

  const loadModels = async (url?: string) => {
    setIsLoadingModels(true);
    try {
      const data = await api.fetchOllamaModels(url || ollamaUrl);
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        if (!ollamaModel || !data.models.includes(ollamaModel)) {
          setOllamaModel(data.defaultModel || data.models[0]);
        }
      }
    } catch (err) {
      console.warn('Could not fetch Ollama models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load real data from SQLite
  const loadData = async () => {
    try {
      const [sec, tok, k, whs, ai] = await Promise.all([
        api.fetchSecrets(repoName).catch(() => []),
        api.fetchTokens().catch(() => []),
        api.fetchKeys().catch(() => []),
        api.fetchWebhooks(repoName).catch(() => []),
        api.fetchAISettings().catch(() => null),
      ]);
      setSecretsList(sec);
      setTokensList(tok);
      setSshKeysList(k);
      setWebhooksList(whs);
      if (ai) {
        if (ai.ollamaUrl) setOllamaUrl(ai.ollamaUrl);
        if (ai.defaultModel) setOllamaModel(ai.defaultModel);
      }
      loadModels(ai?.ollamaUrl || ollamaUrl);
    } catch (err) {
      console.warn('Could not load settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [repoName]);

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

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName.trim()) return;
    try {
      await api.createSecret(repoName, {
        name: newSecretName.trim(),
        scope: newSecretScope,
        value: newSecretValue.trim(),
      });
      setNewSecretName('');
      setNewSecretValue('');
      setShowAddSecret(false);
      loadData();
    } catch (err: any) {
      alert(`Error creating secret: ${err.message}`);
    }
  };

  const handleDeleteSecret = async (id: string) => {
    try {
      await api.deleteSecret(repoName, id);
      loadData();
    } catch (err: any) {
      alert(`Error deleting secret: ${err.message}`);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    try {
      await api.createToken({
        name: newTokenName.trim(),
        scopes: selectedScopes,
      });
      setNewTokenName('');
      setShowAddToken(false);
      loadData();
    } catch (err: any) {
      alert(`Error creating token: ${err.message}`);
    }
  };

  const handleDeleteToken = async (id: string) => {
    try {
      await api.deleteToken(id);
      loadData();
    } catch (err: any) {
      alert(`Error deleting token: ${err.message}`);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyTitle.trim() || !newKeyPublic.trim()) return;
    try {
      await api.createKey({
        title: newKeyTitle.trim(),
        publicKey: newKeyPublic.trim(),
      });
      setNewKeyTitle('');
      setNewKeyPublic('');
      setShowAddKey(false);
      loadData();
    } catch (err: any) {
      alert(`Error saving SSH key: ${err.message}`);
    }
  };

  const toggleScope = (scope: TokenScope) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;
    try {
      await api.createWebhook(repoName, { url: newWebhookUrl.trim() });
      setNewWebhookUrl('');
      setShowAddWebhook(false);
      loadData();
    } catch (err: any) {
      alert(`Error creating webhook: ${err.message}`);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await api.deleteWebhook(repoName, id);
      loadData();
    } catch (err: any) {
      alert(`Error deleting webhook: ${err.message}`);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setPingStatus(prev => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await api.testWebhook(repoName, id);
      if (res.success) {
        setPingStatus(prev => ({
          ...prev,
          [id]: { loading: false, success: true, message: `Ping OK (HTTP ${res.status || 200} in ${res.durationMs}ms)` },
        }));
      } else {
        setPingStatus(prev => ({
          ...prev,
          [id]: { loading: false, success: false, message: `Ping failed: ${res.error || res.statusText || 'Delivery error'}` },
        }));
      }
    } catch (err: any) {
      setPingStatus(prev => ({
        ...prev,
        [id]: { loading: false, success: false, message: err.message },
      }));
    }
  };

  const handleSaveProvider = async () => {
    try {
      await api.saveAISettings({
        provider: 'ollama',
        ollamaUrl,
        defaultModel: ollamaModel,
      });
      setSavedProvider(true);
      setTimeout(() => setSavedProvider(false), 2000);
    } catch (err: any) {
      alert(`Error saving AI settings: ${err.message}`);
    }
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
          <span>Secrets & Encryption ({secretsList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('tokens')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'tokens' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 text-hub-muted" />
          <span>Access Tokens (PATs) ({tokensList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('keys')}
          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'keys' ? 'bg-hub-subtle text-hub-text font-bold' : 'text-hub-muted hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 text-hub-muted" />
          <span>SSH & Deploy Keys ({sshKeysList.length})</span>
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
                  <span>Secrets for {repoName} (§7)</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Stored persistently in SQLite (<code>~/.sourcehub/sourcehub.db</code>). Strictly write-only.
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
                <span className="font-bold text-hub-text block">Add Encrypted Secret to {repoName}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-hub-muted text-[11px] mb-1">Secret Name</label>
                    <input
                      type="text"
                      placeholder="e.g. DOCKER_AUTH_TOKEN"
                      value={newSecretName}
                      onChange={(e) => setNewSecretName(e.target.value)}
                      autoFocus
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

              {secretsList.length === 0 && (
                <div className="p-6 text-center text-xs text-hub-muted">
                  No secrets configured for {repoName} yet.
                </div>
              )}
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
                  Fine-grained tokens stored persistently in SQLite for CLI, VS Code, and AI teammates.
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

            {showAddToken && (
              <form onSubmit={handleCreateToken} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-4 text-xs">
                <span className="font-bold text-hub-text block">Generate Personal Access Token</span>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Token Name / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. laptop-cli"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    autoFocus
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

            <div className="border border-hub-border rounded-md bg-hub-surface divide-y divide-hub-border">
              {tokensList.map((tok) => (
                <div key={tok.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-hub-text">{tok.name}</span>
                    <button
                      onClick={() => handleDeleteToken(tok.id)}
                      className="p-1 text-hub-muted hover:text-hub-danger-text rounded"
                      title="Revoke token"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                    <span>Expires: {tok.expiresAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SSH & DEPLOY KEYS SECTION (§8) */}
        {activeSection === 'keys' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-hub-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-hub-accent" />
                  <span>SSH User Keys & Deploy Keys (§8)</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Saved in SQLite. Automatically reads your existing local SSH public key if available.
                </p>
              </div>

              <button
                onClick={() => setShowAddKey(!showAddKey)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add SSH Key</span>
              </button>
            </div>

            {showAddKey && (
              <form onSubmit={handleAddKey} className="border border-hub-border rounded-md p-4 bg-hub-surface space-y-3 text-xs">
                <span className="font-bold text-hub-text block">Add SSH Public Key</span>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. My Laptop ED25519"
                    value={newKeyTitle}
                    onChange={(e) => setNewKeyTitle(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 text-xs text-hub-text"
                  />
                </div>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Key (ssh-ed25519 or ssh-rsa)</label>
                  <textarea
                    rows={3}
                    placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
                    value={newKeyPublic}
                    onChange={(e) => setNewKeyPublic(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded p-2 text-xs font-mono text-hub-text"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddKey(false)}
                    className="px-3 py-1 bg-hub-subtle hover:bg-hub-border text-hub-muted rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded font-semibold"
                  >
                    Add Key
                  </button>
                </div>
              </form>
            )}

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
                    <div className="font-mono text-[11px] text-hub-muted truncate max-w-md">
                      {key.keyType} • {key.fingerprint}
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
              <button
                onClick={() => setShowAddWebhook(!showAddWebhook)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-accent hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Webhook</span>
              </button>
            </div>

            {showAddWebhook && (
              <form onSubmit={handleAddWebhook} className="p-4 border border-hub-border rounded-md bg-hub-surface space-y-3 text-xs">
                <h4 className="font-bold text-hub-text">Configure New Outbound Webhook</h4>
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Payload URL</label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://example.com/sourcehub-webhook"
                    required
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-hub-link"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddWebhook(false)}
                    className="px-3 py-1 bg-hub-bg hover:bg-hub-border rounded text-hub-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-hub-success hover:bg-green-700 text-white rounded font-semibold"
                  >
                    Save Webhook
                  </button>
                </div>
              </form>
            )}

            {webhooksList.length === 0 ? (
              <div className="p-6 text-center border border-hub-border border-dashed rounded-md text-xs text-hub-muted">
                No webhooks configured for this repository yet. Click "Add Webhook" above.
              </div>
            ) : (
              <div className="space-y-3">
                {webhooksList.map((wh) => (
                  <div key={wh.id} className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-hub-link" />
                        <span className="font-mono font-bold text-hub-text">{wh.url}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTestWebhook(wh.id)}
                          disabled={pingStatus[wh.id]?.loading}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-hub-bg hover:bg-hub-subtle border border-hub-border text-hub-text disabled:opacity-50 transition-colors"
                          title="Send test ping payload"
                        >
                          {pingStatus[wh.id]?.loading ? (
                            <Loader2 className="w-3 h-3 animate-spin text-hub-accent" />
                          ) : (
                            <Send className="w-3 h-3 text-hub-accent" />
                          )}
                          <span>Ping</span>
                        </button>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-green-950 text-hub-success-text border border-green-800 font-mono">
                          Active
                        </span>
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="text-hub-muted hover:text-red-400 p-1"
                          title="Delete webhook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-hub-muted text-[11px]">
                      <span>Subscribed events:</span>
                      {wh.events.map((ev) => (
                        <span key={ev} className="px-1.5 py-0.2 rounded font-mono bg-hub-bg text-hub-text border border-hub-border">
                          {ev}
                        </span>
                      ))}
                    </div>

                    {pingStatus[wh.id]?.message && (
                      <div
                        className={`text-[11px] font-mono px-2 py-1 rounded border ${
                          pingStatus[wh.id]?.success
                            ? 'bg-green-950/40 text-hub-success-text border-green-900'
                            : 'bg-red-950/40 text-red-300 border-red-900'
                        }`}
                      >
                        {pingStatus[wh.id]?.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                Pluggable model endpoints for Helper Agents. Ollama endpoint is served natively.
              </p>
            </div>

            <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-hub-success-text animate-pulse" />
                  <span className="font-bold text-hub-text">Primary Provider: Ollama Endpoint</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                  Active Runtime
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-hub-muted text-[11px] mb-1">Ollama Base URL</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-hub-muted text-[11px]">Default Model Tag</label>
                    <button
                      type="button"
                      onClick={() => loadModels(ollamaUrl)}
                      disabled={isLoadingModels}
                      className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                      title="Re-scan Ollama models at endpoint"
                    >
                      <RotateCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      <span>{isLoadingModels ? 'Scanning...' : 'Scan Models'}</span>
                    </button>
                  </div>

                  {customModelMode ? (
                    <div className="flex space-x-1.5">
                      <input
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        placeholder="e.g. glm-5.3-flash:cloud"
                        className="flex-1 bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomModelMode(false)}
                        className="px-2 py-1 bg-hub-surface border border-hub-border rounded text-[11px] text-hub-text hover:bg-hub-border"
                      >
                        Dropdown
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-1.5">
                      <select
                        value={ollamaModel}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setCustomModelMode(true);
                          } else {
                            setOllamaModel(e.target.value);
                          }
                        }}
                        className="flex-1 bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                      >
                        {availableModels.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === 'glm-5.3-flash:cloud' ? '★ (Active Cloud Model)' : ''}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter custom tag...</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setCustomModelMode(true)}
                        className="px-2 py-1 bg-hub-surface border border-hub-border rounded text-[11px] text-hub-text hover:bg-hub-border"
                        title="Enter custom model tag"
                      >
                        Custom
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-hub-muted mt-1">
                    Select any model active at the Ollama endpoint.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProvider}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded font-semibold transition-colors"
                >
                  {savedProvider ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedProvider ? 'Saved!' : 'Save Endpoint & Model'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
