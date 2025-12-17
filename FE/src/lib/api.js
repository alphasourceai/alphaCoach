import { supabase } from './supabaseClient';

const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

async function handleJson(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.error || data.message)) || text || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: await authHeaders(),
    credentials: 'omit',
  });
  return handleJson(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body || {}),
    credentials: 'omit',
  });
  return handleJson(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${base}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
    credentials: 'omit',
  });
  return handleJson(res);
}

export const api = { get: apiGet, post: apiPost, delete: apiDelete };
export default api;
