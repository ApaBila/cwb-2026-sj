/**
 * Compact owner label for dense tables / Gantt frozen column.
 * @param {string | null | undefined} ownerName
 * @param {string | null | undefined} ownerId
 * @returns {string}
 */
export function ownerInitials(ownerName, ownerId) {
  const raw = String(ownerName || ownerId || '').trim();
  if (!raw) return '—';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[parts.length - 1][0] || '';
    return (a + b).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

/**
 * Substring-search text for owner filters: display name, id, and {@link ownerInitials} (when shown).
 * @param {string | null | undefined} ownerName
 * @param {string | null | undefined} ownerId
 * @returns {string}
 */
export function ownerFilterHaystack(ownerName, ownerId) {
  const base = [ownerName, ownerId].filter(Boolean).join(' ').trim();
  const ini = ownerInitials(ownerName, ownerId);
  const initialsPart = ini === '—' ? '' : ini;
  return [base, initialsPart].filter(Boolean).join(' ').trim();
}
