import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { computePayslip } from './service';

const dec = (n: number) => new Prisma.Decimal(n);

describe('computePayslip', () => {
  it('computes gross, tax and net correctly', () => {
    const r = computePayslip({
      basicPay: dec(10000),
      housingAllowance: dec(2000),
      transportAllowance: dec(500),
      taxPercent: dec(10),
      otherAllowances: { bonus: 500 },
      otherDeductions: { insurance: 200 },
    });
    expect(r.gross).toBe(13000); // 10000+2000+500+500
    const tax = 1300; // 10% of gross
    expect(r.net).toBe(13000 - tax - 200); // 11500
    expect(r.components.tax).toBe(1300);
  });

  it('handles a structure with no allowances', () => {
    const r = computePayslip({
      basicPay: dec(5000),
      housingAllowance: null,
      transportAllowance: null,
      taxPercent: null,
      otherAllowances: undefined,
      otherDeductions: undefined,
    });
    expect(r.gross).toBe(5000);
    expect(r.net).toBe(5000);
    expect(r.components.tax).toBe(0);
  });
});