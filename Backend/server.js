import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import config from "./src/config/config.js";

const startServer = async () => {
  try {
    await connectDB();
    app.listen(config.PORT, () => {
      console.log(`Server is running on port ${config.PORT} in ${config.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error("Failed to start server due to database error.");
    process.exit(1);
  }
};

startServer();
