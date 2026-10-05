export type PaymentMethod = "CASH" | "QR";

export type PaymentState = {
  paymentMethod: PaymentMethod | null;
  /** null for both = unpaid, or paid before amounts were recorded. */
  paidCashCents: number | null;
  paidQrCents: number | null;
};

export function hasRecordedAmounts(state: PaymentState): boolean {
  return state.paymentMethod != null && (state.paidCashCents != null || state.paidQrCents != null);
}

export function paidTotalCents(state: PaymentState): number | null {
  if (!hasRecordedAmounts(state)) return null;
  return (state.paidCashCents ?? 0) + (state.paidQrCents ?? 0);
}

/**
 * Tapping Cash or QR:
 * - first payment (or legacy record): the whole amount owed goes on that method;
 * - already paid with a difference: only the difference goes on that method (negative = change given);
 * - already paid, nothing to settle, other method, and the whole payment sits on one method:
 *   a mis-tap correction, so everything moves over. A split payment is left alone.
 * The method shown for the person is whichever holds more of the money.
 */
export function recordPayment(current: PaymentState, method: PaymentMethod, owedCents: number): PaymentState {
  const result = (cash: number, qr: number): PaymentState => ({
    paymentMethod: cash > qr ? "CASH" : qr > cash ? "QR" : method,
    paidCashCents: cash,
    paidQrCents: qr,
  });

  const paid = paidTotalCents(current);
  if (paid == null) return method === "CASH" ? result(owedCents, 0) : result(0, owedCents);

  const cash = current.paidCashCents ?? 0;
  const qr = current.paidQrCents ?? 0;
  const difference = owedCents - paid;
  if (difference !== 0) {
    return method === "CASH" ? result(cash + difference, qr) : result(cash, qr + difference);
  }

  const singleMethod = cash === 0 || qr === 0;
  if (singleMethod && current.paymentMethod !== method) {
    return method === "CASH" ? result(paid, 0) : result(0, paid);
  }
  return { paymentMethod: current.paymentMethod, paidCashCents: cash, paidQrCents: qr };
}
