import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LandlordDashboardPage extends BasePage {
  readonly credits: Locator;

  constructor(page: Page) {
    super(page);
    this.credits = page.getByTestId('stat-credits');
  }

  async goto(): Promise<void> {
    await this.navigate('/landlord');
  }

  async isLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/landlord$/);
    await expect(this.credits).toBeVisible();
  }

  async expectCredits(balance: number): Promise<void> {
    await expect(this.credits).toHaveText(String(balance));
  }
}

export class LandlordApplicationPage extends BasePage {
  readonly statusPill: Locator;
  readonly report: Locator;
  readonly reportIncome: Locator;
  readonly reportRatio: Locator;
  readonly reportScore: Locator;
  readonly reportRecommendation: Locator;
  readonly acceptButton: Locator;
  readonly confirmAccept: Locator;
  readonly decisionResult: Locator;

  constructor(page: Page) {
    super(page);
    this.statusPill = page.getByTestId('application-status').getByTestId('status-pill');
    this.report = page.getByTestId('screening-report');
    this.reportIncome = page.getByTestId('screening-income');
    this.reportRatio = page.getByTestId('screening-ratio');
    this.reportScore = page.getByTestId('screening-score');
    this.reportRecommendation = page.getByTestId('screening-recommendation');
    this.acceptButton = page.getByTestId('accept');
    this.confirmAccept = page.getByTestId('confirm-accept');
    this.decisionResult = page.getByTestId('decision-result');
  }

  async goto(applicationId: number): Promise<void> {
    await this.navigate(`/landlord/applications/${applicationId}`);
  }

  async isLoaded(): Promise<void> {
    await expect(this.statusPill).toBeVisible();
  }

  // The page refreshes itself every 2 s while the report is processing, so waiting on the state is enough.
  async expectStatus(status: string, timeout = 60_000): Promise<void> {
    await expect(this.statusPill).toHaveAttribute('data-status', status, { timeout });
  }

  async expectReport(opts: { income: string; ratio: string; recommendation: string }): Promise<void> {
    await expect(this.report).toBeVisible();
    await expect(this.reportIncome).toContainText(opts.income);
    await expect(this.reportRatio).toHaveText(opts.ratio);
    await expect(this.reportRecommendation).toContainText(opts.recommendation);
  }

  async score(): Promise<number> {
    return Number(await this.reportScore.innerText());
  }

  async accept(): Promise<void> {
    await this.click(this.acceptButton);
    await this.click(this.confirmAccept);
  }

  async expectDecision(text: string): Promise<void> {
    await expect(this.decisionResult).toContainText(text);
  }
}
