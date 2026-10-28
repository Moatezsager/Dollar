export async function requestWorkerMaintenance(): Promise<void> {
  const base = (process.env.WORKER_SERVER_URL || '').trim().replace(/\/$/, '');
  const secret = (process.env.WORKER_INTERNAL_SECRET || '').trim();
  if (!base || !secret) throw new Error('خدمة Worker أو مفتاح الربط غير مضبوطين.');

  const response = await fetch(`${base}/internal/jobs/maintenance`, {
    method: 'POST',
    headers: { 'X-Worker-Secret': secret, 'User-Agent': 'Dollar-Price-Web/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 202 && response.status !== 409) {
    throw new Error(`تعذر إرسال مهمة الأرشفة إلى Worker (HTTP ${response.status}).`);
  }
}
