import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TenantDashboardPage extends BasePage {
  readonly leaseRent: Locator;
  readonly payRentButton: Locator;

  constructor(page: Page) {
    super(page);
    this.leaseRent = page.getByTestId('lease-rent');
    this.payRentButton = page.getByTestId('pay-rent');
  }

  async goto(): Promise<void> {
    await this.navigate('/tenant');
  }

  async isLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/tenant$/);
  }

  async expectLeaseRent(text: string): Promise<void> {
    await expect(this.leaseRent).toHaveText(text);
  }

  async openPayRent(): Promise<void> {
    await this.click(this.payRentButton);
  }
}

export class PayRentPage extends BasePage {
  readonly rentAmount: Locator;
  readonly fee: Locator;
  readonly total: Locator;
  readonly cardName: Locator;
  readonly cardNumber: Locator;
  readonly cardExpiry: Locator;
  readonly cardCvc: Locator;
  readonly payButton: Locator;
  readonly receiptAmount: Locator;
  readonly receiptFee: Locator;
  readonly receiptTotal: Locator;

  constructor(page: Page) {
    super(page);
    this.rentAmount = page.getByTestId('rent-amount');
    this.fee = page.getByTestId('rent-fee');
    this.total = page.getByTestId('rent-total');
    this.cardName = page.getByTestId('card-name');
    this.cardNumber = page.getByTestId('card-number');
    this.cardExpiry = page.getByTestId('card-expiry');
    this.cardCvc = page.getByTestId('card-cvc');
    this.payButton = page.getByTestId('pay-submit');
    this.receiptAmount = page.getByTestId('receipt-amount');
    this.receiptFee = page.getByTestId('receipt-fee');
    this.receiptTotal = page.getByTestId('receipt-total');
  }

  async isLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/tenant\/pay$/);
    await expect(this.payButton).toBeVisible();
  }

  async expectBreakdown(rent: string, fee: string, total: string): Promise<void> {
    await expect(this.rentAmount).toHaveText(rent);
    await expect(this.fee).toHaveText(fee);
    await expect(this.total).toHaveText(total);
  }

  async payWithCard(card: { name: string; number: string; expiry: string; cvc: string }): Promise<void> {
    await this.fill(this.cardName, card.name);
    await this.fill(this.cardNumber, card.number);
    await this.fill(this.cardExpiry, card.expiry);
    await this.fill(this.cardCvc, card.cvc);
    await this.click(this.payButton);
  }

  async expectReceipt(rent: string, fee: string, total: string): Promise<void> {
    await expect(this.receiptAmount).toHaveText(rent);
    await expect(this.receiptFee).toHaveText(fee);
    await expect(this.receiptTotal).toHaveText(total);
  }
}
