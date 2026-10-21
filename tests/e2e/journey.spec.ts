import { test, expect } from '../../fixtures/pageFixtures';
import { config } from '../../config/env.config';
import { cardPayload, dateInDays, propertyPayload, uniqueEmail } from '../../helpers/data';

// One full journey: landlord adds a property -> new tenant applies in the UI (through the real
// VerifyNow and BankBridge pages) -> background report -> landlord accepts -> tenant pays rent.
// Setup that is not under test (landlord login, creating the property) is done through the API.
// Everything the user sees is asserted, and the same facts are checked again in the data.

const RENT = 2000; // dollars. 2.9% of $2,000.00 is exactly $58.00, so this test does not hit the fee rounding bug (D-17)

test('landlord lists a home, tenant applies and pays the first month', async ({
  api, signupPage, applyPage, verifyNowPage, bankBridgePage, tenantDashboardPage, payRentPage, landlordSession,
}) => {
  await api.setDelays(1000, 1000); // webhooks stay real, just quicker than the 5 s / 4 s defaults

  // ---- landlord: property created through the API (setup, not under test) ----
  const landlordToken = await api.landlordToken();
  const creditsBefore = await api.credits(landlordToken);
  expect(creditsBefore).toBe(3);
  const property = await api.createProperty(landlordToken, propertyPayload({ monthlyRent: RENT }));
  expect(property.monthlyRentCents).toBe(RENT * 100);

  // ---- tenant signs up in the UI from the apply link ----
  const email = uniqueEmail('e2e');
  await signupPage.goto('tenant', `/apply/${property.applyCode}`);
  await signupPage.isLoaded();
  await signupPage.signUp('Priya Shah', email, config.newTenantPassword);
  await applyPage.isLoaded();
  await applyPage.expectListing(property.title, '$2,000.00');

  // ---- step 1: personal details ----
  await applyPage.fillPersonalDetails({ firstName: 'Priya', lastName: 'Shah', dateOfBirth: '1994-03-21', phone: '4165550123', currentAddress: '10 Bay Street, Toronto' });
  await applyPage.next(1);

  // ---- step 2: identity, through the real VerifyNow pages ----
  await applyPage.startIdentityCheck();
  await verifyNowPage.isLoaded();
  await verifyNowPage.verifyIdentity({ document: 'passport', idImage: config.images.id, selfieImage: config.images.selfie, decision: 'approved' });
  await verifyNowPage.returnToRentNest();
  await applyPage.isLoaded();
  await applyPage.expectIdentityStatus('approved'); // waits while the page polls the server
  await expect(applyPage.identityApproved).toBeVisible();
  await applyPage.next(2);

  // ---- step 3: income, through the real BankBridge pages ----
  // The BankBridge round trip comes first: the employment fields typed before leaving the page
  // are not saved by the app (only the step number is), so they are filled in after coming back.
  await applyPage.startIncomeCheck();
  await bankBridgePage.isLoaded();
  await bankBridgePage.connectBank('maple', config.bank.user, config.bank.password);
  await bankBridgePage.returnToRentNest();
  await applyPage.isLoaded();
  // The income box does not refresh by itself (known bug), so wait
  // until the server has the result, then reload the page to show it.
  await expect.poll(async () => (await api.sql('SELECT income_status FROM applications ORDER BY id DESC LIMIT 1'))[0][0]).toBe('verified');
  await applyPage.reload();
  await expect(applyPage.incomeVerified).toContainText('$6,850.00');
  await applyPage.fillEmployment({ type: 'Full-time', employer: 'Acme Corp', jobTitle: 'Analyst', monthlyIncome: '6850', yearsAtJob: '3' });
  await applyPage.next(3);

  // ---- step 4: household ----
  await applyPage.fillHousehold({ moveInDate: dateInDays(30), occupants: '1', hasPets: false });
  await applyPage.next(4);

  // ---- step 5: review and submit ----
  await expect(applyPage.review).toContainText('Priya Shah');
  await expect(applyPage.review).toContainText('Verified ✓');
  await applyPage.submitApplication();

  // ---- landlord (own browser session): the report is built in the background ----
  const { loginPage, dashboardPage, applicationPage } = landlordSession;
  await loginPage.goto();
  await loginPage.login(config.landlord.email, config.landlord.password);
  await dashboardPage.isLoaded();

  const [[applicationId]] = await api.sql(`SELECT id FROM applications WHERE property_id = ${property.id}`);
  await applicationPage.goto(applicationId);
  await applicationPage.expectStatus('ready'); // the page refreshes itself while the report is processing
  await applicationPage.expectReport({ income: '$6,850.00', ratio: '29.2%', recommendation: 'Recommended' }); // 2000 / 6850
  const score = await applicationPage.score();
  expect(score).toBeGreaterThanOrEqual(300);
  expect(score).toBeLessThanOrEqual(900);

  // ---- landlord accepts ----
  await applicationPage.accept();
  await applicationPage.expectDecision('Accepted');
  await dashboardPage.goto();
  await dashboardPage.expectCredits(2); // one credit used by the report

  // ---- tenant pays the first month with the test card ----
  await tenantDashboardPage.goto();
  await tenantDashboardPage.expectLeaseRent('$2,000.00');
  await tenantDashboardPage.openPayRent();
  await payRentPage.isLoaded();
  await payRentPage.expectBreakdown('$2,000.00', '$58.00', '$2,058.00');
  await payRentPage.payWithCard(cardPayload(config.card, 'Priya Shah'));
  await payRentPage.expectReceipt('$2,000.00', '$58.00', '$2,058.00');

  // ---- the data behind it (API + database) ----
  const tenantToken = await api.login(email, config.newTenantPassword);
  const application = await api.getApplication(tenantToken, applicationId);
  expect(application.status).toBe('accepted');
  expect(application.identity.status).toBe('approved');
  expect(application.income.status).toBe('verified');
  expect(application.income.verifiedMonthlyIncomeCents).toBe(685000);

  const payments = await api.sql('SELECT amount_cents, fee_cents, total_cents, status, split_count FROM payments');
  expect(payments).toEqual([[200000, 5800, 205800, 'succeeded', 1]]);

  const [[propertyStatus]] = await api.sql(`SELECT status FROM properties WHERE id = ${property.id}`);
  expect(propertyStatus).toBe('leased');

  expect(await api.credits(landlordToken)).toBe(creditsBefore - 1);
  const ledger = await api.sql(`SELECT change, balance_after FROM credit_transactions WHERE application_id = ${applicationId}`);
  expect(ledger).toEqual([[-1, creditsBefore - 1]]); // charged once, for this application only
  const jobs = await api.sql(`SELECT type, status FROM jobs WHERE application_id = ${applicationId} ORDER BY id`);
  expect(jobs).toEqual([['collect_results', 'succeeded'], ['build_report', 'succeeded'], ['notify_landlord', 'succeeded']]);
});
