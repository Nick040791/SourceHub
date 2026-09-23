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
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Cloud,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  Secret, 
  SSHKey, 
  PersonalAccessToken, 
  TokenScope, 
  Webhook,
  AIProviderId,
  ThinkingEffort,
  AISettingsState,
  AIProviderConfig
} from '../../types';
import { api } from '../../services/api';

const PROVIDER_ORDER: AIProviderId[] = [
  'azure_foundry_openai',
  'azure_foundry_anthropic',
  'claude',
  'copilot',
  'openai',
  'aws_bedrock',
  'openrouter',
  'custom',
  'ollama',
];

const DEFAULT_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  azure_foundry_openai: {
    id: 'azure_foundry_openai',
    name: 'Azure AI Foundry (OpenAI Compatible)',
    category: 'Cloud Enterprise',
    endpointUrl: 'https://your-resource.openai.azure.com',
    defaultModel: 'gpt-4o',
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'gpt-4-turbo'],
    thinkingEffort: 'none',
    apiVersion: '2024-10-21',
  },
  azure_foundry_anthropic: {
    id: 'azure_foundry_anthropic',
    name: 'Azure AI Foundry (Anthropic Compatible)',
    category: 'Cloud Enterprise',
    endpointUrl: 'https://your-resource.services.ai.azure.com/models',
    defaultModel: 'claude-3-7-sonnet',
    availableModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    thinkingEffort: 'none',
  },
  claude: {
    id: 'claude',
    name: 'Claude Endpoints (Anthropic Direct)',
    category: 'Frontier Cloud',
    endpointUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-7-sonnet-20250219',
    availableModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    thinkingEffort: 'none',
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot Endpoints',
    category: 'Developer Cloud',
    endpointUrl: 'https://api.githubcopilot.com',
    defaultModel: 'gpt-4o',
    availableModels: ['gpt-4o', 'claude-3.5-sonnet', 'o1-preview', 'o1-mini'],
    thinkingEffort: 'none',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Endpoints',
    category: 'Frontier Cloud',
    endpointUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    availableModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'gpt-4.5-preview'],
    thinkingEffort: 'none',
  },
  aws_bedrock: {
    id: 'aws_bedrock',
    name: 'AWS Bedrock Endpoints',
    category: 'Cloud Enterprise',
    endpointUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    defaultModel: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
    availableModels: [
      'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'amazon.nova-pro-v1:0',
      'meta.llama3-3-70b-instruct-v1:0',
    ],
    thinkingEffort: 'none',
    region: 'us-east-1',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Endpoints',
    category: 'Multi-Model Router',
    endpointUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    availableModels: [
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/o3-mini',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001',
    ],
    thinkingEffort: 'none',
  },
  custom: {
    id: 'custom',
    name: 'Custom Endpoints',
    category: 'Custom / Self-Hosted',
    endpointUrl: 'http://localhost:8000/v1',
    defaultModel: 'custom-model',
    availableModels: ['custom-model', 'default'],
    thinkingEffort: 'none',
    customHeader: '',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Native Local)',
    category: 'Local Daemon',
    endpointUrl: 'http://localhost:11434',
    defaultModel: 'glm-5.3-flash:cloud',
    availableModels: [
      'glm-5.3-flash:cloud',
      'gemma4:31b-cloud',
      'llama3.3:70b',
      'deepseek-r1:32b',
      'qwen2.5-coder:32b',
    ],
    thinkingEffort: 'none',
  },
};

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
  const [activeProviderId, setActiveProviderId] = useState<AIProviderId>('ollama');
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId>('azure_foundry_openai');
  const [providersConfig, setProvidersConfig] = useState<Record<AIProviderId, AIProviderConfig>>(DEFAULT_PROVIDERS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latencyMs?: number } | null>(null);
  const [savedProvider, setSavedProvider] = useState(false);
  const [customModelMode, setCustomModelMode] = useState<Record<string, boolean>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  const updateProviderConfig = (providerId: AIProviderId, updates: Partial<AIProviderConfig>) => {
    setProvidersConfig(prev => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || DEFAULT_PROVIDERS[providerId] || {}),
        ...updates,
      } as AIProviderConfig,
    }));
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
        if (ai.activeProvider) {
          setActiveProviderId(ai.activeProvider);
        }
        if (ai.providers) {
          setProvidersConfig(prev => {
            const merged = { ...prev };
            for (const [pid, pcfg] of Object.entries(ai.providers)) {
              const id = pid as AIProviderId;
              merged[id] = {
                ...(merged[id] || DEFAULT_PROVIDERS[id] || {}),
                ...pcfg,
                availableModels: pcfg.availableModels?.length ? pcfg.availableModels : (merged[id]?.availableModels || DEFAULT_PROVIDERS[id]?.availableModels || []),
              };
            }
            return merged;
          });
        }
      }
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

  const handleScanModels = async (providerId: AIProviderId) => {
    setIsLoadingModels(true);
    try {
      const cfg = providersConfig[providerId] || DEFAULT_PROVIDERS[providerId];
      const data = await api.fetchProviderModels(providerId, cfg.endpointUrl, cfg.apiKey);
      if (data.models && data.models.length > 0) {
        updateProviderConfig(providerId, {
          availableModels: data.models,
          defaultModel: cfg.defaultModel && data.models.includes(cfg.defaultModel) ? cfg.defaultModel : data.models[0],
        });
      }
    } catch (err: any) {
      console.warn(`Could not fetch models for ${providerId}:`, err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async (providerId: AIProviderId) => {
    setIsTestingProvider(true);
    setTestResult(null);
    try {
      const cfg = providersConfig[providerId] || DEFAULT_PROVIDERS[providerId];
      const res = await api.testAIConnection(providerId, {
        endpointUrl: cfg.endpointUrl,
        apiKey: cfg.apiKey,
        model: cfg.defaultModel,
        apiVersion: cfg.apiVersion,
        region: cfg.region,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message, latencyMs: 0 });
    } finally {
      setIsTestingProvider(false);
    }
  };

  const handleSaveProvider = async () => {
    try {
      const current = providersConfig[selectedProviderId] || DEFAULT_PROVIDERS[selectedProviderId];
      await api.saveAISettings({
        activeProvider: activeProviderId,
        providers: {
          [selectedProviderId]: {
            endpointUrl: current.endpointUrl,
            apiKey: current.apiKey,
            defaultModel: current.defaultModel,
            thinkingEffort: current.thinkingEffort,
            apiVersion: current.apiVersion,
            region: current.region,
            customHeader: current.customHeader,
            customModels: current.availableModels,
          },
        },
      });
      setSavedProvider(true);
      setTimeout(() => setSavedProvider(false), 2000);
      loadData();
    } catch (err: any) {
      alert(`Error saving AI settings: ${err.message}`);
    }
  };

  const handleSetActive = async (providerId: AIProviderId) => {
    setActiveProviderId(providerId);
    try {
      await api.saveAISettings({
        activeProvider: providerId,
      });
    } catch (err: any) {
      console.warn('Could not set active provider:', err);
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

        {/* MODEL PROVIDERS SECTION */}
        {activeSection === 'providers' && (() => {
          const currentConfig = providersConfig[selectedProviderId] || DEFAULT_PROVIDERS[selectedProviderId];
          const activeConfig = providersConfig[activeProviderId] || DEFAULT_PROVIDERS[activeProviderId];
          const isSelectedActive = selectedProviderId === activeProviderId;
          const isCustomMode = Boolean(customModelMode[selectedProviderId]);
          const isKeyVisible = Boolean(showApiKey[selectedProviderId]);

          return (
            <div className="space-y-4">
              <div className="pb-3 border-b border-hub-border">
                <h3 className="text-sm font-bold text-hub-text flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>AI Model & Runtime Providers</span>
                </h3>
                <p className="text-xs text-hub-muted mt-0.5">
                  Pluggable model endpoints for Helper Agents. Switch active runtimes, configure thinking effort, and connect local or cloud endpoints.
                </p>
              </div>

              {/* Active Runtime Highlight Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-950/40 via-hub-surface to-hub-surface border border-purple-900/40 text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-hub-success-text animate-pulse" />
                  <div>
                    <span className="text-hub-muted text-[11px] block">Active Forge Runtime</span>
                    <span className="font-bold text-hub-text">{activeConfig.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-purple-300">({activeConfig.defaultModel})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {activeConfig.thinkingEffort && activeConfig.thinkingEffort !== 'none' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-900/60 text-purple-300 border border-purple-700">
                      Thinking: {activeConfig.thinkingEffort}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                    Active Runtime
                  </span>
                </div>
              </div>

              {/* Provider Selection Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                {PROVIDER_ORDER.map((pid) => {
                  const p = providersConfig[pid] || DEFAULT_PROVIDERS[pid];
                  const isSelected = selectedProviderId === pid;
                  const isActive = activeProviderId === pid;

                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(pid);
                        setTestResult(null);
                      }}
                      className={`p-2.5 rounded-md border text-left transition-all relative ${
                        isSelected
                          ? 'bg-hub-surface border-purple-500 shadow-sm shadow-purple-500/10'
                          : 'bg-hub-bg/60 border-hub-border hover:bg-hub-surface hover:border-hub-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-hub-muted truncate max-w-[80px]">
                          {p.category}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-hub-success-text animate-pulse" title="Active Runtime" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-hub-text truncate">
                        {p.name.replace(/ Endpoints|\(Native Local\)/g, '')}
                      </div>
                      <div className="text-[10px] text-hub-muted font-mono truncate mt-0.5">
                        {p.defaultModel}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Provider Configuration Card */}
              <div className="border border-hub-border rounded-md bg-hub-surface p-4 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hub-border pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-sm text-hub-text">{currentConfig.name}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-hub-bg text-hub-muted border border-hub-border">
                        {currentConfig.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-hub-muted mt-0.5">
                      Configure connection endpoint, model selector, credentials, and reasoning controls.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isSelectedActive ? (
                      <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-purple-950 text-purple-300 border border-purple-800 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-hub-success-text animate-pulse" />
                        <span>Active Runtime</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetActive(selectedProviderId)}
                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-hub-subtle hover:bg-purple-950/60 hover:text-purple-300 border border-hub-border hover:border-purple-700 text-hub-muted transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Set as Active Runtime</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Endpoint URL */}
                  <div>
                    <label className="block text-hub-muted text-[11px] mb-1">
                      {currentConfig.id === 'ollama' ? 'Ollama Base URL' : 'Endpoint / Base URL'}
                    </label>
                    <input
                      type="text"
                      value={currentConfig.endpointUrl || ''}
                      onChange={(e) => updateProviderConfig(selectedProviderId, { endpointUrl: e.target.value })}
                      placeholder={DEFAULT_PROVIDERS[selectedProviderId]?.endpointUrl}
                      className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* API Key / Token (if not native Ollama) */}
                  {selectedProviderId !== 'ollama' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-hub-muted text-[11px]">
                          API Key / Access Token
                        </label>
                        {currentConfig.isKeySet && (
                          <span className="text-[10px] text-hub-success-text flex items-center space-x-1 font-mono">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Configured (AES-256-GCM)</span>
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={isKeyVisible ? 'text' : 'password'}
                          value={currentConfig.apiKey || ''}
                          onChange={(e) => updateProviderConfig(selectedProviderId, { apiKey: e.target.value })}
                          placeholder={currentConfig.isKeySet ? '•••••••• (Encrypted at rest)' : 'Enter API Key...'}
                          className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 pr-16 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                        />
                        <div className="absolute right-1.5 flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setShowApiKey(prev => ({ ...prev, [selectedProviderId]: !isKeyVisible }))}
                            className="p-1 text-hub-muted hover:text-hub-text rounded"
                            title={isKeyVisible ? 'Hide Key' : 'Show Key'}
                          >
                            {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Model Selector Dropdown & Dynamic Scanner */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-hub-muted text-[11px]">Default Model Tag</label>
                      <button
                        type="button"
                        onClick={() => handleScanModels(selectedProviderId)}
                        disabled={isLoadingModels}
                        className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                        title="Scan active models from endpoint"
                      >
                        <RotateCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        <span>{isLoadingModels ? 'Scanning...' : 'Scan Models'}</span>
                      </button>
                    </div>

                    {isCustomMode ? (
                      <div className="flex space-x-1.5">
                        <input
                          type="text"
                          value={currentConfig.defaultModel || ''}
                          onChange={(e) => updateProviderConfig(selectedProviderId, { defaultModel: e.target.value })}
                          placeholder="e.g. gpt-4o, claude-3-7-sonnet"
                          className="flex-1 bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomModelMode(prev => ({ ...prev, [selectedProviderId]: false }))}
                          className="px-2 py-1 bg-hub-surface border border-hub-border rounded text-[11px] text-hub-text hover:bg-hub-border"
                        >
                          Dropdown
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-1.5">
                        <select
                          value={currentConfig.defaultModel || ''}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setCustomModelMode(prev => ({ ...prev, [selectedProviderId]: true }));
                            } else {
                              updateProviderConfig(selectedProviderId, { defaultModel: e.target.value });
                            }
                          }}
                          className="flex-1 bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                        >
                          {(currentConfig.availableModels || DEFAULT_PROVIDERS[selectedProviderId]?.availableModels || []).map((m) => (
                            <option key={m} value={m}>
                              {m} {m === 'glm-5.3-flash:cloud' ? '★ (Cloud)' : ''}
                            </option>
                          ))}
                          <option value="__custom__">+ Enter custom tag...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setCustomModelMode(prev => ({ ...prev, [selectedProviderId]: true }))}
                          className="px-2 py-1 bg-hub-surface border border-hub-border rounded text-[11px] text-hub-text hover:bg-hub-border"
                          title="Enter custom model tag"
                        >
                          Custom
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-hub-muted mt-1">
                      Choose from registered models or enter a custom identifier.
                    </p>
                  </div>

                  {/* Thinking Effort Setting */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-hub-muted text-[11px]">Thinking / Reasoning Effort</label>
                      <span className="text-[10px] font-mono text-purple-400">
                        {currentConfig.thinkingEffort || 'none'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(['none', 'low', 'medium', 'high'] as ThinkingEffort[]).map((effort) => {
                        const isEffortActive = (currentConfig.thinkingEffort || 'none') === effort;
                        return (
                          <button
                            key={effort}
                            type="button"
                            onClick={() => updateProviderConfig(selectedProviderId, { thinkingEffort: effort })}
                            className={`py-1.5 px-2 rounded text-[11px] font-medium transition-colors text-center capitalize border ${
                              isEffortActive
                                ? 'bg-purple-950/80 border-purple-600 text-purple-300 font-bold'
                                : 'bg-hub-bg border-hub-border text-hub-muted hover:text-white'
                            }`}
                          >
                            {effort}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-hub-muted mt-1">
                      Allocates reasoning tokens (OpenAI o1/o3-mini, Claude 3.7 Sonnet thinking mode, DeepSeek-R1).
                    </p>
                  </div>

                  {/* Extra fields if applicable */}
                  {selectedProviderId === 'azure_foundry_openai' && (
                    <div>
                      <label className="block text-hub-muted text-[11px] mb-1">Azure API Version</label>
                      <input
                        type="text"
                        value={currentConfig.apiVersion || '2024-10-21'}
                        onChange={(e) => updateProviderConfig(selectedProviderId, { apiVersion: e.target.value })}
                        placeholder="2024-10-21"
                        className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}

                  {selectedProviderId === 'aws_bedrock' && (
                    <div>
                      <label className="block text-hub-muted text-[11px] mb-1">AWS Region</label>
                      <input
                        type="text"
                        value={currentConfig.region || 'us-east-1'}
                        onChange={(e) => updateProviderConfig(selectedProviderId, { region: e.target.value })}
                        placeholder="us-east-1"
                        className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}

                  {selectedProviderId === 'custom' && (
                    <div>
                      <label className="block text-hub-muted text-[11px] mb-1">Custom Auth Header Name (Optional)</label>
                      <input
                        type="text"
                        value={currentConfig.customHeader || ''}
                        onChange={(e) => updateProviderConfig(selectedProviderId, { customHeader: e.target.value })}
                        placeholder="e.g. X-API-Key or Authorization"
                        className="w-full bg-hub-bg border border-hub-border rounded px-2.5 py-1.5 font-mono text-xs text-hub-text focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* Test Connection Result Feedback */}
                {testResult && (
                  <div
                    className={`flex items-start space-x-2 p-2.5 rounded border text-xs font-mono ${
                      testResult.success
                        ? 'bg-green-950/40 border-green-800 text-hub-success-text'
                        : 'bg-red-950/40 border-red-800 text-red-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-hub-success-text shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold">
                        {testResult.success ? 'Connection Test Passed' : 'Connection Test Failed'}
                      </div>
                      <div className="text-[11px] opacity-90 break-words mt-0.5">
                        {testResult.message}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-hub-border">
                  <button
                    type="button"
                    onClick={() => handleTestConnection(selectedProviderId)}
                    disabled={isTestingProvider}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-hub-bg hover:bg-hub-subtle border border-hub-border rounded text-hub-text font-medium transition-colors disabled:opacity-50"
                  >
                    {isTestingProvider ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-hub-accent" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    )}
                    <span>{isTestingProvider ? 'Testing Endpoint...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveProvider}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-hub-success hover:bg-green-700 text-white rounded font-semibold transition-colors shadow-sm"
                  >
                    {savedProvider ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{savedProvider ? 'Saved Settings!' : 'Save Provider Settings'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
