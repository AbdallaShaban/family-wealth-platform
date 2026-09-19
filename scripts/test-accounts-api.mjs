import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { sdk } from "../server/_core/sdk.js";
import { handleCreateAccount } from "../server/accountsHandler.js";

dotenv.config();

let dbUrl = process.env.DATABASE_URL;
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}

const pool = mysql.createPool({ uri: dbUrl, ssl: { rejectUnauthorized: true } });

// 1. Ensure test user and personal workspace exists
const testOpenId = "test_verification_user_2026";
const now = Date.now();

await pool.query(
  `INSERT INTO users (openId, name, email, role, loginMethod, createdAt, updatedAt, lastSignedIn)
   VALUES (?, ?, ?, 'user', 'local', NOW(), NOW(), NOW())
   ON DUPLICATE KEY UPDATE name = VALUES(name), lastSignedIn = NOW()`,
  [testOpenId, "مستخدم تجريبي", "test_user_2026@family.local"]
);

const [userRows] = await pool.query(`SELECT * FROM users WHERE openId = ?`, [testOpenId]);
const testUser = userRows[0];
console.log(`Test user ID: ${testUser.id}`);

// 2. Generate valid session token
const sessionToken = await sdk.createSessionToken(testOpenId, { name: testUser.name });

// 3. Test handleCreateAccount with initial balance
const idempotencyKey = `acc_test_${Date.now()}`;
const req = {
  headers: {
    cookie: `app_session_id=${sessionToken}`,
  },
  body: {
    name: "حساب تجريبي للتحقق من الرصيد",
    accountType: "bank",
    currency: "USD",
    institution: "البنك الأهلي التجاري",
    openingBalance: "7500.50",
    occurredAt: now,
    idempotencyKey,
  },
};

let statusCode = 0;
let responseJson = null;

const res = {
  status(code) {
    statusCode = code;
    return this;
  },
  json(data) {
    responseJson = data;
    return this;
  },
};

console.log("Invoking handleCreateAccount for TiDB Cloud verification...");
await handleCreateAccount(req, res);

console.log(`Response Status: ${statusCode}`);
console.log(`Response Data:`, responseJson);

if (statusCode !== 201 || !responseJson?.data?.accountId) {
  console.error("FAILED: Account creation did not return 201 created");
  process.exit(1);
}

const { accountId, openingEventId } = responseJson.data;

// 4. Verify in TiDB Cloud
const [accRows] = await pool.query(`SELECT * FROM accounts WHERE id = ?`, [accountId]);
console.log(`✓ Account found in TiDB Cloud: ${accRows[0].name}, type: ${accRows[0].accountType}, currency: ${accRows[0].currency}`);

const [eventRows] = await pool.query(`SELECT * FROM financial_events WHERE id = ?`, [openingEventId]);
console.log(`✓ Financial Event found in TiDB Cloud: type=${eventRows[0].eventType}, amount=${eventRows[0].grossAmount} ${eventRows[0].currency}`);

const [lines] = await pool.query(`SELECT * FROM journal_lines WHERE entryId IN (SELECT id FROM journal_entries WHERE eventId = ?)`, [openingEventId]);
console.log(`✓ Journal Lines in TiDB Cloud: ${lines.length} lines`);
for (const line of lines) {
  console.log(`   - Account ${line.accountId}: ${line.direction} ${line.amount} ${line.currency}`);
}

// 5. Cleanup test records
await pool.query(`DELETE FROM journal_lines WHERE entryId IN (SELECT id FROM journal_entries WHERE eventId = ?)`, [openingEventId]);
await pool.query(`DELETE FROM journal_entries WHERE eventId = ?`, [openingEventId]);
await pool.query(`DELETE FROM financial_events WHERE id = ?`, [openingEventId]);
await pool.query(`DELETE FROM audit_events WHERE workspaceId = ?`, [accRows[0].workspaceId]);
await pool.query(`DELETE FROM accounts WHERE id = ?`, [accountId]);
await pool.query(`DELETE FROM financial_profiles WHERE userId = ?`, [testUser.id]);
await pool.query(`DELETE FROM memberships WHERE userId = ?`, [testUser.id]);
await pool.query(`DELETE FROM workspaces WHERE id = ?`, [accRows[0].workspaceId]);
await pool.query(`DELETE FROM users WHERE id = ?`, [testUser.id]);
console.log("✓ Test records cleaned up successfully.");

await pool.end();
console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");
