import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** The (fake) BankBridge provider's hosted page. */
export class BankBridgePage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly allowButton: Locator;
  readonly done: Locator;
  readonly returnLink: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByTestId('bb-username');
    this.password = page.getByTestId('bb-password');
    this.loginButton = page.getByTestId('bb-login');
    this.allowButton = page.getByTestId('bb-consent-allow');
    this.done = page.getByTestId('bb-done');
    this.returnLink = page.getByTestId('bb-return');
  }

  async isLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/bankbridge\/connect\/bb_/);
  }

  /** Pick a bank, log in with a sandbox user and allow access. */
  async connectBank(bank: 'maple' | 'northern' | 'prairie', username: string, password: string): Promise<void> {
    await this.click(this.page.getByTestId(`bb-bank-${bank}`));
    await this.fill(this.username, username);
    await this.fill(this.password, password);
    await this.click(this.loginButton);
    await this.click(this.allowButton);
    await expect(this.done).toBeVisible();
  }

  async returnToRentNest(): Promise<void> {
    await this.click(this.returnLink);
  }
}
