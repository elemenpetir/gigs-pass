const categoryModel = require("../models/categoryModel");
const eventModel = require("../models/eventModel");
const ledgerModel = require("../models/ledgerModel");
const { PLATFORM_COMMISSION_PERCENT } = require("../config/constants");

const createLedgerEntries = async (client, { orderId, entries }) => {
  if (entries.some((e) => !Number.isInteger(e.amount) || e.amount <= 0)) {
    const error = new Error("Ledger entry amount must be a positive integer");
    error.statusCode = 400;
    throw error;
  }

  const totalDebit = entries
    .filter((e) => e.entryType === "debit")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries
    .filter((e) => e.entryType === "credit")
    .reduce((sum, e) => sum + e.amount, 0);

  if (totalDebit !== totalCredit) {
    const error = new Error(
      "Ledger entries must balance: total debit must equal total credit",
    );
    error.statusCode = 400;
    throw error;
  }

  const inserted = [];
  for (const entry of entries) {
    inserted.push(
      await ledgerModel.insertEntry(client, {
        orderId,
        accountId: entry.accountId,
        entryType: entry.entryType,
        amount: entry.amount,
        description: entry.description,
      }),
    );
  }
  return inserted;
};

const computeSplit = (amount) => {
  const commission = Math.round((amount * PLATFORM_COMMISSION_PERCENT) / 100);
  return {
    commission,
    organizerShare: amount - commission,
  };
};

const recordPaymentSplit = async (client, order) => {
  const category = await categoryModel.findById(order.category_id);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }
  const event = await eventModel.findById(category.event_id);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const buyerWallet = await ledgerModel.getOrCreateAccount(
    client,
    order.buyer_id,
    "buyer_wallet",
  );
  const organizerPending = await ledgerModel.getOrCreateAccount(
    client,
    event.organizer_id,
    "organizer_pending",
  );
  const platformRevenue = await ledgerModel.getPlatformRevenueAccount(client);
  if (!platformRevenue) {
    const error = new Error("Platform revenue account not found");
    error.statusCode = 500;
    throw error;
  }

  const amount = order.amount;
  const { commission, organizerShare } = computeSplit(amount);

  return createLedgerEntries(client, {
    orderId: order.id,
    entries: [
      {
        accountId: buyerWallet.id,
        entryType: "debit",
        amount,
        description: `Pembayaran order ${order.id}`,
      },
      {
        accountId: organizerPending.id,
        entryType: "credit",
        amount: organizerShare,
        description: `Bagian organizer untuk order ${order.id}`,
      },
      {
        accountId: platformRevenue.id,
        entryType: "credit",
        amount: commission,
        description: `Komisi platform untuk order ${order.id}`,
      },
    ],
  });
};

const recordRelease = async (client, order) => {
  const organizerPending = await ledgerModel.getOrCreateAccount(
    client,
    order.organizer_id,
    "organizer_pending",
  );
  const organizerAvailable = await ledgerModel.getOrCreateAccount(
    client,
    order.organizer_id,
    "organizer_available",
  );
  if (!organizerPending || !organizerAvailable) {
    const error = new Error("Organizer accounts not found");
    error.statusCode = 500;
    throw error;
  }

  const { organizerShare } = computeSplit(order.amount);

  return createLedgerEntries(client, {
    orderId: order.id,
    entries: [
      {
        accountId: organizerPending.id,
        entryType: "debit",
        amount: organizerShare,
        description: `Release dana order ${order.id}`,
      },
      {
        accountId: organizerAvailable.id,
        entryType: "credit",
        amount: organizerShare,
        description: `Dana tersedia untuk order ${order.id}`,
      },
    ],
  });
};

const recordRefund = async (client, order) => {
  const category = await categoryModel.findById(order.category_id);
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }
  const event = await eventModel.findById(category.event_id);
  if (!event) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  const buyerWallet = await ledgerModel.getOrCreateAccount(
    client,
    order.buyer_id,
    "buyer_wallet",
  );
  const organizerPending = await ledgerModel.getOrCreateAccount(
    client,
    event.organizer_id,
    "organizer_pending",
  );
  const platformRevenue = await ledgerModel.getPlatformRevenueAccount(client);
  if (!buyerWallet || !organizerPending || !platformRevenue) {
    const error = new Error("Ledger accounts not found for refund");
    error.statusCode = 500;
    throw error;
  }

  const amount = order.amount;
  const { commission, organizerShare } = computeSplit(amount);

  return createLedgerEntries(client, {
    orderId: order.id,
    entries: [
      {
        accountId: buyerWallet.id,
        entryType: "credit",
        amount,
        description: `Refund order ${order.id} (event dibatalkan)`,
      },
      {
        accountId: organizerPending.id,
        entryType: "debit",
        amount: organizerShare,
        description: `Batalkan bagian organizer untuk order ${order.id}`,
      },
      {
        accountId: platformRevenue.id,
        entryType: "debit",
        amount: commission,
        description: `Batalkan komisi untuk order ${order.id}`,
      },
    ],
  });
};

const getAccountBalance = async (accountId) => {
  return ledgerModel.getBalance(accountId);
};

module.exports = {
  createLedgerEntries,
  recordPaymentSplit,
  recordRelease,
  recordRefund,
  getAccountBalance,
};
