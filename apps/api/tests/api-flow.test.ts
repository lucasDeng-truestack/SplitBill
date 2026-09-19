import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

const app = createApp();

describe("receipt API flow", () => {
  let receiptId = "";
  let rotiId = "";
  let lucasId = "";
  let jerushaId = "";

  afterAll(async () => {
    if (receiptId) {
      await prisma.receipt.delete({ where: { id: receiptId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("creates a mock receipt, assigns items, and rejects over-allocation", async () => {
    const image = Buffer.from("fake-image");
    const created = await request(app)
      .post("/api/v1/receipts")
      .attach("image", image, { filename: "receipt.jpg", contentType: "image/jpeg" });

    expect(created.status).toBe(201);
    receiptId = created.body.receipt.id;
    rotiId = created.body.receipt.items.find((item: { name: string }) => item.name === "Roti telur").id;

    const lucas = await request(app).post(`/api/v1/receipts/${receiptId}/people`).send({ name: "Lucas" });
    const jerusha = await request(app).post(`/api/v1/receipts/${receiptId}/people`).send({ name: "Jerusha Akka" });
    lucasId = lucas.body.person.id;
    jerushaId = jerusha.body.person.id;

    const first = await request(app)
      .post(`/api/v1/receipts/${receiptId}/assignments`)
      .send({ personId: lucasId, itemId: rotiId, quantity: 1 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/receipts/${receiptId}/assignments`)
      .send({ personId: jerushaId, itemId: rotiId, quantity: 1 });
    expect(second.status).toBe(201);

    const overflow = await request(app)
      .post(`/api/v1/receipts/${receiptId}/assignments`)
      .send({ personId: lucasId, itemId: rotiId, quantity: 1 });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("OVER_ALLOCATION");

    const invalid = await request(app).post(`/api/v1/receipts/${receiptId}/people`).send({ name: "" });
    expect(invalid.status).toBe(400);

    const summary = await request(app).get(`/api/v1/receipts/${receiptId}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.summary.hasUnassigned).toBe(true);
    expect(summary.body.summary.cashTotalCents).toBe(0);
    expect(summary.body.summary.qrTotalCents).toBe(0);

    const paid = await request(app)
      .patch(`/api/v1/receipts/${receiptId}/people/${lucasId}`)
      .send({ paymentMethod: "CASH" });
    expect(paid.status).toBe(200);
    expect(paid.body.person.paymentMethod).toBe("CASH");

    const qr = await request(app)
      .patch(`/api/v1/receipts/${receiptId}/people/${jerushaId}`)
      .send({ paymentMethod: "QR" });
    expect(qr.status).toBe(200);

    const paidSummary = await request(app).get(`/api/v1/receipts/${receiptId}/summary`);
    expect(paidSummary.body.summary.cashTotalCents).toBeGreaterThan(0);
    expect(paidSummary.body.summary.qrTotalCents).toBeGreaterThan(0);
    expect(paidSummary.body.summary.people.find((p: { personId: string }) => p.personId === lucasId).paymentMethod).toBe(
      "CASH",
    );
  });

  it("includes scanned tax in each person's amount owed and cash collected", async () => {
    const created = await request(app).post("/api/v1/receipts").field("manual", "true");
    expect(created.status).toBe(201);
    const taxReceiptId = created.body.receipt.id as string;

    const item = await request(app)
      .post(`/api/v1/receipts/${taxReceiptId}/items`)
      .send({ name: "Nasi lemak", quantity: 1, unitPriceCents: 1000, totalPriceCents: 1000 });
    expect(item.status).toBe(201);
    const itemId = item.body.item.id as string;

    const patched = await request(app)
      .patch(`/api/v1/receipts/${taxReceiptId}`)
      .send({ taxCents: 60, totalCents: 1060 });
    expect(patched.status).toBe(200);
    expect(patched.body.receipt.taxCents).toBe(60);

    const person = await request(app).post(`/api/v1/receipts/${taxReceiptId}/people`).send({ name: "Aisha" });
    const personId = person.body.person.id as string;

    const claim = await request(app)
      .post(`/api/v1/receipts/${taxReceiptId}/assignments`)
      .send({ personId, itemId, quantity: 1 });
    expect(claim.status).toBe(201);

    const summary = await request(app).get(`/api/v1/receipts/${taxReceiptId}/summary`);
    expect(summary.status).toBe(200);
    const seat = summary.body.summary.people.find((row: { personId: string }) => row.personId === personId);
    expect(seat.itemSubtotalCents).toBe(1000);
    expect(seat.taxCents).toBe(60);
    expect(seat.amountOwedCents).toBe(1060);

    await request(app).patch(`/api/v1/receipts/${taxReceiptId}/people/${personId}`).send({ paymentMethod: "CASH" });
    const paid = await request(app).get(`/api/v1/receipts/${taxReceiptId}/summary`);
    expect(paid.body.summary.cashTotalCents).toBe(1060);

    await prisma.receipt.delete({ where: { id: taxReceiptId } });
  });

  it("lists receipts by day range and can clear them", async () => {
    const created = await request(app).post("/api/v1/receipts").field("manual", "true");
    expect(created.status).toBe(201);
    const todayId = created.body.receipt.id as string;

    const old = await request(app).post("/api/v1/receipts").field("manual", "true");
    const oldId = old.body.receipt.id as string;
    await prisma.receipt.update({
      where: { id: oldId },
      data: { createdAt: new Date("2026-08-01T12:00:00+08:00") },
    });

    const today = await request(app).get("/api/v1/receipts?range=today");
    expect(today.status).toBe(200);
    expect(today.body.receipts.some((row: { id: string }) => row.id === todayId)).toBe(true);
    expect(today.body.receipts.some((row: { id: string }) => row.id === oldId)).toBe(false);

    const all = await request(app).get("/api/v1/receipts?range=all");
    expect(all.body.receipts.some((row: { id: string }) => row.id === oldId)).toBe(true);

    const cleared = await request(app).delete("/api/v1/receipts?range=today");
    expect(cleared.status).toBe(200);
    expect(cleared.body.deleted).toBeGreaterThanOrEqual(1);

    const afterToday = await request(app).get("/api/v1/receipts?range=today");
    expect(afterToday.body.receipts.some((row: { id: string }) => row.id === todayId)).toBe(false);

    const leftover = await request(app).get("/api/v1/receipts?range=all");
    expect(leftover.body.receipts.some((row: { id: string }) => row.id === oldId)).toBe(true);

    await prisma.receipt.delete({ where: { id: oldId } });
  });
});
