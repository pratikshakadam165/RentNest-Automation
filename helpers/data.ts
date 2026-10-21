import { config } from '../config/env.config';

/** Unique email so tests never clash, even when the data is not reset. */
export function uniqueEmail(prefix = 'tenant'): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@rentnest.test`;
}

/** Local date as YYYY-MM-DD, `days` from today. */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A property the landlord can create (rent and deposit in dollars). */
export function propertyPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: `Auto test home ${Date.now()}`,
    addressLine: '1 Test Street',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2M6',
    monthlyRent: 2000,
    deposit: 2000,
    bedrooms: 1,
    availableFrom: dateInDays(10),
    description: 'Created by the automation tests',
    ...overrides,
  };
}

/** Everything the application needs to be submitted. */
export function applicationPayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Test',
    lastName: 'Tenant',
    dateOfBirth: '1990-05-05',
    phone: '4165550199',
    currentAddress: '10 Bay Street, Toronto',
    employmentType: 'Full-time',
    employer: 'Acme',
    jobTitle: 'Analyst',
    monthlyIncome: 6500,
    yearsAtJob: 2,
    moveInDate: dateInDays(30),
    occupants: 1,
    hasPets: 'no',
    consent: true,
    ...overrides,
  };
}

/** Card details for POST /api/payments. Expiry is always a few years ahead. */
export function cardPayload(number: string = config.card, name = 'Test Tenant') {
  const year = String((new Date().getFullYear() + 3) % 100).padStart(2, '0');
  return { name, number, expiry: `12/${year}`, cvc: '123' };
}
