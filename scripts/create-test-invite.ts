import "dotenv/config";
import { getDb } from "../server/db";
import { userRegistrationInvites } from "../drizzle/schema";
import { generateInviteCodeString } from "../server/localAuth";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB unavailable");
    process.exit(1);
  }

  const code = generateInviteCodeString();
  const now = Date.now();
  await db.insert(userRegistrationInvites).values({
    code,
    note: "كود دعوة ترحيبي تجريبي للمستخدم المستقل الجديد",
    status: "active",
    maxUses: 1,
    usedCount: 0,
    expiresAt: now + 30 * 24 * 3600 * 1000,
    createdAt: now,
  });

  console.log("INVITE_CODE_GENERATED:", code);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
