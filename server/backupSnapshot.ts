export type BackupEnvelope<T> = { format: "family-backup-v1"; createdAt: number; workspaceId: number; payload: T };

export function createBackupEnvelope<T>(workspaceId: number, payload: T, createdAt = Date.now()): BackupEnvelope<T> {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new Error("مساحة النسخة الاحتياطية غير صالحة.");
  return { format: "family-backup-v1", createdAt, workspaceId, payload };
}
