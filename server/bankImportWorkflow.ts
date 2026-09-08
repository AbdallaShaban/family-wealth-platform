export type ImportRowReviewState = { matchStatus: string; classification: string; categoryId: number | null; occurredAt: number | null; amount: string | null };

export function canPostImportedRow(row: ImportRowReviewState) {
  return row.matchStatus === "new" && ["income", "expense"].includes(row.classification) && Boolean(row.categoryId) && Boolean(row.occurredAt) && Boolean(row.amount) && Number(row.amount) !== 0;
}

export function shouldKeepImportInReview(rows: Array<Pick<ImportRowReviewState, "matchStatus">>) {
  return rows.some(row => !["posted", "excluded", "exact_duplicate"].includes(row.matchStatus));
}
