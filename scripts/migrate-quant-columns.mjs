import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("No DATABASE_URL found");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database for incremental quant migrations...");

  const queries = [
    `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS paperTradingBalance DECIMAL(20, 6) DEFAULT '1000000.000000'`,
    `ALTER TABLE recurring_rules ADD COLUMN IF NOT EXISTS subscriptionTag VARCHAR(64) DEFAULT NULL`,
    `ALTER TABLE recurring_rules ADD COLUMN IF NOT EXISTS renewalNotificationDays INT DEFAULT 3`,
    `ALTER TABLE debts ADD COLUMN IF NOT EXISTS creditLimit DECIMAL(20, 6) DEFAULT NULL`,
    `ALTER TABLE debts ADD COLUMN IF NOT EXISTS billingCycleDay INT DEFAULT NULL`,
    `ALTER TABLE debts ADD COLUMN IF NOT EXISTS gracePeriodDays INT DEFAULT NULL`,
    `ALTER TABLE debts ADD COLUMN IF NOT EXISTS interestFreeDueDate BIGINT DEFAULT NULL`,
  ];

  for (const q of queries) {
    try {
      await connection.query(q);
      console.log("Applied:", q);
    } catch (err) {
      console.warn("Notice for query:", q, err.message);
    }
  }

  await connection.end();
  console.log("Quant migrations completed successfully.");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
