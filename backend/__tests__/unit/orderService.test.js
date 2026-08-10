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
});
