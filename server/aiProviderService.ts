import { decryptSecret, encryptSecret, maskSecret } from './crypto';
import { db } from './db';

export type AIProviderId =
  | 'ollama'
  | 'azure_foundry_openai'
  | 'azure_foundry_anthropic'
  | 'claude'
  | 'copilot'
  | 'openai'
  | 'aws_bedrock'
  | 'openrouter'
  | 'custom';

export type ThinkingEffort = 'none' | 'low' | 'medium' | 'high';

export interface ProviderDefinition {
  id: AIProviderId;
  name: string;
  category: string;
  defaultEndpoint: string;
  defaultModel: string;
  presetModels: string[];
  supportsThinking: boolean;
  requiresApiKey: boolean;
  extraField?: 'apiVersion' | 'region' | 'customHeader';
  extraFieldLabel?: string;
  extraFieldDefault?: string;
}

export const PROVIDER_DEFINITIONS: Record<AIProviderId, ProviderDefinition> = {
  ollama: {
    id: 'ollama',
    name: 'Ollama (Native Local)',
    category: 'Local Daemon',
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'glm-5.3-flash:cloud',
    presetModels: [
      'glm-5.3-flash:cloud',
      'gemma4:31b-cloud',
      'llama3.3:70b',
      'deepseek-r1:32b',
      'qwen2.5-coder:32b',
      'mistral-nemo:12b',
    ],
    supportsThinking: true,
    requiresApiKey: false,
  },
  azure_foundry_openai: {
    id: 'azure_foundry_openai',
    name: 'Azure AI Foundry (OpenAI Compatible)',
    category: 'Cloud Enterprise',
    defaultEndpoint: 'https://your-resource.openai.azure.com',
    defaultModel: 'gpt-4o',
    presetModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gpt-4-turbo',
    ],
    supportsThinking: true,
    requiresApiKey: true,
    extraField: 'apiVersion',
    extraFieldLabel: 'API Version',
    extraFieldDefault: '2024-10-21',
  },
  azure_foundry_anthropic: {
    id: 'azure_foundry_anthropic',
    name: 'Azure AI Foundry (Anthropic Compatible)',
    category: 'Cloud Enterprise',
    defaultEndpoint: 'https://your-resource.services.ai.azure.com/models',
    defaultModel: 'claude-3-7-sonnet',
    presetModels: [
      'claude-3-7-sonnet',
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
    ],
    supportsThinking: true,
    requiresApiKey: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude (Anthropic Direct)',
    category: 'Frontier Cloud',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-3-7-sonnet-20250219',
    presetModels: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
    supportsThinking: true,
    requiresApiKey: true,
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot Endpoints',
    category: 'Developer Cloud',
    defaultEndpoint: 'https://api.githubcopilot.com',
    defaultModel: 'gpt-4o',
    presetModels: [
      'gpt-4o',
      'claude-3.5-sonnet',
      'o1-preview',
      'o1-mini',
    ],
    supportsThinking: true,
    requiresApiKey: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Endpoints',
    category: 'Frontier Cloud',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    presetModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gpt-4.5-preview',
      'chatgpt-4o-latest',
    ],
    supportsThinking: true,
    requiresApiKey: true,
  },
  aws_bedrock: {
    id: 'aws_bedrock',
    name: 'AWS Bedrock Endpoints',
    category: 'Cloud Enterprise',
    defaultEndpoint: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    defaultModel: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
    presetModels: [
      'anthropic.claude-3-7-sonnet-20250219-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'amazon.nova-pro-v1:0',
      'meta.llama3-3-70b-instruct-v1:0',
    ],
    supportsThinking: true,
    requiresApiKey: true,
    extraField: 'region',
    extraFieldLabel: 'AWS Region',
    extraFieldDefault: 'us-east-1',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Endpoints',
    category: 'Multi-Model Router',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    presetModels: [
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/o3-mini',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001',
    ],
    supportsThinking: true,
    requiresApiKey: true,
  },
  custom: {
    id: 'custom',
    name: 'Custom Endpoints',
    category: 'Custom / Self-Hosted',
    defaultEndpoint: 'http://localhost:8000/v1',
    defaultModel: 'custom-model',
    presetModels: [
      'custom-model',
      'default',
    ],
    supportsThinking: true,
    requiresApiKey: false,
    extraField: 'customHeader',
    extraFieldLabel: 'Custom Auth Header (e.g. X-API-Key)',
    extraFieldDefault: '',
  },
};

