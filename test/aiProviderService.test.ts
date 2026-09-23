import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aiProviderService, PROVIDER_DEFINITIONS, AIProviderId, ThinkingEffort } from '../server/aiProviderService';
import { decryptSecret } from '../server/crypto';
import { db } from '../server/db';

describe('AIProviderService: Multi-Provider Registry & Configurations', () => {
  const allProviders: AIProviderId[] = [
    'ollama',
    'azure_foundry_openai',
    'azure_foundry_anthropic',
    'claude',
    'copilot',
    'openai',
    'aws_bedrock',
    'openrouter',
    'custom',
  ];

  test('registers all 9 required AI model and runtime providers', () => {
    for (const pid of allProviders) {
      assert.ok(PROVIDER_DEFINITIONS[pid], `Missing provider definition for ${pid}`);
      assert.ok(PROVIDER_DEFINITIONS[pid].name.length > 0);
      assert.ok(PROVIDER_DEFINITIONS[pid].defaultEndpoint.length > 0);
      assert.ok(PROVIDER_DEFINITIONS[pid].defaultModel.length > 0);
      assert.ok(Array.isArray(PROVIDER_DEFINITIONS[pid].presetModels));
      assert.ok(PROVIDER_DEFINITIONS[pid].presetModels.length > 0);
    }
  });

  test('contains reasoning & thinking models in preset dropdown lists', () => {
    // OpenAI has o1 and o3-mini
    assert.ok(PROVIDER_DEFINITIONS.openai.presetModels.includes('o1'));
    assert.ok(PROVIDER_DEFINITIONS.openai.presetModels.includes('o3-mini'));

    // Claude has claude-3-7-sonnet
    assert.ok(PROVIDER_DEFINITIONS.claude.presetModels.some(m => m.includes('claude-3-7-sonnet')));

    // Azure Foundry OpenAI has o1 and gpt-4o
    assert.ok(PROVIDER_DEFINITIONS.azure_foundry_openai.presetModels.includes('gpt-4o'));
    assert.ok(PROVIDER_DEFINITIONS.azure_foundry_openai.presetModels.includes('o1'));

    // Azure Foundry Anthropic has claude-3-7-sonnet
    assert.ok(PROVIDER_DEFINITIONS.azure_foundry_anthropic.presetModels.includes('claude-3-7-sonnet'));

    // OpenRouter has DeepSeek-R1 and Claude 3.7
    assert.ok(PROVIDER_DEFINITIONS.openrouter.presetModels.includes('deepseek/deepseek-r1'));
    assert.ok(PROVIDER_DEFINITIONS.openrouter.presetModels.includes('anthropic/claude-3.7-sonnet'));
  });

  test('loads AI settings with active provider and thinking effort', () => {
    const settings = aiProviderService.getAISettings();
    assert.ok(settings.activeProvider);
    assert.ok(settings.providers);
    for (const pid of allProviders) {
      const p = settings.providers[pid];
      assert.ok(p, `Provider ${pid} not in loaded settings`);
      assert.ok(p.endpointUrl);
      assert.ok(p.defaultModel);
      assert.ok(Array.isArray(p.availableModels));
    }
  });

  test('persists provider updates and encrypts API keys safely', () => {
    const testKey = 'sk-test-secret-key-1234567890';
    aiProviderService.saveAISettings({
      activeProvider: 'openai',
      thinkingEffort: 'high',
      providers: {
        openai: {
          endpointUrl: 'https://api.openai.com/v1',
          defaultModel: 'o3-mini',
          thinkingEffort: 'high',
          apiKey: testKey,
        },
      },
    });

    const updated = aiProviderService.getAISettings();
    assert.equal(updated.activeProvider, 'openai');
    assert.equal(updated.thinkingEffort, 'high');
    assert.equal(updated.providers.openai.defaultModel, 'o3-mini');
    assert.equal(updated.providers.openai.isKeySet, true);

    // API Key returned to client must be masked, not plain text
    assert.notEqual(updated.providers.openai.apiKey, testKey);
    assert.ok(updated.providers.openai.apiKey?.includes('•'));

    // Encrypted payload in SQLite can be decrypted to original key
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_multi_provider_config'").get() as any;
    const stored = JSON.parse(row.value);
    const decrypted = decryptSecret(stored.providers.openai.apiKeyEncrypted);
    assert.equal(decrypted, testKey);
  });

  test('preserves existing encrypted key when masked string is re-saved', () => {
    const testKey = 'sk-claude-test-key-99887766';
    aiProviderService.saveAISettings({
      providers: {
        claude: {
          endpointUrl: 'https://api.anthropic.com',
          defaultModel: 'claude-3-7-sonnet-20250219',
          thinkingEffort: 'medium',
          apiKey: testKey,
        },
      },
    });

    // Re-save with masked key (as frontend would do on subsequent saves)
    aiProviderService.saveAISettings({
      providers: {
        claude: {
          defaultModel: 'claude-3-7-sonnet-20250219',
          thinkingEffort: 'high',
          apiKey: 'sk••••••••66',
        },
      },
    });

    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_multi_provider_config'").get() as any;
    const stored = JSON.parse(row.value);
    const decrypted = decryptSecret(stored.providers.claude.apiKeyEncrypted);
    assert.equal(decrypted, testKey);
  });

  test('discovers models returns preset fallback list merged with scanned items', async () => {
    const result = await aiProviderService.discoverModels('azure_foundry_anthropic');
    assert.ok(result.models.length >= 3);
    assert.ok(result.models.includes('claude-3-7-sonnet'));
    assert.ok(result.models.includes('claude-3-5-sonnet'));
  });

  test('handles provider connection test requirement check', async () => {
    // Testing a provider requiring an API key without a key should report missing key
    const result = await aiProviderService.testConnection('claude', {
      endpointUrl: 'https://api.anthropic.com',
      apiKey: '',
    });
    // Claude without key fails validation immediately
    assert.equal(result.success, false);
    assert.ok(result.message.includes('API Key is required'));
  });
});
