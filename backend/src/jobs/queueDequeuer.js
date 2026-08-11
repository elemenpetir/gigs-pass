const queueService = require("../services/queueService");
const lockService = require("../services/lockService");
const categoryModel = require("../models/categoryModel");
const { QUEUE_BATCH_SIZE, QUEUE_DEQUEUE_INTERVAL_MS } = require("../config/constants");

let timer = null;
let running = false;

const processQueueForCategory = async (categoryId) => {
  try {
    await lockService.cleanupExpiredLocks(categoryId);
    const dequeued = await queueService.dequeueBatch(categoryId, QUEUE_BATCH_SIZE);
    if (dequeued.length > 0) {
      console.log(
        `[queueDequeuer] category ${categoryId}: ${dequeued.length} buyer(s) admitted`,
      );
    }
    return dequeued;
  } catch (error) {
    console.error(
      `[queueDequeuer] error processing category ${categoryId}: ${error.message}`,
    );
    return [];
  }
};

const run = async () => {
  if (running) {
    return;
  }
  running = true;
  try {
    const categories = await categoryModel.findAll();
    for (const category of categories) {
      await processQueueForCategory(category.id);
    }
  } catch (error) {
    console.error(`[queueDequeuer] error listing categories: ${error.message}`);
  } finally {
    running = false;
  }
};

const start = () => {
  if (timer) {
    return timer;
  }
  timer = setInterval(run, QUEUE_DEQUEUE_INTERVAL_MS);
  console.log(`[queueDequeuer] started, interval ${QUEUE_DEQUEUE_INTERVAL_MS}ms`);
  return timer;
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { start, stop, run, processQueueForCategory };