export interface StoredProviderConfig {
  endpointUrl: string;
  apiKeyEncrypted?: string;
  defaultModel: string;
  thinkingEffort?: ThinkingEffort;
  apiVersion?: string;
  region?: string;
  customHeader?: string;
  customModels?: string[];
}

export interface PromptCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  modelOverride?: string;
  providerOverride?: AIProviderId;
  thinkingEffortOverride?: ThinkingEffort;
}

export class AIProviderService {
  /**
   * Loads full multi-provider configuration from SQLite system_settings.
   */
  getAISettings(): {
    activeProvider: AIProviderId;
    thinkingEffort: ThinkingEffort;
    providers: Record<AIProviderId, {
      id: AIProviderId;
      name: string;
      category: string;
      endpointUrl: string;
      apiKey?: string;
      isKeySet: boolean;
      defaultModel: string;
      availableModels: string[];
      thinkingEffort: ThinkingEffort;
      apiVersion?: string;
      region?: string;
      customHeader?: string;
    }>;
    // Legacy fields for backward compatibility
    provider: string;
    ollamaUrl: string;
    defaultModel: string;
  } {
    const rawConfigs = this.loadAllStoredConfigs();
    const activeProvider = (rawConfigs.activeProvider || 'ollama') as AIProviderId;
    const globalThinking = (rawConfigs.thinkingEffort || 'none') as ThinkingEffort;

    const resultProviders = {} as any;

    for (const [key, def] of Object.entries(PROVIDER_DEFINITIONS)) {
      const pid = key as AIProviderId;
      const stored = rawConfigs.providers?.[pid] || {};
      const endpointUrl = stored.endpointUrl || def.defaultEndpoint;
      const defaultModel = stored.defaultModel || def.defaultModel;
      const isKeySet = Boolean(stored.apiKeyEncrypted);
      const thinkingEffort = stored.thinkingEffort || globalThinking || 'none';

      // Merge preset models with any custom or cached scanned models
      const modelsSet = new Set<string>([...def.presetModels, ...(stored.customModels || [])]);
      if (defaultModel) modelsSet.add(defaultModel);

      resultProviders[pid] = {
        id: pid,
        name: def.name,
        category: def.category,
        endpointUrl,
        isKeySet,
        apiKey: isKeySet ? maskSecret(this.decryptApiKey(stored.apiKeyEncrypted) || '') : '',
        defaultModel,
        availableModels: Array.from(modelsSet),
        thinkingEffort,
        apiVersion: stored.apiVersion || def.extraFieldDefault,
        region: stored.region || def.extraFieldDefault,
        customHeader: stored.customHeader || def.extraFieldDefault,
      };
    }

    const activeConfig = resultProviders[activeProvider] || resultProviders.ollama;

    return {
      activeProvider,
      thinkingEffort: activeConfig.thinkingEffort || globalThinking || 'none',
      providers: resultProviders,
      // Legacy backwards-compatibility
      provider: activeProvider,
      ollamaUrl: resultProviders.ollama?.endpointUrl || 'http://localhost:11434',
      defaultModel: activeConfig.defaultModel || 'glm-5.3-flash:cloud',
    };
  }

