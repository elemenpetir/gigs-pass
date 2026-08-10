jest.mock("../../src/models/orderModel");
jest.mock("../../src/services/lockService");

const orderService = require("../../src/services/orderService");
const orderModel = require("../../src/models/orderModel");
const lockService = require("../../src/services/lockService");

describe("Order Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrder", () => {
    test("creates awaiting_payment order when reservation is active", async () => {
      lockService.getReservation.mockResolvedValue({ reserved: true });
      orderModel.findActiveByBuyerAndCategory.mockResolvedValue(null);
      const order = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        status: "awaiting_payment",
      };
      orderModel.createOrder.mockResolvedValue(order);

      const result = await orderService.createOrder("buyer-1", "cat-1");

      expect(orderModel.createOrder).toHaveBeenCalledWith("buyer-1", "cat-1");
      expect(result).toEqual(order);
    });

    test("throws 403 when no active reservation", async () => {
      lockService.getReservation.mockResolvedValue(null);

      await expect(
        orderService.createOrder("buyer-1", "cat-1"),
      ).rejects.toThrow("No active reservation for this category");

      expect(orderModel.createOrder).not.toHaveBeenCalled();
    });

    test("throws 409 when order already exists for reservation", async () => {
      lockService.getReservation.mockResolvedValue({ reserved: true });
      orderModel.findActiveByBuyerAndCategory.mockResolvedValue({ id: "o-1" });

      await expect(
        orderService.createOrder("buyer-1", "cat-1"),
      ).rejects.toThrow("Order already created for this reservation");

      expect(orderModel.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("payOrder", () => {
    const baseOrder = {
      id: "o-1",
      buyer_id: "buyer-1",
      category_id: "cat-1",
      status: "awaiting_payment",
    };

    test("marks order paid and confirms slot on success", async () => {
      orderModel.findById.mockResolvedValue(baseOrder);
      lockService.confirmSlot.mockResolvedValue({ confirmed: true });
      const paid = { ...baseOrder, status: "pending", paid_at: new Date() };
      orderModel.markPaid.mockResolvedValue(paid);

      const result = await orderService.payOrder("buyer-1", "o-1", true);

      expect(lockService.confirmSlot).toHaveBeenCalledWith("buyer-1", "cat-1");
      expect(orderModel.markPaid).toHaveBeenCalledWith("o-1");
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
});
