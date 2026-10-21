# RentNest automation (Playwright + TypeScript)

Automated tests for the RentNest QA assessment.

## Setup and run

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

Useful variants: `npm run test:headed` (watch the browser), `npx playwright test tests/api` (one folder).

> **Warning:** every test calls `POST /api/dev/reset`, which restores the demo data and logs everyone out. Do not point `BASE_URL` at an app whose data you want to keep.