  /**
   * Saves updated AI settings, safely handling API keys and backward-compatible legacy keys.
   */
  saveAISettings(input: {
    activeProvider?: AIProviderId;
    thinkingEffort?: ThinkingEffort;
    provider?: string;
    ollamaUrl?: string;
    defaultModel?: string;
    providers?: Partial<Record<AIProviderId, Partial<StoredProviderConfig & { apiKey?: string }>>>;
  }): void {
    const current = this.loadAllStoredConfigs();

    // 1. Update active provider
    if (input.activeProvider) {
      current.activeProvider = input.activeProvider;
    } else if (input.provider && input.provider in PROVIDER_DEFINITIONS) {
      current.activeProvider = input.provider as AIProviderId;
    }

    // 2. Update global thinking effort if passed
    if (input.thinkingEffort) {
      current.thinkingEffort = input.thinkingEffort;
    }

    if (!current.providers) {
      current.providers = {};
    }

    // 3. Handle legacy Ollama URL and default model if sent directly
    if (input.ollamaUrl || (input.provider === 'ollama' && input.defaultModel)) {
      if (!current.providers.ollama) current.providers.ollama = {} as any;
      if (input.ollamaUrl) current.providers.ollama.endpointUrl = input.ollamaUrl;
      if (input.defaultModel) current.providers.ollama.defaultModel = input.defaultModel;
    }

    // 4. Update individual providers
    if (input.providers) {
      for (const [key, partialConfig] of Object.entries(input.providers)) {
        const pid = key as AIProviderId;
        if (!PROVIDER_DEFINITIONS[pid]) continue;

        if (!current.providers[pid]) {
          current.providers[pid] = {
            endpointUrl: PROVIDER_DEFINITIONS[pid].defaultEndpoint,
            defaultModel: PROVIDER_DEFINITIONS[pid].defaultModel,
          };
        }

        const target = current.providers[pid];

        if (partialConfig.endpointUrl !== undefined) target.endpointUrl = partialConfig.endpointUrl;
        if (partialConfig.defaultModel !== undefined) target.defaultModel = partialConfig.defaultModel;
        if (partialConfig.thinkingEffort !== undefined) target.thinkingEffort = partialConfig.thinkingEffort;
        if (partialConfig.apiVersion !== undefined) target.apiVersion = partialConfig.apiVersion;
        if (partialConfig.region !== undefined) target.region = partialConfig.region;
        if (partialConfig.customHeader !== undefined) target.customHeader = partialConfig.customHeader;
        if (Array.isArray(partialConfig.customModels)) target.customModels = partialConfig.customModels;

        // Handle API key updates safely:
        // If empty string or contains bullet dots (masked), leave unchanged.
        // If new plaintext key, encrypt it. If explicitly '__REMOVE__', clear it.
        if (partialConfig.apiKey !== undefined) {
          const rawKey = partialConfig.apiKey.trim();
          if (rawKey === '__REMOVE__') {
            delete target.apiKeyEncrypted;
          } else if (rawKey && !rawKey.includes('•')) {
            target.apiKeyEncrypted = encryptSecret(rawKey);
          }
        }
      }
    }

    // Persist to system_settings in SQLite
    this.saveStoredConfigs(current);

    // Also update legacy individual keys for external callers
    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    upsert.run('ai_provider', current.activeProvider);
    if (current.providers.ollama?.endpointUrl) {
      upsert.run('ollama_url', current.providers.ollama.endpointUrl);
    }
    const activeDefaultModel = current.providers[current.activeProvider]?.defaultModel || input.defaultModel;
    if (activeDefaultModel) {
      upsert.run('ollama_model', activeDefaultModel);
    }
  }

  /**
   * Executes completion against the configured provider with appropriate format and thinking effort.
   */
  async complete(options: PromptCompletionOptions): Promise<string> {
    const settings = this.getAISettings();
    const providerId = options.providerOverride || settings.activeProvider;
    const providerDef = PROVIDER_DEFINITIONS[providerId] || PROVIDER_DEFINITIONS.ollama;

    const storedConfigs = this.loadAllStoredConfigs();
    const stored = storedConfigs.providers?.[providerId] || {};

    const endpointUrl = stored.endpointUrl || providerDef.defaultEndpoint;
    const model = options.modelOverride || stored.defaultModel || providerDef.defaultModel;
    const apiKey = this.decryptApiKey(stored.apiKeyEncrypted) || '';
    const thinkingEffort = options.thinkingEffortOverride || stored.thinkingEffort || settings.thinkingEffort || 'none';

    switch (providerId) {
      case 'ollama':
        return this.completeOllama(endpointUrl, model, options.prompt, options.systemPrompt);

      case 'claude':
      case 'azure_foundry_anthropic':
        return this.completeAnthropicMessages(
          providerId,
          endpointUrl,
          apiKey,
          model,
          options.prompt,
          options.systemPrompt,
          thinkingEffort
        );

      case 'openai':
      case 'azure_foundry_openai':
      case 'openrouter':
      case 'copilot':
      case 'custom':
      case 'aws_bedrock':
      default:
        return this.completeOpenAICompatible(
          providerId,
          endpointUrl,
          apiKey,
          model,
          options.prompt,
          options.systemPrompt,
          thinkingEffort,
          stored
        );
    }
  }

