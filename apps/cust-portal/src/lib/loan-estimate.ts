/**
 * Indicative loan repayment arithmetic.
 *
 * Deterministic and closed-form: the same inputs always give the same output,
 * and every simplifying assumption is returned with the number so the screen
 * can print them instead of implying a quote the bank has not made.
 */

export interface EstimateInputs {
  amount: number;
  annualRatePct: number;
  termMonths: number;
}

export interface LoanEstimate {
  monthlyPayment: number;
  totalRepayable: number;
  totalInterest: number;
  /** When this indication stops being usable, because published rates move. */
  validUntil: string;
  assumptions: string[];
}

/** How long a published rate is treated as usable for an indication. */
export const ESTIMATE_VALIDITY_DAYS = 30;

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);

/**
 * Standard annuity repayment. Returns null when the inputs cannot describe a
 * loan, so callers show nothing rather than a number built on nonsense.
 */
export function estimateRepayment(
  inputs: EstimateInputs,
  options: { currency?: string; rateLabel?: string } = {}
): LoanEstimate | null {
  const currency = options.currency ?? 'EUR';
  const { amount, annualRatePct, termMonths } = inputs;

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(annualRatePct) ||
    !Number.isFinite(termMonths) ||
    amount <= 0 ||
    termMonths <= 0 ||
    annualRatePct < 0
  ) {
    return null;
  }

  const monthlyRate = annualRatePct / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? amount / termMonths
      : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const totalRepayable = monthlyPayment * termMonths;

  return {
    monthlyPayment,
    totalRepayable,
    totalInterest: totalRepayable - amount,
    validUntil: new Date(
      Date.now() + ESTIMATE_VALIDITY_DAYS * 86_400_000
    ).toISOString(),
    assumptions: [
      `Assumes ${options.rateLabel ?? `${annualRatePct}%`} stays fixed for the whole ${termMonths}-month term.`,
      'Assumes equal monthly payments, taken in arrears.',
      'Excludes processing fees, insurance, and any early-repayment charge.',
      `Repaying ${money(amount, currency)} plus ${money(totalRepayable - amount, currency)} interest, ${money(totalRepayable, currency)} in total.`,
      'Indicative only. Your rate and whether you can borrow are decided by the bank.',
    ],
  };
}
