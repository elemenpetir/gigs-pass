jest.mock("../../src/models/orderModel");
jest.mock("../../src/services/ledgerService");
jest.mock("../../src/config/db", () => ({
  withTransaction: jest.fn((fn) => fn({})),
}));

const orderLifecycle = require("../../src/jobs/orderLifecycle");
const orderModel = require("../../src/models/orderModel");
const ledgerService = require("../../src/services/ledgerService");
const db = require("../../src/config/db");

describe("Order Lifecycle Job", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("transitionToHoldingPeriod", () => {
    test("moves paid orders with past event date to holding_period", async () => {
      const pastOrder = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        status: "pending",
        amount: 150000,
        organizer_id: "org-1",
      };
      orderModel.findPaidOrdersWithPastEvent.mockResolvedValue([pastOrder]);
      orderModel.markHoldingPeriod.mockResolvedValue({
        ...pastOrder,
        status: "holding_period",
        holding_until: new Date(),
      });

      const count = await orderLifecycle.transitionToHoldingPeriod();

      expect(count).toBe(1);
      expect(orderModel.findPaidOrdersWithPastEvent).toHaveBeenCalled();
      expect(orderModel.markHoldingPeriod).toHaveBeenCalledWith(
        "o-1",
        expect.any(Date),
      );
    });

    test("returns 0 when no orders are due", async () => {
      orderModel.findPaidOrdersWithPastEvent.mockResolvedValue([]);

      const count = await orderLifecycle.transitionToHoldingPeriod();

      expect(count).toBe(0);
      expect(orderModel.markHoldingPeriod).not.toHaveBeenCalled();
    });
  });

  describe("releaseExpiredHoldingPeriods", () => {
    test("releases expired holding periods and records ledger release", async () => {
      const expiredOrder = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        status: "holding_period",
        amount: 150000,
        organizer_id: "org-1",
      };
      orderModel.findHoldingPeriodExpired.mockResolvedValue([expiredOrder]);
      orderModel.markReleased.mockResolvedValue({
        ...expiredOrder,
        status: "released",
      });

      const count = await orderLifecycle.releaseExpiredHoldingPeriods();

      expect(count).toBe(1);
      expect(db.withTransaction).toHaveBeenCalled();
      expect(orderModel.markReleased).toHaveBeenCalledWith("o-1", {});
      expect(ledgerService.recordRelease).toHaveBeenCalledWith(
        {},
        expiredOrder,
      );
    });

    test("does not record ledger release when order already changed", async () => {
      const expiredOrder = {
        id: "o-1",
        category_id: "cat-1",
        status: "holding_period",
        amount: 150000,
        organizer_id: "org-1",
      };
      orderModel.findHoldingPeriodExpired.mockResolvedValue([expiredOrder]);
      orderModel.markReleased.mockResolvedValue(null);

      const count = await orderLifecycle.releaseExpiredHoldingPeriods();

      expect(count).toBe(0);
      expect(ledgerService.recordRelease).not.toHaveBeenCalled();
    });
  });

  describe("run", () => {
    test("processes both phases sequentially", async () => {
      orderModel.findPaidOrdersWithPastEvent.mockResolvedValue([]);
      orderModel.findHoldingPeriodExpired.mockResolvedValue([]);

      await orderLifecycle.run();

      expect(orderModel.findPaidOrdersWithPastEvent).toHaveBeenCalled();
      expect(orderModel.findHoldingPeriodExpired).toHaveBeenCalled();
    });
  });
});
