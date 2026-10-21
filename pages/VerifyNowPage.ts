import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** The (fake) VerifyNow identity provider's hosted page. */
export class VerifyNowPage extends BasePage {
  readonly next: Locator;
  readonly documentFile: Locator;
  readonly selfieFile: Locator;
  readonly decision: Locator;
  readonly submit: Locator;
  readonly done: Locator;
  readonly returnLink: Locator;

  constructor(page: Page) {
    super(page);
    this.next = page.getByTestId('vn-next');
    this.documentFile = page.getByTestId('vn-file-document');
    this.selfieFile = page.getByTestId('vn-file-selfie');
    this.decision = page.getByTestId('vn-scenario');
    this.submit = page.getByTestId('vn-submit');
    this.done = page.getByTestId('vn-done');
    this.returnLink = page.getByTestId('vn-return');
  }

  async isLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/verifynow\/session\/vn_/);
    await expect(this.next).toBeVisible();
  }

  /** Choose a document, upload the ID photo and selfie, pick the sandbox decision and submit. */
  async verifyIdentity(opts: { document: 'passport' | 'drivers_licence' | 'pr_card'; idImage: string; selfieImage: string; decision: 'approved' | 'declined' | 'resubmission_requested' | 'no_decision' }): Promise<void> {
    await this.page.getByTestId(`vn-doc-${opts.document}`).check();
    await this.click(this.next);
    await this.documentFile.setInputFiles(opts.idImage);
    await this.click(this.next);
    await this.selfieFile.setInputFiles(opts.selfieImage);
    await this.click(this.next);
    await this.decision.selectOption(opts.decision);
    await this.click(this.submit);
    await expect(this.done).toBeVisible();
  }

  async returnToRentNest(): Promise<void> {
    await this.click(this.returnLink);
  }
}
