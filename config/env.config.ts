import path from 'node:path';

// Values come from config/.env.<TEST_ENV> (loaded in playwright.config.ts).
function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing env var ${name}. Check config/.env.${process.env.TEST_ENV || 'qa'}`);
  return value;
}

export const config = {
  baseURL: env('BASE_URL', 'http://localhost:4000'),
  landlord: { email: env('LANDLORD_EMAIL'), password: env('LANDLORD_PASSWORD') },
  landlord2: { email: env('LANDLORD2_EMAIL'), password: env('LANDLORD2_PASSWORD') },
  tenantA: { email: env('TENANT_A_EMAIL'), password: env('TENANT_A_PASSWORD') },
  newTenantPassword: env('NEW_TENANT_PASSWORD'),
  card: env('TEST_CARD'),
  bank: { user: env('BANK_USER'), password: env('BANK_PASSWORD') },
  secrets: { verifynow: env('VERIFYNOW_SECRET'), bankbridge: env('BANKBRIDGE_SECRET') },
  images: {
    id: path.join(process.cwd(), 'test-data', 'sample-id.png'),
    selfie: path.join(process.cwd(), 'test-data', 'sample-selfie.png'),
  },
};
