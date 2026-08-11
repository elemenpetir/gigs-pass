const orderModel = require("../models/orderModel");
const ledgerService = require("../services/ledgerService");
const db = require("../config/db");
const { HOLDING_PERIOD_DAYS, ORDER_LIFECYCLE_INTERVAL_MS } = require("../config/constants");

let timer = null;
let running = false;

const transitionToHoldingPeriod = async () => {
  const paidOrders = await orderModel.findPaidOrdersWithPastEvent();
  let count = 0;
  for (const order of paidOrders) {
    const holdingUntil = new Date(
      Date.now() + HOLDING_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );
    const updated = await orderModel.markHoldingPeriod(order.id, holdingUntil);
    if (updated) {
      count += 1;
    }
  }
  return count;
};

const releaseExpiredHoldingPeriods = async () => {
  const expired = await orderModel.findHoldingPeriodExpired();
  let count = 0;
  for (const order of expired) {
    const released = await db.withTransaction(async (client) => {
      const updated = await orderModel.markReleased(order.id, client);
      if (!updated) {
        return null;
      }
      await ledgerService.recordRelease(client, order);
      return updated;
    });
    if (released) {
      count += 1;
    }
  }
  return count;
};

const run = async () => {
  if (running) {
    return;
  }
  running = true;
  try {
    const toHolding = await transitionToHoldingPeriod();
    if (toHolding > 0) {
      console.log(
        `[orderLifecycle] ${toHolding} order(s) moved to holding_period`,
      );
    }
    const released = await releaseExpiredHoldingPeriods();
    if (released > 0) {
      console.log(`[orderLifecycle] ${released} order(s) released to organizer`);
    }
  } catch (error) {
    console.error(`[orderLifecycle] error: ${error.message}`);
  } finally {
    running = false;
  }
};

const start = () => {
  if (timer) {
    return timer;
  }
  timer = setInterval(run, ORDER_LIFECYCLE_INTERVAL_MS);
  console.log(
    `[orderLifecycle] started, interval ${ORDER_LIFECYCLE_INTERVAL_MS}ms`,
  );
  return timer;
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  start,
  stop,
  run,
  transitionToHoldingPeriod,
  releaseExpiredHoldingPeriods,
};
