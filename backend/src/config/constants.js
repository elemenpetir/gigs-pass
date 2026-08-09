const QUEUE_BATCH_SIZE = parseInt(process.env.QUEUE_BATCH_SIZE, 10) || 50;
const QUEUE_DEQUEUE_INTERVAL_MS =
  parseInt(process.env.QUEUE_DEQUEUE_INTERVAL_MS, 10) || 5000;
const QUEUE_SEQ_KEY = "queue:seq";

module.exports = {
  QUEUE_BATCH_SIZE,
  QUEUE_DEQUEUE_INTERVAL_MS,
  QUEUE_SEQ_KEY,
};
