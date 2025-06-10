const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  port: 1433,
};

let poolPromise;

async function connectDB() {
  if (!poolPromise || !poolPromise.connected || poolPromise._connecting) {
    try {
      poolPromise = new sql.ConnectionPool(config);
      poolPromise.on("error", err => {
        console.error("SQL pool error:", err);
        poolPromise = null;
      });
      await poolPromise.connect();
      console.log("Connected to MSSQL");
    } catch (error) {
      console.error("Database connection failed:", error);
      poolPromise = null;
      throw error;
    }
  }
  return poolPromise;
}

async function connectAndQuery(query, params = {}) {
  try {
    const pool = await connectDB();
    const request = pool.request();
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });
    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error("Error executing query:", error);

    if (error.code === "ECONNCLOSED") {
      console.warn("Retrying query due to closed connection...");
      poolPromise = null; // Reset pool
      return await connectAndQuery(query, params);
    }

    throw error;
  }
}


/**
 * The function `closeDB` closes the database connection if it is active and logs appropriate messages.
 */
async function closeDB() {
  if (poolPromise) {
    try {
      await poolPromise.close();
      console.log("Database connection closed.");
      poolPromise = null; // Reset the poolPromise
    } catch (error) {
      console.error("Error closing the database connection:", error.message);
      console.error("Stack trace:", error.stack);
    }
  } else {
    console.log("No active database connection to close.");
  }
}

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  connectAndQuery,
  sql,
};
