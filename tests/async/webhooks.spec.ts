import { test, expect } from '../../fixtures/pageFixtures';

// Asynchronous behaviour: provider results arriving by webhook.
// The /api/dev hooks send the webhook instantly, so the tests are fast and predictable.

let applyCode: string;

// Before each test: no delay for webhooks, and the landlord adds a property to apply to.
test.beforeEach(async ({ api }) => {
  await api.setDelays(0, 0);
  const landlord = await api.landlordToken();
  applyCode = (await api.createProperty(landlord)).applyCode;
});

// Test 1: VerifyNow says "declined" -> the tenant sees it and cannot continue.
test('declined identity: the tenant sees it and cannot continue', async ({ api, tenantApi, applyPage }) => {
  const tenant = await tenantApi.signupTenant(); // also logs the browser in
  const appId = await api.startDraft(tenant.token, applyCode, 2);
  const session = await api.startIdentity(tenant.token, appId);

  await api.identityDecision(session, 'declined'); // send the webhook
  await api.untilStatus(appId, 'identity', 'declined'); // wait until the app has applied it

  await applyPage.goto(applyCode);
  await expect(applyPage.identityDeclined).toBeVisible();
  await applyPage.expectNextDisabled(2);
});

// Test 2: a webhook with a wrong signature is rejected and changes nothing.
test('a webhook with a wrong signature is rejected and changes nothing', async ({ api }) => {
  const tenant = await api.signupTenant();
  const appId = await api.startDraft(tenant.token, applyCode, 2);
  const session = await api.startIdentity(tenant.token, appId);

  const event = {
    eventId: `evt_test_${Date.now()}`,
    type: 'verification.decision',
    createdAt: new Date().toISOString(),
    data: { sessionId: session, status: 'approved', reason: null },
  };
  const res = await api.postWebhook('verifynow', event, '00'.repeat(32)); // fake signature

  expect(res.status).toBe(401); // rejected
  expect((await api.statuses(appId)).identity).toBe('started'); // status did not change
});
