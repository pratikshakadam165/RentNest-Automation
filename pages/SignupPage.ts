import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignupPage extends BasePage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByTestId('signup-name');
    this.emailInput = page.getByTestId('signup-email');
    this.passwordInput = page.getByTestId('signup-password');
    this.confirmInput = page.getByTestId('signup-confirm');
    this.submitButton = page.getByTestId('signup-submit');
  }

  /** Opens the signup page as a tenant and returns to `next` (for example the apply link) afterwards. */
  async goto(role: 'tenant' | 'landlord', next?: string): Promise<void> {
    await this.navigate(`/signup?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  }

  async isLoaded(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async signUp(fullName: string, email: string, password: string): Promise<void> {
    await this.fill(this.nameInput, fullName);
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
    await this.fill(this.confirmInput, password);
    await this.click(this.submitButton);
  }
}
