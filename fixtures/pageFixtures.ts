import { test as base } from '@playwright/test';
import { Api } from '../helpers/api';
import { SignupPage } from '../pages/SignupPage';
import { LoginPage } from '../pages/LoginPage';
import { ApplyPage } from '../pages/ApplyPage';
import { VerifyNowPage } from '../pages/VerifyNowPage';
import { BankBridgePage } from '../pages/BankBridgePage';
import { LandlordDashboardPage, LandlordApplicationPage } from '../pages/LandlordPages';
import { TenantDashboardPage, PayRentPage } from '../pages/TenantPages';

// New fixtures are created in this file. A test only lists the ones it needs.

/** The landlord works in a second, separate browser session next to the tenant. */
type LandlordSession = {
  loginPage: LoginPage;
  dashboardPage: LandlordDashboardPage;
  applicationPage: LandlordApplicationPage;
};

type Fixtures = {
  api: Api;
  tenantApi: Api;
  signupPage: SignupPage;
  applyPage: ApplyPage;
  verifyNowPage: VerifyNowPage;
  bankBridgePage: BankBridgePage;
  tenantDashboardPage: TenantDashboardPage;
  payRentPage: PayRentPage;
  landlordSession: LandlordSession;
};

export const test = base.extend<Fixtures>({
  // API client. Every test that uses it starts from freshly reset demo data.
  // Reset ends all sessions, so tests must log in after it (they do, because they use this fixture first).
  api: async ({ request }, use) => {
    const api = new Api(request);
    await api.reset();
    await use(api);
  },

  // API client that shares the browser's cookies: signing up with it also logs the browser in.
  tenantApi: async ({ page, api }, use) => {
    void api; // make sure the reset has happened first
    await use(new Api(page.request));
  },

  signupPage: async ({ page }, use) => { await use(new SignupPage(page)); },
  applyPage: async ({ page }, use) => { await use(new ApplyPage(page)); },
  verifyNowPage: async ({ page }, use) => { await use(new VerifyNowPage(page)); },
  bankBridgePage: async ({ page }, use) => { await use(new BankBridgePage(page)); },
  tenantDashboardPage: async ({ page }, use) => { await use(new TenantDashboardPage(page)); },
  payRentPage: async ({ page }, use) => { await use(new PayRentPage(page)); },

  landlordSession: async ({ browser }, use) => {
    const context = await browser.newContext({ recordVideo: { dir: 'test-results/landlord-video' } });
    const page = await context.newPage();
    await use({
      loginPage: new LoginPage(page),
      dashboardPage: new LandlordDashboardPage(page),
      applicationPage: new LandlordApplicationPage(page),
    });
    await context.close();
  },
});

export { expect } from '@playwright/test';
