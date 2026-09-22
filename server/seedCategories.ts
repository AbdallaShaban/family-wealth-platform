import { and, eq } from "drizzle-orm";
import { cashFlowCategories } from "../drizzle/schema";
import { getDb } from "./db";

export interface DefaultCategoryDef {
  name: string;
  direction: "income" | "expense";
  color: string;
  isEssential: "yes" | "no";
}

export const DEFAULT_ARABIC_CATEGORIES: DefaultCategoryDef[] = [
  // 1. Incomes
  { name: "راتب شهري أساسي", direction: "income", color: "#10B981", isEssential: "no" },
  { name: "مكافأة وحوافز سنوية", direction: "income", color: "#059669", isEssential: "no" },
  { name: "أرباح استثمار وتوزيعات نقدية", direction: "income", color: "#6366F1", isEssential: "no" },
  { name: "دخل أعمال حرة واستشارات", direction: "income", color: "#0EA5E9", isEssential: "no" },
  { name: "إيراد عقاري وإيجارات", direction: "income", color: "#8B5CF6", isEssential: "no" },
  { name: "إيرادات وتدفقات أخرى", direction: "income", color: "#64748B", isEssential: "no" },

  // 2. Essential Expenses (Living & Operational)
  { name: "فواتير ومرافق (كهرباء، ماء، غاز، اتصالات)", direction: "expense", color: "#F59E0B", isEssential: "yes" },
  { name: "إيجار وسكن", direction: "expense", color: "#EF4444", isEssential: "yes" },
  { name: "التزامات شخصية وعائلية", direction: "expense", color: "#DC2626", isEssential: "yes" },
  { name: "طعام ومشتريات تموينية", direction: "expense", color: "#EA580C", isEssential: "yes" },
  { name: "صحة ورعاية طبية وأدوية", direction: "expense", color: "#E11D48", isEssential: "yes" },
  { name: "نقل ومواصلات ووقود", direction: "expense", color: "#D97706", isEssential: "yes" },
  { name: "تعليم ومصروفات دراسية", direction: "expense", color: "#7C3AED", isEssential: "yes" },

  // 3. Discretionary / Secondary Expenses
  { name: "صيانة دورية وإصلاحات منزلية", direction: "expense", color: "#B45309", isEssential: "no" },
  { name: "صدقات وزكاة وتبرعات", direction: "expense", color: "#0D9488", isEssential: "no" },
  { name: "ترفيه واشتراكات وخدمات رقمية", direction: "expense", color: "#4F46E5", isEssential: "no" },
  { name: "تسوق وملابس", direction: "expense", color: "#9333EA", isEssential: "no" },
  { name: "مصاريف شخصية متنوعة", direction: "expense", color: "#6B7280", isEssential: "no" },
];

/**
 * Ensures a workspace has the comprehensive suite of Arabic financial categories.
 * Idempotent: Only inserts categories that do not already exist by name.
 */
export async function ensureDefaultCategories(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const existing = await db
    .select({ name: cashFlowCategories.name })
    .from(cashFlowCategories)
    .where(eq(cashFlowCategories.workspaceId, workspaceId));

  const existingNames = new Set(existing.map((c) => c.name.trim()));
  const toInsert = DEFAULT_ARABIC_CATEGORIES.filter((c) => !existingNames.has(c.name.trim()));

  if (toInsert.length === 0) return 0;

  const now = Date.now();
  for (const cat of toInsert) {
    await db.insert(cashFlowCategories).values({
      workspaceId,
      name: cat.name,
      direction: cat.direction,
      color: cat.color,
      isEssential: cat.isEssential,
      isArchived: "no",
      createdAt: now,
      updatedAt: now,
    });
  }

  return toInsert.length;
}
