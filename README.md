# RentNest automation (Playwright + TypeScript)

Automated tests for the RentNest QA assessment: one end-to-end journey, asynchronous (webhook and job) tests, and API/negative tests.

## Run it

You need Node.js 18+ and the RentNest app running.

```bash
# 1. start the app (in the RentNest folder)
npm start                          # http://localhost:4000

# 2. in this folder
npm install
npx playwright install chromium
npm test                           # settings are in config/.env.qa, change BASE_URL there if the app is not on port 4000
npm run report                     # opens the HTML report
```

Useful variants: `npm run test:headed` (watch the browser), `npx playwright test tests/api` (one folder), `TEST_ENV=staging npm test` (uses `config/.env.staging`), `SHOW_BUGS=1 npm test` (see the real failure message of every known bug, see below).

> **Warning:** every test calls `POST /api/dev/reset`, which restores the demo data and logs everyone out. Do not point `BASE_URL` at an app whose data you want to keep.

## What is tested

| File | Tests | How |
|---|---|---|
| `tests/e2e/journey.spec.ts` | Landlord property, new tenant signs up and completes all 5 steps, through the real VerifyNow and BankBridge pages, background report, landlord accepts, tenant pays with the test card | UI, with the data checked again through the API and database |
| `tests/async/webhooks.spec.ts` | Declined and resubmitted identity, wrong / missing signature, duplicate event, out-of-order event, income page auto-update, failed report job | API test hooks, UI where the user's view is the point |
| `tests/api/negative.spec.ts` | Access control, property input validation, payment errors, fee rounding, split rent, double charge, logout | API only |

The end-to-end test asserts what the user sees, then checks the data: application, identity and income statuses, income 685000 cents, payment 200000 / 5800 / 205800 cents, property leased, landlord credits 3 to 2 with one ledger row, and the three jobs succeeded.

### Why UI in one place and hooks in another
- **UI (end-to-end):** the journey is the thing under test, and the task asks to go through the provider pages at least once. The provider delays are set to 1 s so the webhooks stay real but quick. Setting up the landlord and the property through the API is deliberate: it is not what is being tested.
- **Hooks (async tests):** these tests are about how the server reacts to a webhook that is repeated, out of order, badly signed or missing, or to a job that fails. The `/api/dev` hooks send the same signed webhooks at exactly the moment the test wants, so the tests are fast and not dependent on timing. The UI is used only where what the user sees is the point (declined and resubmitted identity, income box).

## Rules the tests follow
- **Repeatable and in any order:** one worker, each test resets the data first and logs in after the reset, and every new user has a unique email.
- **No fixed sleeps:** the tests wait for the state they expect (`expect(...)`, `expect.poll(...)`) with timeouts, no `waitForTimeout`.
- **No hard-coded config:** URL, users, card, bank login and webhook secrets are in `config/.env.qa` (the accounts are the demo users and the secrets are the public sandbox values from the app's API.md).

## Known bugs: tests that are expected to fail
A test that proves a real bug is kept and marked with `knownBug('D-xx: ...')` (a wrapper around `test.fail()`). It shows as a passing test while the bug exists, and Playwright reports it as a failure the day the bug is fixed. Run `SHOW_BUGS=1 npm test` to switch the marking off and read the real failure messages.

| ID | Bug (what the test expects vs what happens) | Test file |
|---|---|---|
| D-01 | Rent 1850.75 should be saved as 185075 cents, saved as 185000 | tests/api |
| D-02 | A tenant should not read another tenant's application, gets 200 with their details | tests/api |
| D-03 | After logout the token should stop working, still returns 200 | tests/api |
| D-06 | Application with declined identity should not be submittable (API 200); Next stays enabled after "resubmission requested" (UI) | tests/async |
| D-09 | Postal code without a space (T2P1K5) should be accepted, gets 400 | tests/api |
| D-11 | An approved identity should not change after a late "declined" event | tests/async |
| D-12 | A webhook with no signature should get 401, gets 200 and is applied | tests/async |
| D-13 | Replaying an old event (same eventId) should have no effect, it is applied again | tests/async |
| D-14 | A failed report job should show "Report failed", shows "Ready" | tests/async |
| D-17 | Card fee on $1,795.00 should round half a cent up to 5206, gives 5205 | tests/api |
| D-18 | 179500 split 3 ways should give 59834 / 59833 / 59833, the extra cent is lost | tests/api |
| D-19 | Three payments sent at the same time should charge once, all three succeed | tests/api |
| D-21 | Rent 0.99 should be rejected, is saved as 0 cents | tests/api |
| (no ID) | The income box should update by itself when the result arrives, it stays on "Waiting" until the page is reloaded | tests/async |

## Project layout (page object model)
```
rentnest-automation/
├── config/
│   ├── .env.qa             URL, demo users, test card, bank login, webhook secrets (TEST_ENV=qa is the default)
│   └── env.config.ts       reads those values into one typed `config` object
├── pages/                  one class per screen: locators in the constructor, methods for what a user does
│   ├── BasePage.ts         shared click / fill / navigate, and the abstract isLoaded()
│   ├── SignupPage.ts, LoginPage.ts, ApplyPage.ts
│   ├── VerifyNowPage.ts, BankBridgePage.ts       the two provider pages
│   ├── LandlordPages.ts    LandlordDashboardPage, LandlordApplicationPage
│   └── TenantPages.ts      TenantDashboardPage, PayRentPage
├── fixtures/
│   └── pageFixtures.ts     creates the page objects and the API client; tests just ask for them by name
├── helpers/
│   ├── api.ts              small client for the RentNest API, test hooks and signed webhooks
│   ├── data.ts             unique emails, sample property / application / card data
│   └── bugs.ts             knownBug() wrapper
├── tests/
│   ├── e2e/journey.spec.ts
│   ├── async/webhooks.spec.ts
│   └── api/negative.spec.ts
├── test-data/              sample ID and selfie images for VerifyNow
├── report/                 HTML report and videos of a full run
└── playwright.config.ts
```

How the pieces fit: a test asks for fixtures (`async ({ api, signupPage, applyPage }) => ...`), the fixtures build the page objects, and the test reads like the user's story (`applyPage.fillPersonalDetails(...)`, `verifyNowPage.verifyIdentity(...)`). Locators and waiting live only in `pages/`. The `api` fixture resets the app's data before each test and the landlord works in a separate browser session (`landlordSession`).
