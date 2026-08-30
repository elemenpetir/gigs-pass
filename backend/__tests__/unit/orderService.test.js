jest.mock("../../src/models/orderModel");
jest.mock("../../src/models/categoryModel");
jest.mock("../../src/services/lockService");
jest.mock("../../src/services/ledgerService");
jest.mock("../../src/config/db", () => ({
  withTransaction: jest.fn((fn) => fn({})),
}));

const orderService = require("../../src/services/orderService");
const orderModel = require("../../src/models/orderModel");
const categoryModel = require("../../src/models/categoryModel");
const lockService = require("../../src/services/lockService");
const ledgerService = require("../../src/services/ledgerService");
const db = require("../../src/config/db");

describe("Order Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrder", () => {
    test("creates awaiting_payment order when reservation is active", async () => {
      lockService.getReservation.mockResolvedValue({ reserved: true });
      orderModel.findUnpaidByBuyerAndCategory.mockResolvedValue(null);
      categoryModel.findById.mockResolvedValue({ id: "cat-1", price: 150000 });
      const order = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        status: "awaiting_payment",
        amount: 150000,
      };
      orderModel.createOrder.mockResolvedValue(order);

      const result = await orderService.createOrder("buyer-1", "cat-1");

      expect(categoryModel.findById).toHaveBeenCalledWith("cat-1");
      expect(orderModel.createOrder).toHaveBeenCalledWith(
        "buyer-1",
        "cat-1",
        150000,
      );
      expect(result).toEqual(order);
    });

    test("throws 403 when no active reservation", async () => {
      lockService.getReservation.mockResolvedValue(null);

      await expect(
        orderService.createOrder("buyer-1", "cat-1"),
      ).rejects.toThrow("No active reservation for this category");

      expect(orderModel.createOrder).not.toHaveBeenCalled();
    });

    test("throws 409 with existing order in error.data", async () => {
      lockService.getReservation.mockResolvedValue({ reserved: true });
      const existing = { id: "o-1", status: "awaiting_payment" };
      orderModel.findUnpaidByBuyerAndCategory.mockResolvedValue(existing);

      await expect(
        orderService.createOrder("buyer-1", "cat-1"),
      ).rejects.toMatchObject({
        message: "Order already created for this reservation",
        statusCode: 409,
        data: { order: existing },
      });

      expect(orderModel.createOrder).not.toHaveBeenCalled();
    });

    test("throws 404 when category not found", async () => {
      lockService.getReservation.mockResolvedValue({ reserved: true });
      orderModel.findUnpaidByBuyerAndCategory.mockResolvedValue(null);
      categoryModel.findById.mockResolvedValue(null);

      await expect(
        orderService.createOrder("buyer-1", "cat-1"),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("payOrder", () => {
    const baseOrder = {
      id: "o-1",
      buyer_id: "buyer-1",
      category_id: "cat-1",
      status: "awaiting_payment",
      amount: 150000,
    };

    test("marks order paid, records ledger split and confirms slot on success", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);
      lockService.confirmSlot.mockResolvedValue({ confirmed: true });
      const paid = {
        ...baseOrder,
        status: "pending",
        paid_at: new Date(),
      };
      orderModel.markPaid.mockResolvedValue(paid);

      const result = await orderService.payOrder("buyer-1", "o-1", true);

      expect(lockService.confirmSlot).toHaveBeenCalledWith("buyer-1", "cat-1");
      expect(db.withTransaction).toHaveBeenCalled();
      expect(orderModel.markPaid).toHaveBeenCalledWith("o-1", {});
      expect(ledgerService.recordPaymentSplit).toHaveBeenCalledWith({}, paid);
      expect(orderModel.markExpired).not.toHaveBeenCalled();
      expect(result).toEqual(paid);
    });

    test("throws 409 when reservation already expired on success", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);
      lockService.confirmSlot.mockResolvedValue({ confirmed: false });

      await expect(
        orderService.payOrder("buyer-1", "o-1", true),
      ).rejects.toThrow("Reservation expired");

      expect(orderModel.markPaid).not.toHaveBeenCalled();
    });

    test("rolls back when order is no longer awaiting payment inside transaction", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);
      lockService.confirmSlot.mockResolvedValue({ confirmed: true });
      orderModel.markPaid.mockResolvedValue(null);

      await expect(
        orderService.payOrder("buyer-1", "o-1", true),
      ).rejects.toThrow("Order is not awaiting payment");
    });

    test("releases slot and marks order expired on failure", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);
      lockService.releaseSlot.mockResolvedValue({ released: true });
      const expired = { ...baseOrder, status: "expired" };
      orderModel.markExpired.mockResolvedValue(expired);

      const result = await orderService.payOrder("buyer-1", "o-1", false);

      expect(lockService.releaseSlot).toHaveBeenCalledWith("buyer-1", "cat-1");
      expect(orderModel.markExpired).toHaveBeenCalledWith("o-1");
      expect(orderModel.markPaid).not.toHaveBeenCalled();
      expect(result).toEqual(expired);
    });

    test("throws 404 when order not found", async () => {
      orderModel.findById.mockResolvedValue(null);

      await expect(
        orderService.payOrder("buyer-1", "o-missing", true),
      ).rejects.toThrow("Order not found");
    });

    test("throws 403 when order belongs to another buyer", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);

      await expect(
        orderService.payOrder("buyer-2", "o-1", true),
      ).rejects.toThrow("Forbidden: not your order");
    });

    test("throws 409 when order is not awaiting payment", async () => {
      orderModel.findById.mockResolvedValue({
        ...baseOrder,
        status: "pending",
      });

      await expect(
        orderService.payOrder("buyer-1", "o-1", true),
      ).rejects.toThrow("Order is not awaiting payment");
    });
  });

  describe("overrideOrder", () => {
    const holdingOrder = {
      id: "o-1",
      buyer_id: "buyer-1",
      category_id: "cat-1",
      status: "holding_period",
      amount: 150000,
    };

    test("holds an order without moving funds", async () => {
      orderModel.findById.mockResolvedValue(holdingOrder);
      const held = { ...holdingOrder, status: "held" };
      orderModel.overrideStatus.mockResolvedValue(held);

      const result = await orderService.overrideOrder(
        { role: "admin" },
        "o-1",
        "held",
      );

      expect(orderModel.overrideStatus).toHaveBeenCalledWith("o-1", "held");
      expect(ledgerService.recordRefund).not.toHaveBeenCalled();
      expect(result).toEqual(held);
    });

    test("refunds an order with reversing ledger entries", async () => {
      orderModel.findById.mockResolvedValue(holdingOrder);
      const refunded = { ...holdingOrder, status: "refunded" };
      orderModel.overrideStatus.mockResolvedValue(refunded);

      const result = await orderService.overrideOrder(
        { role: "admin" },
        "o-1",
        "refunded",
      );

      expect(db.withTransaction).toHaveBeenCalled();
      expect(orderModel.overrideStatus).toHaveBeenCalledWith("o-1", "refunded", {});
      expect(ledgerService.recordRefund).toHaveBeenCalledWith(
        {},
        holdingOrder,
        "admin_override",
      );
      expect(result).toEqual(refunded);
    });

    test("throws 403 for non-admin", async () => {
      await expect(
        orderService.overrideOrder({ role: "organizer" }, "o-1", "held"),
      ).rejects.toThrow("Forbidden: only admin can override");
    });

    test("throws 400 for invalid status", async () => {
      await expect(
        orderService.overrideOrder({ role: "admin" }, "o-1", "pending"),
      ).rejects.toThrow("Invalid status");
    });

    test("throws 404 when order not found", async () => {
      orderModel.findById.mockResolvedValue(null);

      await expect(
        orderService.overrideOrder({ role: "admin" }, "o-missing", "held"),
      ).rejects.toThrow("Order not found");
    });

    test("throws 409 when order is not in holding period", async () => {
      orderModel.findById.mockResolvedValue({
        ...holdingOrder,
        status: "released",
      });

      await expect(
        orderService.overrideOrder({ role: "admin" }, "o-1", "held"),
      ).rejects.toThrow("Override only valid while order is in holding_period");
    });

    test("throws 409 inside transaction when order is no longer in holding period", async () => {
      orderModel.findById.mockResolvedValue(holdingOrder);
      orderModel.overrideStatus.mockResolvedValue(null);

      await expect(
        orderService.overrideOrder({ role: "admin" }, "o-1", "refunded"),
      ).rejects.toThrow("Override only valid while order is in holding_period");
    });
  });
});
