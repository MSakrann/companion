/**
 * Unit tests: WhatsApp 24h window decision (canSendFreeForm).
 */

import { canSendFreeForm } from '../../src/whatsapp/client';

describe('canSendFreeForm', () => {
  it('returns false when lastInboundAt is null', () => {
    expect(canSendFreeForm(null)).toBe(false);
  });

  it('returns true when last inbound was 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(canSendFreeForm(oneHourAgo)).toBe(true);
  });

  it('returns false when last inbound was 25 hours ago', () => {
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(canSendFreeForm(past)).toBe(false);
  });

  it('returns true when last inbound was exactly 24 hours ago (edge)', () => {
    const exactly24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(canSendFreeForm(exactly24h)).toBe(true);
  });

  it('returns true when last inbound was just now', () => {
    expect(canSendFreeForm(new Date())).toBe(true);
  });
});