  /**
   * Scans and discovers models for any supported provider.
   */
  async discoverModels(
    providerId: AIProviderId,
    customUrl?: string,
    customApiKey?: string
  ): Promise<{ models: string[]; defaultModel: string }> {
    const providerDef = PROVIDER_DEFINITIONS[providerId] || PROVIDER_DEFINITIONS.ollama;
    const storedConfigs = this.loadAllStoredConfigs();
    const stored = storedConfigs.providers?.[providerId] || {};

    const targetUrl = customUrl || stored.endpointUrl || providerDef.defaultEndpoint;
    const apiKey = customApiKey || this.decryptApiKey(stored.apiKeyEncrypted) || '';
    const defaultModel = stored.defaultModel || providerDef.defaultModel;

    const modelsSet = new Set<string>(providerDef.presetModels);
    if (defaultModel) modelsSet.add(defaultModel);

    try {
      if (providerId === 'ollama') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/tags`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.models)) {
            for (const m of data.models) {
              if (m.name) modelsSet.add(m.name);
              if (m.model) modelsSet.add(m.model);
            }
          }
        }
      } else if (providerId === 'openrouter') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data)) {
            for (const m of data.data.slice(0, 50)) {
              if (m.id) modelsSet.add(m.id);
            }
          }
        }
      } else if (providerId === 'openai' || providerId === 'custom' || providerId === 'azure_foundry_openai') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const baseUrl = targetUrl.replace(/\/$/, '');
        const modelsUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

        const headers: Record<string, string> = {};
        if (apiKey) {
          if (providerId === 'azure_foundry_openai') {
            headers['api-key'] = apiKey;
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
        }

        const res = await fetch(modelsUrl, { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data)) {
            for (const m of data.data) {
              if (m.id && typeof m.id === 'string') {
                modelsSet.add(m.id);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AIProviderService] Live model discovery for ${providerId} notice: ${err.message}`);
    }

