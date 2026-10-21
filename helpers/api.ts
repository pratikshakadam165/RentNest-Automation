import { APIRequestContext, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { config } from '../config/env.config';
import { applicationPayload, propertyPayload, uniqueEmail } from './data';

export type Reply = { status: number; body: any };
type CallOptions = { token?: string; data?: unknown; headers?: Record<string, string>; raw?: string };

/** Thin wrapper over Playwright's request context for the RentNest API. */
export class Api {
  constructor(private ctx: APIRequestContext) {}

  /** Returns status and parsed body without throwing, so negative tests can assert on both. */
  async call(method: 'GET' | 'POST' | 'PATCH', path: string, opts: CallOptions = {}): Promise<Reply> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await this.ctx.fetch(path, {
      method,
      headers: opts.raw !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      data: opts.raw !== undefined ? opts.raw : opts.data,
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status(), body };
  }

  private async ok(reply: Reply, what: string): Promise<any> {
    if (reply.status >= 400) throw new Error(`${what} failed: ${reply.status} ${JSON.stringify(reply.body)}`);
    return reply.body;
  }

  // ---- test support -------------------------------------------------------
  async reset() { await this.ok(await this.call('POST', '/api/dev/reset'), 'reset'); }

  async setDelays(identityMs: number, incomeMs: number) {
    await this.ok(await this.call('POST', '/api/dev/settings', {
      data: { identityDecisionDelayMs: identityMs, incomeReportDelayMs: incomeMs },
    }), 'settings');
  }

  async sql(query: string): Promise<any[][]> {
    return (await this.ok(await this.call('POST', '/api/dev/sql', { data: { sql: query } }), 'sql')).rows;
  }

  identityDecision(sessionId: string, status: 'approved' | 'declined' | 'resubmission_requested') {
    return this.call('POST', `/api/dev/providers/verifynow/sessions/${sessionId}/decision`, { data: { status } });
  }

  /** Sign and post a webhook the way a provider would. Pass `signature: null` to send none. */
  postWebhook(provider: 'verifynow' | 'bankbridge', event: object, signature?: string | null) {
    const raw = JSON.stringify(event);
    const header = provider === 'verifynow' ? 'X-VerifyNow-Signature' : 'X-BankBridge-Signature';
    const sig = signature === undefined
      ? crypto.createHmac('sha256', config.secrets[provider]).update(raw).digest('hex')
      : signature;
    return this.call('POST', `/api/webhooks/${provider}`, { raw, headers: sig ? { [header]: sig } : {} });
  }

  // ---- accounts and data --------------------------------------------------
  async login(email: string, password: string): Promise<string> {
    return (await this.ok(await this.call('POST', '/api/auth/login', { data: { email, password } }), 'login')).token;
  }

  async landlordToken() { return this.login(config.landlord.email, config.landlord.password); }

  async signupTenant(email = uniqueEmail()): Promise<{ token: string; email: string }> {
    const body = await this.ok(await this.call('POST', '/api/auth/signup', {
      data: { role: 'tenant', fullName: 'Test Tenant', email, password: config.newTenantPassword },
    }), 'signup');
    return { token: body.token, email };
  }

  async createProperty(token: string, overrides: Record<string, unknown> = {}) {
    return (await this.ok(await this.call('POST', '/api/properties', { token, data: propertyPayload(overrides) }), 'create property')).property;
  }

  async getApplication(token: string, id: number) {
    return (await this.ok(await this.call('GET', `/api/applications/${id}`, { token }), 'get application')).application;
  }

  async credits(token: string): Promise<number> {
    return (await this.ok(await this.call('GET', '/api/credits', { token }), 'credits')).balance;
  }

  /** Start (or resume) a draft and save some fields, so the apply page opens on `step`. */
  async startDraft(token: string, applyCode: string, step: number, fields: Record<string, unknown> = {}) {
    const app = (await this.ok(await this.call('POST', '/api/applications', { token, data: { applyCode } }), 'start application')).application;
    const { firstName, lastName, dateOfBirth, phone, currentAddress } = applicationPayload();
    await this.ok(await this.call('PATCH', `/api/applications/${app.id}`, {
      token, data: { firstName, lastName, dateOfBirth, phone, currentAddress, ...fields, currentStep: step },
    }), 'save draft');
    return app.id as number;
  }

  async startIdentity(token: string, appId: number): Promise<string> {
    return (await this.ok(await this.call('POST', `/api/applications/${appId}/identity/start`, { token }), 'identity start')).sessionId;
  }

  /** Current identity / income status straight from the database. */
  async statuses(appId: number) {
    const [row] = await this.sql(`SELECT status, identity_status, income_status FROM applications WHERE id = ${Number(appId)}`);
    return { application: row[0] as string, identity: row[1] as string, income: row[2] as string };
  }

  /** Wait (polling, no fixed sleep) until the application has the expected identity / income status. */
  async untilStatus(appId: number, field: 'application' | 'identity' | 'income', value: string) {
    await expect.poll(async () => (await this.statuses(appId))[field], { message: `${field} status of application ${appId}` }).toBe(value);
  }
}
