// test-db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

async function testDatabase() {
  try {
    console.log("Creating connection...");
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "uclm_energy_audit",
    });

    console.log("Testing simple query...");
    const [rows] = await connection.execute(
      "SELECT COUNT(*) as total FROM buildings"
    );
    console.log("Query result:", rows);

    await connection.end();
    console.log("Test successful!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testDatabase();
