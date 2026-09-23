import crypto from 'crypto';
import { db } from './db';

export interface WebhookPayload {
  event: string;
  repository: string;
  timestamp: string;
  data: any;
}

export interface WebhookDeliveryResult {
  webhookId: string;
  url: string;
  success: boolean;
  status?: number;
  statusText?: string;
  error?: string;
  durationMs: number;
}

export class WebhookService {
  /**
   * Asynchronously dispatch an event to all active webhooks subscribed to this repository.
   */
  async dispatch(repoName: string, event: string, data: any): Promise<WebhookDeliveryResult[]> {
    let hooks: any[] = [];
    try {
      hooks = db.prepare('SELECT * FROM webhooks WHERE repo_name = ? AND active = 1').all(repoName) as any[];
    } catch (err: any) {
      console.warn(`[WebhookService] Failed to query webhooks for ${repoName}:`, err.message);
      return [];
    }

    if (!hooks || hooks.length === 0) {
      return [];
    }

    const payload: WebhookPayload = {
      event,
      repository: repoName,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);

    const relevantHooks = hooks.filter(h => {
      try {
        const events: string[] = JSON.parse(h.events || '[]');
        return (
          events.includes('*') ||
          events.includes(event) ||
          events.some(e => event.startsWith(e + '.'))
        );
      } catch {
        return false;
      }
    });

    const deliveries = relevantHooks.map(h => this.sendDelivery(h, event, payloadString));
    return Promise.all(deliveries);
  }

  /**
   * Ping a specific webhook for testing connectivity.
   */
  async testPing(webhookId: string): Promise<WebhookDeliveryResult> {
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(webhookId) as any;
    if (!hook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const payload: WebhookPayload = {
      event: 'ping',
      repository: hook.repo_name,
      timestamp: new Date().toISOString(),
      data: {
        zen: 'Keep it simple, automated, and local.',
        hookId: hook.id,
        url: hook.url,
      },
    };

    return this.sendDelivery(hook, 'ping', JSON.stringify(payload));
  }

  private async sendDelivery(
    hook: any,
    event: string,
    payloadString: string
  ): Promise<WebhookDeliveryResult> {
    const start = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SourceHub-Webhooks/1.0',
      'X-SourceHub-Event': event,
      'X-SourceHub-Delivery': crypto.randomUUID ? crypto.randomUUID() : `dlv-${Date.now()}`,
    };

    if (hook.secret) {
      const hmac = crypto.createHmac('sha256', hook.secret);
      hmac.update(payloadString);
      headers['X-Hub-Signature-256'] = `sha256=${hmac.digest('hex')}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const durationMs = Date.now() - start;

      return {
        webhookId: hook.id,
        url: hook.url,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const durationMs = Date.now() - start;
      return {
        webhookId: hook.id,
        url: hook.url,
        success: false,
        error: err.message || 'Connection failed',
        durationMs,
      };
    }
  }
}

export const webhookService = new WebhookService();
