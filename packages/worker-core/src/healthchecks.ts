export type PingStatus = 'start' | 'success' | 'fail';

export async function ping(
  uuid: string | undefined,
  status: PingStatus = 'success',
  body?: string,
  onError?: (err: unknown) => void,
): Promise<void> {
  if (!uuid) return;
  const suffix = status === 'success' ? '' : `/${status}`;
  const url = `${'https://hc-ping.com'}/${uuid}${suffix}`;
  try {
    await fetch(url, {
      method: body !== undefined ? 'POST' : 'GET',
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    if (onError) onError(err);
  }
}

export async function withHeartbeat<T>(
  uuid: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  await ping(uuid, 'start');
  try {
    const result = await fn();
    await ping(uuid, 'success', String(Date.now() - t0));
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ping(uuid, 'fail', msg.slice(0, 1000));
    throw err;
  }
}
