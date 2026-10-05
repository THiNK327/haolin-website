/** Public configuration only. Never put service keys or verification secrets here. */
export const playgroundConfig = {
  // Intentionally empty: no Railway service is deployed or contacted by this update.
  // Later: the HTTPS origin of the single backend, with no trailing /api path.
  apiBaseUrl: '',
  requestTimeoutMs: 30_000,
} as const;
