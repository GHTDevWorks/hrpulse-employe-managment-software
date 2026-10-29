import { AxiosError } from 'axios';

// Demo mode: answer API calls inside the browser instead of over the network.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

let serverPromise = null;
const server = () => (serverPromise ||= import('./server.js'));

const headerOf = (headers, name) => headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()] ?? '';

export async function demoAdapter(config) {
  const { handle } = await server();
  let body = config.data;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const auth = String(headerOf(config.headers, 'Authorization') || '');
  const { status, data } = handle({
    method: config.method || 'get',
    path: config.url || '/',
    query: Object.fromEntries(Object.entries(config.params || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])),
    body: body || {},
    token: auth.replace(/^Bearer\s+/i, ''),
  });
  // Small delay so loading states behave like a real network.
  await new Promise((r) => setTimeout(r, 120));
  const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
  if (status >= 400) {
    throw new AxiosError(data?.message || 'Request failed', status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
  }
  return response;
}

export async function resetDemo() {
  const { resetDemoData } = await server();
  resetDemoData();
}
