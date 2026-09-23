import "dotenv/config";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB available");
    process.exit(1);
  }

  console.log("Creating bank_certificates table...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bank_certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspaceId INT NOT NULL,
      profileId INT NOT NULL,
      certificateName VARCHAR(160) NOT NULL,
      bankName VARCHAR(160) NOT NULL,
      principalAmount DECIMAL(20, 6) NOT NULL,
      interestRate DECIMAL(12, 6) NOT NULL,
      payoutFrequency ENUM('monthly', 'quarterly', 'semi_annual', 'annual') DEFAULT 'monthly' NOT NULL,
      issueDate BIGINT NOT NULL,
      maturityDate BIGINT NOT NULL,
      linkedPayoutAccountId INT NULL,
      currency VARCHAR(3) DEFAULT 'EGP' NOT NULL,
      status ENUM('active', 'matured', 'redeemed') DEFAULT 'active' NOT NULL,
      lastYieldCollectedAt BIGINT NULL,
      createdAt BIGINT NOT NULL,
      updatedAt BIGINT NOT NULL,
      INDEX bank_certificates_workspace_status_idx (workspaceId, status),
      INDEX bank_certificates_workspace_idx (workspaceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating credit_card_installments table...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS credit_card_installments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspaceId INT NOT NULL,
      debtId INT NOT NULL,
      merchantName VARCHAR(160) NOT NULL,
      planName VARCHAR(160) NOT NULL,
      totalAmount DECIMAL(20, 6) NOT NULL,
      monthlyAmount DECIMAL(20, 6) NOT NULL,
      tenureMonths INT NOT NULL,
      remainingMonths INT NOT NULL,
      startDate BIGINT NOT NULL,
      status ENUM('active', 'completed', 'cancelled') DEFAULT 'active' NOT NULL,
      createdAt BIGINT NOT NULL,
      updatedAt BIGINT NOT NULL,
      INDEX cc_installments_workspace_debt_idx (workspaceId, debtId, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("All tables created successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("Error creating tables:", err);
  process.exit(1);
});
