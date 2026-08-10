require("dotenv").config();
const app = require("./app");
const queueDequeuer = require("./jobs/queueDequeuer");
const lockCleaner = require("./jobs/lockCleaner");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  queueDequeuer.start();
  lockCleaner.start();
});
