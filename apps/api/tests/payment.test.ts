import { describe, expect, it } from "vitest";
import { recordPayment } from "../src/domain/payment.js";

const unpaid = { paymentMethod: null, paidCashCents: null, paidQrCents: null };

describe("recordPayment", () => {
  it("puts the whole amount on the method used for a first payment", () => {
    expect(recordPayment(unpaid, "QR", 1000)).toEqual({ paymentMethod: "QR", paidCashCents: 0, paidQrCents: 1000 });
  });

  it("adds only the difference when settling up with the other method", () => {
    const paidCash = { paymentMethod: "CASH" as const, paidCashCents: 1000, paidQrCents: 0 };
    expect(recordPayment(paidCash, "QR", 1300)).toEqual({ paymentMethod: "CASH", paidCashCents: 1000, paidQrCents: 300 });
  });

  it("keeps a split payment when either button is tapped with nothing to settle", () => {
    const split = { paymentMethod: "CASH" as const, paidCashCents: 1000, paidQrCents: 300 };
    expect(recordPayment(split, "QR", 1300)).toEqual(split);
    expect(recordPayment(split, "CASH", 1300)).toEqual(split);
  });

  it("keeps change given in cash when QR is tapped again afterwards", () => {
    const refunded = { paymentMethod: "QR" as const, paidCashCents: -300, paidQrCents: 1300 };
    expect(recordPayment(refunded, "QR", 1000)).toEqual(refunded);
    expect(recordPayment(refunded, "CASH", 1000)).toEqual(refunded);
  });

  it("takes change back out of the method used to give it", () => {
    const paidQr = { paymentMethod: "QR" as const, paidCashCents: 0, paidQrCents: 1300 };
    // Still shown as a QR payer: most of the money came by QR.
    expect(recordPayment(paidQr, "CASH", 1000)).toEqual({ paymentMethod: "QR", paidCashCents: -300, paidQrCents: 1300 });
  });

  it("moves everything when correcting a mis-tapped method with nothing to settle", () => {
    const tappedCash = { paymentMethod: "CASH" as const, paidCashCents: 1000, paidQrCents: 0 };
    expect(recordPayment(tappedCash, "QR", 1000)).toEqual({ paymentMethod: "QR", paidCashCents: 0, paidQrCents: 1000 });
  });

  it("changes nothing when the same method is tapped with nothing to settle", () => {
    const paidQr = { paymentMethod: "QR" as const, paidCashCents: 0, paidQrCents: 1000 };
    expect(recordPayment(paidQr, "QR", 1000)).toEqual(paidQr);
  });

  it("returns only payment fields, even when given a whole person row", () => {
    const row = { id: "p1", name: "Aisha", sortOrder: 0, paymentMethod: "QR" as const, paidCashCents: 0, paidQrCents: 1000 };
    expect(Object.keys(recordPayment(row, "QR", 1000)).sort()).toEqual(["paidCashCents", "paidQrCents", "paymentMethod"]);
  });

  it("treats someone paid before amounts were recorded as paid in full", () => {
    const legacy = { paymentMethod: "CASH" as const, paidCashCents: null, paidQrCents: null };
    expect(recordPayment(legacy, "QR", 1000)).toEqual({ paymentMethod: "QR", paidCashCents: 0, paidQrCents: 1000 });
  });
});
