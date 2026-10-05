import "dotenv/config";
import { getDb, getPool } from "../server/db";

async function main() {
  await getDb();
  const pool = getPool();
  if (!pool) {
    console.error("No database pool available.");
    process.exit(1);
  }

  console.log("Ensuring user_registration_invites table in TiDB...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_registration_invites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      note VARCHAR(255) NULL,
      createdByUserId INT NULL,
      usedByUserId INT NULL,
      status ENUM('active', 'used', 'revoked', 'expired') DEFAULT 'active' NOT NULL,
      maxUses INT DEFAULT 1 NOT NULL,
      usedCount INT DEFAULT 0 NOT NULL,
      expiresAt BIGINT NULL,
      createdAt BIGINT NOT NULL,
      usedAt BIGINT NULL,
      INDEX user_reg_invites_status_idx (status),
      INDEX user_reg_invites_creator_idx (createdByUserId)
    );
  `);
  try {
    await pool.query(`ALTER TABLE user_registration_invites MODIFY COLUMN createdByUserId INT NULL;`);
  } catch (e) {
    // Already modified or compatible
  }

  console.log("Table user_registration_invites created/verified successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
