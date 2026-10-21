import { test, expect } from '../../fixtures/pageFixtures';
import { knownBug } from '../../helpers/bugs';
import { cardPayload, propertyPayload } from '../../helpers/data';
import { config } from '../../config/env.config';
import type { Api } from '../../helpers/api';

// API-level checks for access control, input validation and payment errors.
// Tests marked knownBug() describe a REAL BUG. They are expected to fail;
// if the app gets fixed they will start passing and Playwright will flag that.

const succeededPayments = async (api: Api) =>
  Number((await api.sql("SELECT COUNT(*) FROM payments WHERE status = 'succeeded'"))[0][0]);

test.describe('access control', () => {
  test('anonymous user cannot use protected endpoints', async ({ api }) => {
    for (const [method, path] of [['GET', '/api/properties'], ['GET', '/api/lease'], ['POST', '/api/payments'], ['GET', '/api/credits']] as const) {
      expect((await api.call(method, path)).status, `${method} ${path}`).toBe(401);
    }
  });

  test('tenant cannot use landlord endpoints', async ({ api }) => {
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    expect((await api.call('GET', '/api/properties', { token })).status).toBe(403);
    expect((await api.call('POST', '/api/properties', { token, data: propertyPayload() })).status).toBe(403);
    expect((await api.call('GET', '/api/credits', { token })).status).toBe(403);
  });

  test('landlord cannot use tenant endpoints', async ({ api }) => {
    const token = await api.landlordToken();
    expect((await api.call('GET', '/api/lease', { token })).status).toBe(403);
    expect((await api.call('POST', '/api/payments', { token, data: { splitCount: 1, card: cardPayload() } })).status).toBe(403);
  });

  test('another landlord cannot open the property, report or decision of someone else', async ({ api }) => {
    const token = await api.login(config.landlord2.email, config.landlord2.password);
    expect((await api.call('GET', '/api/properties/1', { token })).status).toBe(404);
    expect((await api.call('GET', '/api/applications/2/report', { token })).status).toBe(404);
    expect((await api.call('POST', '/api/applications/2/decision', { token, data: { decision: 'accept' } })).status).toBe(404);
  });

  test('BUG D-02: a tenant can read another tenant\'s application', async ({ api }) => {
    knownBug('D-02: GET /api/applications/:id returns 200 with full personal details to any logged-in user');
    const tenantC = await api.login('tenant.c@rentnest.test', 'Tenant@123'); // owns application 3, not 2
    const res = await api.call('GET', '/api/applications/2', { token: tenantC }); // application 2 belongs to tenant B
    expect([403, 404]).toContain(res.status);
  });

  test('BUG D-03: the token still works after logout', async ({ api }) => {
    knownBug('D-03: after POST /api/auth/logout the same token still returns 200 on /api/auth/me');
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    expect((await api.call('POST', '/api/auth/logout', { token })).status).toBe(204);
    expect((await api.call('GET', '/api/auth/me', { token })).status).toBe(401);
  });
});

