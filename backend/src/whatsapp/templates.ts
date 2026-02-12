/**
 * Template names and variable builders for OPTIN and CHECKIN.
 */

import { getConfig } from '../config';
import type { TemplateComponent } from './client';

export function getOptInTemplateName(): string {
  return getConfig().TEMPLATE_OPTIN_NAME;
}

export function getCheckInTemplateName(): string {
  return getConfig().TEMPLATE_CHECKIN_NAME;
}

/**
 * Build body component with 1 variable (e.g. user name).
 */
export function buildBodyComponent(variableTexts: string[]): TemplateComponent[] {
  if (variableTexts.length === 0) return [];
  return [
    {
      type: 'body',
      parameters: variableTexts.map((text) => ({ type: 'text' as const, text })),
    },
  ];
}

/**
 * CHECKIN template: e.g. "Hi {{1}}, just checking in. How are you?"
 * Pass [userName].
 */
export function buildCheckInComponents(userName: string): TemplateComponent[] {
  return buildBodyComponent([userName]);
}
