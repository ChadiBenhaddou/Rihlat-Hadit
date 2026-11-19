/** Labels for the editorial tools (client-safe; no server code). */
export const ROLE_AR: Record<string, string> = { editor: 'محرر', reviewer: 'مراجع', admin: 'مدير' };
export const KIND_AR: Record<string, string> = {
  chain_warning: 'تنبيه في الإسناد',
  unplaced_kg_entry: 'موضع لم يُربط برقم',
  numbering_by_order_only: 'رقم بالترتيب وحده',
  number_missing_from_all_sources: 'رقم غائب عن المصادر',
  honorific_missing: 'صيغة الترضّي لم تُحدَّد',
};