test.describe('property input validation', () => {
  test('rent, deposit, bedrooms, postal code and title limits', async ({ api }) => {
    const token = await api.landlordToken();
    const create = (overrides: Record<string, unknown>) => api.call('POST', '/api/properties', { token, data: propertyPayload(overrides) });

    for (const [field, value] of [
      ['monthlyRent', 0], ['monthlyRent', 50000.01], ['deposit', 100000.01],
      ['bedrooms', 11], ['bedrooms', -1], ['postalCode', '12345'], ['title', 't'.repeat(101)],
    ] as const) {
      const res = await create({ [field]: value });
      expect(res.status, `${field}=${String(value).slice(0, 10)}`).toBe(400);
      expect(Object.keys(res.body.fields), `${field} error`).toContain(field);
    }
    expect((await create({ monthlyRent: 50000 })).status).toBe(201); // upper boundary is allowed
    expect((await create({ bedrooms: 0 })).status).toBe(201); // studio
  });

  test('BUG D-21: rent below $1 is accepted', async ({ api }) => {
    knownBug('D-21: monthlyRent 0.99 returns 201 and is saved as 0 cents');
    const token = await api.landlordToken();
    const res = await api.call('POST', '/api/properties', { token, data: propertyPayload({ monthlyRent: 0.99 }) });
    expect(res.status).toBe(400);
  });

  test('BUG D-01: cents of the rent are dropped', async ({ api }) => {
    knownBug('D-01: monthlyRent 1850.75 is saved as 185000 cents, not 185075');
    const token = await api.landlordToken();
    const res = await api.call('POST', '/api/properties', { token, data: propertyPayload({ monthlyRent: 1850.75 }) });
    expect(res.body.property.monthlyRentCents).toBe(185075);
  });

  test('BUG D-09: postal code without a space is rejected', async ({ api }) => {
    knownBug('D-09: T2P1K5 returns 400, spec says it must be accepted and stored as T2P 1K5');
    const token = await api.landlordToken();
    const res = await api.call('POST', '/api/properties', { token, data: propertyPayload({ postalCode: 't2p1k5', province: 'AB' }) });
    expect(res.status).toBe(201);
    expect(res.body.property.postalCode).toBe('T2P 1K5');
  });
});

test.describe('rent payments (seeded tenant A, rent $1,795.00)', () => {
  const pay = (api: Api, token: string, number: string, splitCount = 1) =>
    api.call('POST', '/api/payments', { token, data: { splitCount, card: cardPayload(number, 'Arjun Mehta') } });

  test('declined and insufficient-funds cards return 402 and the month stays unpaid', async ({ api }) => {
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    expect((await pay(api, token, '4000 0000 0000 0002')).status).toBe(402);
    expect((await pay(api, token, '4000 0000 0000 9995')).status).toBe(402);
    expect((await api.call('GET', '/api/lease', { token })).body.lease.currentPeriodPaid).toBe(false);
    expect(await succeededPayments(api)).toBe(0);
  });

  test('a second payment for the same month is refused (one after the other)', async ({ api }) => {
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    expect((await pay(api, token, config.card)).status).toBe(201);
    expect((await pay(api, token, config.card)).status).toBe(409);
    expect(await succeededPayments(api)).toBe(1);
  });

  test('invalid card details return field errors and take no payment', async ({ api }) => {
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    const res = await api.call('POST', '/api/payments', { token, data: { splitCount: 1, card: { ...cardPayload(), number: '4242424242424243', expiry: '13/99', cvc: '12', name: '' } } });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['cvc', 'expiry', 'name', 'number']);
    expect(await succeededPayments(api)).toBe(0);
  });

  test('BUG D-17: card fee rounds half a cent down', async ({ api }) => {
    knownBug('D-17: 2.9% of 179500 is 5205.5, spec says round half up = 5206, app returns 5205');
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    const quote = (await api.call('POST', '/api/payments/quote', { token, data: { splitCount: 1 } })).body.quote;
    expect(quote.feeCents).toBe(5206);
    expect(quote.totalCents).toBe(184706);
  });

  test('BUG D-18: split shares do not add up to the rent', async ({ api }) => {
    knownBug('D-18: 179500 split 3 ways gives 3 x 59833 = 179499, the extra cent must go to share 1');
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    const quote = (await api.call('POST', '/api/payments/quote', { token, data: { splitCount: 3 } })).body.quote;
    expect(quote.sharesCents).toEqual([59834, 59833, 59833]);
  });

  test('BUG D-19: parallel payments charge the tenant more than once', async ({ api }) => {
    knownBug('D-19: 3 payments sent at the same time all succeed for the same month');
    const token = await api.login(config.tenantA.email, config.tenantA.password);
    await Promise.all([1, 2, 3].map(() => pay(api, token, config.card)));
    expect(await succeededPayments(api)).toBe(1);
  });
});