    return {
      models: Array.from(modelsSet),
      defaultModel,
    };
  }

  /**
   * Tests connection to an AI provider endpoint.
   */
  async testConnection(
    providerId: AIProviderId,
    config: {
      endpointUrl?: string;
      apiKey?: string;
      model?: string;
      apiVersion?: string;
      region?: string;
    }
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    const providerDef = PROVIDER_DEFINITIONS[providerId] || PROVIDER_DEFINITIONS.ollama;
    const storedConfigs = this.loadAllStoredConfigs();
    const stored = storedConfigs.providers?.[providerId] || {};

    const endpointUrl = config.endpointUrl || stored.endpointUrl || providerDef.defaultEndpoint;
    const apiKey = config.apiKey !== undefined
      ? (config.apiKey && !config.apiKey.includes('•') ? config.apiKey : (config.apiKey === '' ? '' : (this.decryptApiKey(stored.apiKeyEncrypted) || '')))
      : (this.decryptApiKey(stored.apiKeyEncrypted) || '');

    if (providerDef.requiresApiKey && !apiKey) {
      return {
        success: false,
        message: `API Key is required to test ${providerDef.name}`,
        latencyMs: 0,
      };
    }

    try {
      const responseText = await this.complete({
        prompt: 'Ping test. Reply with strictly the word "OK".',
        modelOverride: model,
        providerOverride: providerId,
        thinkingEffortOverride: 'none',
      });

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        message: `Connected successfully (${latencyMs}ms): ${responseText.substring(0, 60).trim() || 'OK'}`,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        latencyMs,
      };
    }
  }

  // =========================================================================
  // Private Provider Implementation Details
  // =========================================================================

  private async completeOllama(
    endpointUrl: string,
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const res = await fetch(`${endpointUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    return (data.response || '').trim();
  }

  private async completeAnthropicMessages(
    providerId: AIProviderId,
    endpointUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string,
    thinkingEffort: ThinkingEffort = 'none'
  ): Promise<string> {
    let url = endpointUrl.replace(/\/$/, '');
    if (url.endsWith('/v1')) {
      url = `${url}/messages`;
    } else if (!url.endsWith('/messages')) {
      url = `${url}/v1/messages`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const body: any = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    // Thinking mode configuration
    if (thinkingEffort !== 'none') {
      const budgetMap: Record<ThinkingEffort, number> = {
        none: 0,
        low: 2048,
        medium: 4096,
        high: 8192,
      };
      const budget = budgetMap[thinkingEffort] || 2048;
      body.thinking = {
        type: 'enabled',
        budget_tokens: budget,
      };
      body.max_tokens = budget + 4096;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Claude API error HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    if (Array.isArray(data.content)) {
      const textParts = data.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text);
      return textParts.join('\n').trim();
    }
    return '';
  }

  private async completeOpenAICompatible(
    providerId: AIProviderId,
    endpointUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string,
    thinkingEffort: ThinkingEffort = 'none',
    storedConfig: StoredProviderConfig = { endpointUrl: '', defaultModel: '' }
  ): Promise<string> {
    let url = endpointUrl.replace(/\/$/, '');

    // Format chat completions endpoint URL
    if (providerId === 'azure_foundry_openai') {
      const apiVer = storedConfig.apiVersion || '2024-10-21';
      if (url.includes('/deployments/')) {
        url = `${url}/chat/completions?api-version=${apiVer}`;
      } else {
        url = `${url}/chat/completions?api-version=${apiVer}`;
      }
    } else {
      if (url.endsWith('/v1')) {
        url = `${url}/chat/completions`;
      } else if (!url.endsWith('/chat/completions')) {
        url = `${url}/v1/chat/completions`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      if (providerId === 'azure_foundry_openai') {
        headers['api-key'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = 'http://localhost:5173';
      headers['X-Title'] = 'SourceHub Forge Helper';
    }

    if (providerId === 'custom' && storedConfig.customHeader) {
      headers[storedConfig.customHeader] = apiKey;
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const isReasoningModel = model.startsWith('o1') || model.startsWith('o3') || model.includes('deepseek-r1');

    const body: any = {
      model,
      messages,
    };

    if (isReasoningModel) {
      body.max_completion_tokens = 8192;
      if (thinkingEffort !== 'none') {
        body.reasoning_effort = thinkingEffort;
      }
    } else {
      body.max_tokens = 4096;
      body.temperature = 0.2;
    }

    if (providerId === 'openrouter' && thinkingEffort !== 'none') {
      body.reasoning = { effort: thinkingEffort };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`${PROVIDER_DEFINITIONS[providerId]?.name || 'Provider'} HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    if (choice?.message?.content) {
      return choice.message.content.trim();
    }
    return '';
  }

  private loadAllStoredConfigs(): {
    activeProvider?: AIProviderId;
    thinkingEffort?: ThinkingEffort;
    providers?: Record<string, StoredProviderConfig>;
  } {
    try {
      const row = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_multi_provider_config'").get() as any;
      if (row?.value) {
        return JSON.parse(row.value);
      }
    } catch (_) {}

    // Fallback: migrate from legacy individual keys if present
    try {
      const legacyProvider = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_provider'").get() as any;
      const legacyUrl = db.prepare("SELECT value FROM system_settings WHERE key = 'ollama_url'").get() as any;
      const legacyModel = db.prepare("SELECT value FROM system_settings WHERE key = 'ollama_model'").get() as any;

      return {
        activeProvider: (legacyProvider?.value as AIProviderId) || 'ollama',
        thinkingEffort: 'none',
        providers: {
          ollama: {
            endpointUrl: legacyUrl?.value || 'http://localhost:11434',
            defaultModel: legacyModel?.value || 'glm-5.3-flash:cloud',
          },
        },
      };
    } catch {
      return { activeProvider: 'ollama', thinkingEffort: 'none', providers: {} };
    }
  }

  private saveStoredConfigs(config: any): void {
    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsert.run('ai_multi_provider_config', JSON.stringify(config));
  }

  private decryptApiKey(encrypted?: string): string | null {
    if (!encrypted) return null;
    try {
      return decryptSecret(encrypted);
    } catch {
      return null;
    }
  }
}

export const aiProviderService = new AIProviderService();
