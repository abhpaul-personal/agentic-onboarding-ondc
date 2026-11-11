export const AUDIT_KINDS = ["agent", "human", "check", "sys"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export interface AuditLogEntry {
  at: string; // ISO timestamp
  kind: AuditKind;
  text: string;
}

/** Appends one audit entry. Every approval, edit and rejection goes through this (PRD "How gates behave"). */
export function appendAudit<T extends { auditLog: AuditLogEntry[] }>(
  state: T,
  kind: AuditKind,
  text: string,
): T {
  return {
    ...state,
    auditLog: [...state.auditLog, { at: new Date().toISOString(), kind, text }],
  };
}
