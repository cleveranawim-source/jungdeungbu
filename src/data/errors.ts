/** Firestore 오류 코드가 permission-denied 인지. */
export function isPermissionDenied(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'permission-denied';
}
