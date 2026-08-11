jest.mock("../../src/models/ledgerModel");
jest.mock("../../src/models/categoryModel");
jest.mock("../../src/models/eventModel");

const ledgerService = require("../../src/services/ledgerService");
const ledgerModel = require("../../src/models/ledgerModel");
const categoryModel = require("../../src/models/categoryModel");
const eventModel = require("../../src/models/eventModel");

const fakeClient = { id: "client" };

describe("Ledger Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLedgerEntries", () => {
    test("inserts all entries when debit equals credit", async () => {
      ledgerModel.insertEntry.mockResolvedValue({ id: "entry-1" });

      const result = await ledgerService.createLedgerEntries(fakeClient, {
        orderId: "o-1",
        entries: [
          { accountId: "a1", entryType: "debit", amount: 150000 },
          { accountId: "a2", entryType: "credit", amount: 135000 },
          { accountId: "a3", entryType: "credit", amount: 15000 },
        ],
      });

      expect(ledgerModel.insertEntry).toHaveBeenCalledTimes(3);
      expect(ledgerModel.insertEntry).toHaveBeenCalledWith(fakeClient, {
        orderId: "o-1",
        accountId: "a1",
        entryType: "debit",
        amount: 150000,
        description: undefined,
      });
      expect(result).toHaveLength(3);
    });

    test("throws 400 when debit does not equal credit", async () => {
      await expect(
        ledgerService.createLedgerEntries(fakeClient, {
          orderId: "o-1",
          entries: [
            { accountId: "a1", entryType: "debit", amount: 100 },
            { accountId: "a2", entryType: "credit", amount: 90 },
          ],
        }),
      ).rejects.toThrow("Ledger entries must balance");

      expect(ledgerModel.insertEntry).not.toHaveBeenCalled();
    });

    test("throws 400 when any amount is not a positive integer", async () => {
      await expect(
        ledgerService.createLedgerEntries(fakeClient, {
          orderId: "o-1",
          entries: [
            { accountId: "a1", entryType: "debit", amount: 100 },
            { accountId: "a2", entryType: "credit", amount: -100 },
          ],
        }),
      ).rejects.toThrow("Ledger entry amount must be a positive integer");

      expect(ledgerModel.insertEntry).not.toHaveBeenCalled();
    });
  });

  describe("recordPaymentSplit", () => {
    test("creates balanced split: debit buyer, credit organizer and platform", async () => {
      categoryModel.findById.mockResolvedValue({
        id: "cat-1",
        event_id: "ev-1",
        price: 150000,
      });
      eventModel.findById.mockResolvedValue({
        id: "ev-1",
        organizer_id: "org-1",
      });
      ledgerModel.getOrCreateAccount.mockImplementation(async (client, ownerId, type) => {
        if (type === "buyer_wallet") return { id: "acc-buyer" };
        if (type === "organizer_pending") return { id: "acc-organizer" };
        return null;
      });
      ledgerModel.getPlatformRevenueAccount.mockResolvedValue({
        id: "acc-platform",
      });
      const inserted = [
        { id: "e1", amount: 150000 },
        { id: "e2", amount: 135000 },
        { id: "e3", amount: 15000 },
      ];
      ledgerModel.insertEntry.mockImplementation(async (client, entry) => {
        const next = inserted.shift();
        return { ...next, ...entry };
      });

      const order = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        status: "pending",
        amount: 150000,
      };

      const result = await ledgerService.recordPaymentSplit(fakeClient, order);

      expect(categoryModel.findById).toHaveBeenCalledWith("cat-1");
      expect(eventModel.findById).toHaveBeenCalledWith("ev-1");
      expect(ledgerModel.getOrCreateAccount).toHaveBeenCalledWith(
        fakeClient,
        "buyer-1",
        "buyer_wallet",
      );
      expect(ledgerModel.getOrCreateAccount).toHaveBeenCalledWith(
        fakeClient,
        "org-1",
        "organizer_pending",
      );
      expect(ledgerModel.getPlatformRevenueAccount).toHaveBeenCalledWith(
        fakeClient,
      );

      expect(ledgerModel.insertEntry).toHaveBeenCalledTimes(3);

      const debits = result.filter((e) => e.entryType === "debit");
      const credits = result.filter((e) => e.entryType === "credit");
      const totalDebit = debits.reduce((sum, e) => sum + e.amount, 0);
      const totalCredit = credits.reduce((sum, e) => sum + e.amount, 0);

      expect(totalDebit).toBe(150000);
      expect(totalCredit).toBe(150000);
      expect(totalDebit).toBe(totalCredit);

      const creditByAccount = result
        .filter((e) => e.entryType === "credit")
        .reduce((map, e) => {
          map[e.accountId] = e.amount;
          return map;
        }, {});
      expect(creditByAccount["acc-organizer"]).toBe(135000);
      expect(creditByAccount["acc-platform"]).toBe(15000);
    });

    test("throws 404 when category not found", async () => {
      categoryModel.findById.mockResolvedValue(null);

      await expect(
        ledgerService.recordPaymentSplit(fakeClient, {
          id: "o-1",
          buyer_id: "buyer-1",
          category_id: "cat-1",
          amount: 150000,
        }),
      ).rejects.toThrow("Category not found");
    });

    test("throws 404 when event not found", async () => {
      categoryModel.findById.mockResolvedValue({
        id: "cat-1",
        event_id: "ev-1",
      });
      eventModel.findById.mockResolvedValue(null);

      await expect(
        ledgerService.recordPaymentSplit(fakeClient, {
          id: "o-1",
          buyer_id: "buyer-1",
          category_id: "cat-1",
          amount: 150000,
        }),
      ).rejects.toThrow("Event not found");
    });

    test("throws 500 when platform revenue account is missing", async () => {
      categoryModel.findById.mockResolvedValue({
        id: "cat-1",
        event_id: "ev-1",
      });
      eventModel.findById.mockResolvedValue({
        id: "ev-1",
        organizer_id: "org-1",
      });
      ledgerModel.getOrCreateAccount.mockResolvedValue({ id: "acc-buyer" });
      ledgerModel.getPlatformRevenueAccount.mockResolvedValue(null);

      await expect(
        ledgerService.recordPaymentSplit(fakeClient, {
          id: "o-1",
          buyer_id: "buyer-1",
          category_id: "cat-1",
          amount: 150000,
        }),
      ).rejects.toThrow("Platform revenue account not found");
    });
  });

  describe("recordRelease", () => {
    test("moves organizer share from pending to available (balanced)", async () => {
      ledgerModel.getOrCreateAccount.mockImplementation(async (client, ownerId, type) => {
        if (type === "organizer_pending") return { id: "acc-pending" };
        if (type === "organizer_available") return { id: "acc-available" };
        return null;
      });
      const inserted = [
        { id: "e1", amount: 135000 },
        { id: "e2", amount: 135000 },
      ];
      ledgerModel.insertEntry.mockImplementation(async (client, entry) => {
        const next = inserted.shift();
        return { ...next, ...entry };
      });

      const order = {
        id: "o-1",
        category_id: "cat-1",
        amount: 150000,
        organizer_id: "org-1",
      };

      const result = await ledgerService.recordRelease(fakeClient, order);

      expect(ledgerModel.getOrCreateAccount).toHaveBeenCalledWith(
        fakeClient,
        "org-1",
        "organizer_pending",
      );
      expect(ledgerModel.getOrCreateAccount).toHaveBeenCalledWith(
        fakeClient,
        "org-1",
        "organizer_available",
      );
      expect(ledgerModel.insertEntry).toHaveBeenCalledTimes(2);

      const debits = result.filter((e) => e.entryType === "debit");
      const credits = result.filter((e) => e.entryType === "credit");
      const totalDebit = debits.reduce((sum, e) => sum + e.amount, 0);
      const totalCredit = credits.reduce((sum, e) => sum + e.amount, 0);

      expect(totalDebit).toBe(135000);
      expect(totalCredit).toBe(135000);
      expect(totalDebit).toBe(totalCredit);
      expect(debits[0].accountId).toBe("acc-pending");
      expect(credits[0].accountId).toBe("acc-available");
    });
  });

  describe("recordRefund", () => {
    test("reverses payment split back to buyer (balanced)", async () => {
      categoryModel.findById.mockResolvedValue({
        id: "cat-1",
        event_id: "ev-1",
      });
      eventModel.findById.mockResolvedValue({
        id: "ev-1",
        organizer_id: "org-1",
      });
      ledgerModel.getOrCreateAccount.mockImplementation(async (client, ownerId, type) => {
        if (type === "buyer_wallet") return { id: "acc-buyer" };
        if (type === "organizer_pending") return { id: "acc-organizer" };
        return null;
      });
      ledgerModel.getPlatformRevenueAccount.mockResolvedValue({
        id: "acc-platform",
      });
      const inserted = [
        { id: "e1", amount: 150000 },
        { id: "e2", amount: 135000 },
        { id: "e3", amount: 15000 },
      ];
      ledgerModel.insertEntry.mockImplementation(async (client, entry) => {
        const next = inserted.shift();
        return { ...next, ...entry };
      });

      const order = {
        id: "o-1",
        buyer_id: "buyer-1",
        category_id: "cat-1",
        amount: 150000,
      };

      const result = await ledgerService.recordRefund(fakeClient, order);

      expect(categoryModel.findById).toHaveBeenCalledWith("cat-1");
      expect(eventModel.findById).toHaveBeenCalledWith("ev-1");
      expect(ledgerModel.insertEntry).toHaveBeenCalledTimes(3);

      const totalDebit = result
        .filter((e) => e.entryType === "debit")
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredit = result
        .filter((e) => e.entryType === "credit")
        .reduce((sum, e) => sum + e.amount, 0);

      expect(totalCredit).toBe(150000);
      expect(totalDebit).toBe(150000);
      expect(totalDebit).toBe(totalCredit);

      const credits = result.filter((e) => e.entryType === "credit");
      expect(credits[0].accountId).toBe("acc-buyer");
      expect(credits[0].amount).toBe(150000);
    });

    test("throws 404 when category not found", async () => {
      categoryModel.findById.mockResolvedValue(null);

      await expect(
        ledgerService.recordRefund(fakeClient, {
          id: "o-1",
          buyer_id: "buyer-1",
          category_id: "cat-1",
          amount: 150000,
        }),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("getAccountBalance", () => {
    test("returns balance from ledger model", async () => {
      ledgerModel.getBalance.mockResolvedValue(120000);

      const balance = await ledgerService.getAccountBalance("acc-1");

      expect(ledgerModel.getBalance).toHaveBeenCalledWith("acc-1");
      expect(balance).toBe(120000);
    });
  });

  describe("immutability by design", () => {
    test("ledgerModel does not expose update or delete functions", () => {
      const realLedgerModel = jest.requireActual(
        "../../src/models/ledgerModel",
      );
      const exposed = Object.keys(realLedgerModel);
      const forbidden = exposed.filter(
        (fn) => fn.toLowerCase().includes("update") || fn.toLowerCase().includes("delete"),
      );
      expect(forbidden).toEqual([]);
    });

    test("ledgerService does not expose update or delete functions", () => {
      const exposed = Object.keys(ledgerService);
      const forbidden = exposed.filter(
        (fn) => fn.toLowerCase().includes("update") || fn.toLowerCase().includes("delete"),
      );
      expect(forbidden).toEqual([]);
    });
  });
});
