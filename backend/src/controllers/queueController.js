const queueService = require("../services/queueService");
const {
  QUEUE_STREAM_POLL_INTERVAL_MS,
  QUEUE_STREAM_HEARTBEAT_MS,
} = require("../config/constants");

const join = async (req, res) => {
  try {
    const result = await queueService.joinQueue(
      req.user.id,
      req.params.categoryId,
    );

    return res.status(200).json({
      status: "success",
      message: "Joined the queue",
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ status: "error", message });
  }
};

const stream = async (req, res) => {
  const userId = req.user.id;
  const categoryId = req.params.categoryId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders();

  const write = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let closed = false;
  let lastPosition = null;
  let pollTimer = null;
  let heartbeatTimer = null;

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    res.end();
  };

  req.on("close", close);

  const poll = async () => {
    if (closed) return;
    try {
      const position = await queueService.getQueuePosition(userId, categoryId);
      if (position === null) {
        write("granted", { message: "Proceed to checkout" });
        close();
        return;
      }
      if (position !== lastPosition) {
        write("position", { position });
        lastPosition = position;
      }
    } catch (error) {
      if (!closed) {
        write("error", { message: error.message });
        close();
      }
    }
  };

  pollTimer = setInterval(poll, QUEUE_STREAM_POLL_INTERVAL_MS);
  heartbeatTimer = setInterval(() => {
    if (!closed) {
      res.write(": keep-alive\n\n");
    }
  }, QUEUE_STREAM_HEARTBEAT_MS);

  poll();
};

module.exports = {
  join,
  stream,
};
