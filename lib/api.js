'use client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://claudesounds-api.arx-app.com:4107';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = typeof status === 'number' ? status : 0;
    this.details = details;
  }
}

function buildUrl(path) {
  const base = String(API_BASE).replace(/\/+$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${base}${suffix}`;
}

function toQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const search = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

export async function request(path, options = {}) {
  const { method = 'GET', body, signal, headers } = options;

  const init = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
  };

  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  if (signal) init.signal = signal;

  let response;
  try {
    response = await fetch(buildUrl(path), init);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError(
      "We couldn't reach ClaudeSounds — try again in a moment.",
      0
    );
  }

  let payload = null;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      (payload && (payload.error || payload.message)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload && payload.details);
  }

  return payload;
}

export const auth = {
  signup: (data, signal) =>
    request('/api/auth/signup', { method: 'POST', body: data, signal }),
  login: (data, signal) =>
    request('/api/auth/login', { method: 'POST', body: data, signal }),
  logout: (signal) => request('/api/auth/logout', { method: 'POST', signal }),
  me: (signal) => request('/api/auth/me', { signal }),
};

export const releases = {
  list: (params, signal) =>
    request(`/api/releases${toQuery(params)}`, { signal }),
  get: (id, signal) => request(`/api/releases/${encodeURIComponent(id)}`, { signal }),
  create: (data, signal) =>
    request('/api/releases', { method: 'POST', body: data, signal }),
  update: (id, data, signal) =>
    request(`/api/releases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: data,
      signal,
    }),
  remove: (id, signal) =>
    request(`/api/releases/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  deliver: (id, signal) =>
    request(`/api/releases/${encodeURIComponent(id)}/deliver`, {
      method: 'POST',
      signal,
    }),
};

export const publishing = {
  listWorks: (params, signal) =>
    request(`/api/publishing/works${toQuery(params)}`, { signal }),
  getWork: (id, signal) =>
    request(`/api/publishing/works/${encodeURIComponent(id)}`, { signal }),
  createWork: (data, signal) =>
    request('/api/publishing/works', { method: 'POST', body: data, signal }),
  updateWork: (id, data, signal) =>
    request(`/api/publishing/works/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: data,
      signal,
    }),
  removeWork: (id, signal) =>
    request(`/api/publishing/works/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal,
    }),
};

export const campaigns = {
  list: (params, signal) =>
    request(`/api/campaigns${toQuery(params)}`, { signal }),
  create: (data, signal) =>
    request('/api/campaigns', { method: 'POST', body: data, signal }),
  update: (id, data, signal) =>
    request(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: data,
      signal,
    }),
  remove: (id, signal) =>
    request(`/api/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
};

export const analytics = {
  overview: (signal) => request('/api/analytics/overview', { signal }),
  timeseries: (days, signal) =>
    request(`/api/analytics/timeseries${toQuery({ days })}`, { signal }),
  topReleases: (params, signal) =>
    request(`/api/analytics/top-releases${toQuery(params)}`, { signal }),
  royalties: (signal) => request('/api/analytics/royalties', { signal }),
};

export const royalties = {
  listStatements: (signal) => request('/api/royalties/statements', { signal }),
  getRoyaltyBreakdown: (signal) => request('/api/royalties/breakdown', { signal }),
  requestPayout: (statementId, signal) =>
    request(`/api/royalties/statements/${encodeURIComponent(statementId)}/payout`, {
      method: 'POST',
      signal,
    }),
};

export const api = { request, auth, releases, publishing, campaigns, analytics, royalties, ApiError, API_BASE };

export default api;