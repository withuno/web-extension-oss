export type WrappedValue<T> = {
  expires_at: number;
  value: T;
};

export function isExpired<T>(w: WrappedValue<T>): boolean {
  if (w.expires_at == -1) return false;
  if (Date.now() / 1000 > w.expires_at) return true;

  return false;
}
