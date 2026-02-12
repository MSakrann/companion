/**
 * Meta WhatsApp Cloud API: send text and template messages.
 */

import { getConfig } from '../config';
import { getLogger } from '../lib/logger';

const logger = getLogger('whatsapp');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface WhatsAppApiClient {
  sendText(toPhoneE164: string, text: string): Promise<string | null>;
  sendTemplate(toPhoneE164: string, templateName: string, languageCode: string, components?: TemplateComponent[]): Promise<string | null>;
}

export interface TemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: Array<{ type: 'text'; text: string }>;
}

function toWhatsAppPhone(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '');
}

export class DefaultWhatsAppApiClient implements WhatsAppApiClient {
  private accessToken: string;
  private phoneNumberId: string;

  constructor(accessToken?: string, phoneNumberId?: string) {
    const config = getConfig();
    this.accessToken = accessToken ?? config.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = phoneNumberId ?? config.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendText(toPhoneE164: string, text: string): Promise<string | null> {
    const url = `${GRAPH_BASE}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toWhatsAppPhone(toPhoneE164),
      type: 'text',
      text: { body: text },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) {
      logger.warn({ status: res.status, data }, 'WhatsApp send text failed');
      return null;
    }
    return data.messages?.[0]?.id ?? null;
  }

  async sendTemplate(
    toPhoneE164: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[]
  ): Promise<string | null> {
    const url = `${GRAPH_BASE}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toWhatsAppPhone(toPhoneE164),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components ?? [],
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) {
      logger.warn({ status: res.status, data }, 'WhatsApp send template failed');
      return null;
    }
    return data.messages?.[0]?.id ?? null;
  }
}

/**
 * Decide whether we can send a free-form text message (within 24h of last inbound)
 * or must send an approved template (e.g. CHECKIN).
 */
export function canSendFreeForm(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  const now = new Date();
  const diffMs = now.getTime() - lastInboundAt.getTime();
  const hours24 = 24 * 60 * 60 * 1000;
  return diffMs <= hours24;
}
