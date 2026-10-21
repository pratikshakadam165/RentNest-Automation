import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type PersonalDetails = { firstName: string; lastName: string; dateOfBirth: string; phone: string; currentAddress: string };
export type Employment = { type: string; employer: string; jobTitle: string; monthlyIncome: string; yearsAtJob: string };
export type Household = { moveInDate: string; occupants: string; hasPets: boolean };

/** The public apply page: listing summary and the 5-step application wizard. */
export class ApplyPage extends BasePage {
  readonly wizard: Locator;
  readonly propertyTitle: Locator;
  readonly rent: Locator;

  // step 1
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly dateOfBirth: Locator;
  readonly phone: Locator;
  readonly currentAddress: Locator;
  // step 2
  readonly identityStart: Locator;
  readonly identityStatus: Locator;
  readonly identityApproved: Locator;
  readonly identityDeclined: Locator;
  // step 3
  readonly employmentType: Locator;
  readonly employer: Locator;
  readonly jobTitle: Locator;
  readonly monthlyIncome: Locator;
  readonly yearsAtJob: Locator;
  readonly incomeStart: Locator;
  readonly incomeVerified: Locator;
  // step 4
  readonly moveInDate: Locator;
  readonly occupants: Locator;
  readonly petsYes: Locator;
  readonly petsNo: Locator;
  // step 5
  readonly review: Locator;
  readonly consent: Locator;
  readonly submitButton: Locator;
  readonly submittedMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.wizard = page.getByTestId('application-wizard');
    this.propertyTitle = page.getByTestId('apply-property-title');
    this.rent = page.getByTestId('apply-rent');
    this.firstName = page.getByTestId('app-first-name');
    this.lastName = page.getByTestId('app-last-name');
    this.dateOfBirth = page.getByTestId('app-dob');
    this.phone = page.getByTestId('app-phone');
    this.currentAddress = page.getByTestId('app-current-address');
    this.identityStart = page.getByTestId('identity-start');
    this.identityStatus = page.getByTestId('identity-status');
    this.identityApproved = page.getByTestId('identity-approved');
    this.identityDeclined = page.getByTestId('identity-declined');
    this.employmentType = page.getByTestId('app-employment-type');
    this.employer = page.getByTestId('app-employer');
    this.jobTitle = page.getByTestId('app-job-title');
    this.monthlyIncome = page.getByTestId('app-monthly-income');
    this.yearsAtJob = page.getByTestId('app-years');
    this.incomeStart = page.getByTestId('income-start');
    this.incomeVerified = page.getByTestId('income-verified');
    this.moveInDate = page.getByTestId('app-move-in');
    this.occupants = page.getByTestId('app-occupants');
    this.petsYes = page.getByTestId('app-pets-yes');
    this.petsNo = page.getByTestId('app-pets-no');
    this.review = page.getByTestId('app-review');
    this.consent = page.getByTestId('app-consent');
    this.submitButton = page.getByTestId('app-submit');
    this.submittedMessage = page.getByTestId('application-submitted');
  }

  step(n: number): Locator {
    return this.page.locator(`form.step[data-step="${n}"]`);
  }

  async goto(applyCode: string): Promise<void> {
    await this.navigate(`/apply/${applyCode}`);
  }

  async isLoaded(): Promise<void> {
    await expect(this.wizard).toBeVisible();
  }

  async expectListing(title: string, rent: string): Promise<void> {
    await expect(this.propertyTitle).toHaveText(title);
    await expect(this.rent).toHaveText(rent);
  }

  async next(step: number): Promise<void> {
    await this.click(this.step(step).getByTestId('app-next'));
  }

  async expectNextDisabled(step: number): Promise<void> {
    await expect(this.step(step).getByTestId('app-next')).toBeDisabled();
  }

  // ---- step 1 ----
  async fillPersonalDetails(d: PersonalDetails): Promise<void> {
    await this.fill(this.firstName, d.firstName);
    await this.fill(this.lastName, d.lastName);
    await this.fill(this.dateOfBirth, d.dateOfBirth);
    await this.fill(this.phone, d.phone);
    await this.fill(this.currentAddress, d.currentAddress);
  }

  // ---- step 2 ----
  async startIdentityCheck(): Promise<void> {
    await this.click(this.identityStart); // leaves RentNest for VerifyNow ("Try again" uses the same button)
  }

  // The page asks the server every 2 s while pending, so waiting on the state is enough.
  async expectIdentityStatus(status: string): Promise<void> {
    await expect(this.identityStatus).toHaveAttribute('data-status', status);
  }

  // ---- step 3 ----
  async startIncomeCheck(): Promise<void> {
    await this.click(this.incomeStart); // leaves RentNest for BankBridge
  }

  async fillEmployment(e: Employment): Promise<void> {
    await this.employmentType.selectOption(e.type);
    await this.fill(this.employer, e.employer);
    await this.fill(this.jobTitle, e.jobTitle);
    await this.fill(this.monthlyIncome, e.monthlyIncome);
    await this.fill(this.yearsAtJob, e.yearsAtJob);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  // ---- step 4 ----
  async fillHousehold(h: Household): Promise<void> {
    await this.fill(this.moveInDate, h.moveInDate);
    await this.fill(this.occupants, h.occupants);
    await (h.hasPets ? this.petsYes : this.petsNo).check();
  }

  // ---- step 5 ----
  async submitApplication(): Promise<void> {
    await this.consent.check();
    await this.click(this.submitButton);
    await expect(this.submittedMessage).toBeVisible();
  }
}
