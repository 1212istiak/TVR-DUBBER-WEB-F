import { API_BASE } from './config.js';

// Simplest possible admin auth: the plain admin password is kept in memory
// here (and mirrored to localStorage by admin.js so it survives a page
// refresh) and attached to every protected request — as a query param on
// GETs, merged into the JSON body on POST/PUT/DELETE. The backend re-checks
// it against the stored hash on every single request. No tokens, no
// sessions, nothing to expire.
let adminPassword = null;

export function setAdminPassword(pw) {
  adminPassword = pw;
}
export function getAdminPassword() {
  return adminPassword;
}
export function clearAdminPassword() {
  adminPassword = null;
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  let finalPath = path;
  let finalBody = body;

  if (auth) {
    if (!adminPassword) {
      const err = new Error('Not logged in');
      err.status = 401;
      throw err;
    }
    if (method === 'GET') {
      const sep = path.includes('?') ? '&' : '?';
      finalPath = `${path}${sep}password=${encodeURIComponent(adminPassword)}`;
    } else {
      finalBody = { ...(body || {}), password: adminPassword };
    }
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${finalPath}`, {
      method,
      headers,
      body: finalBody !== undefined ? JSON.stringify(finalBody) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Public
  getEpisodes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/episodes${qs ? `?${qs}` : ''}`);
  },
  getEpisode: (id) => request(`/api/episodes/${id}`),
  getTrailer: () => request('/api/trailer'),
  getSettings: () => request('/api/settings'),
  getVoiceArtists: () => request('/api/voice-artists'),
  getComments: (episodeId) => request(`/api/comments/${episodeId}`),
  postComment: (episodeId, body) => request(`/api/comments/${episodeId}`, { method: 'POST', body }),
  getReactions: (episodeId, visitorId) =>
    request(`/api/reactions/${episodeId}?visitorId=${encodeURIComponent(visitorId)}`),
  postReaction: (episodeId, body) => request(`/api/reactions/${episodeId}`, { method: 'POST', body }),

  // Admin auth — just checks the password, no token issued
  login: (password) => request('/api/admin/login', { method: 'POST', body: { password } }),
  changePassword: (body) => request('/api/admin/change-password', { method: 'POST', body }),

  // Admin — episodes
  createEpisode: (body) => request('/api/episodes', { method: 'POST', body, auth: true }),
  updateEpisode: (id, body) => request(`/api/episodes/${id}`, { method: 'PUT', body, auth: true }),
  deleteEpisode: (id) => request(`/api/episodes/${id}`, { method: 'DELETE', auth: true }),

  // Admin — trailer
  saveTrailer: (body) => request('/api/trailer', { method: 'POST', body, auth: true }),

  // Admin — settings
  updateSettings: (body) => request('/api/settings', { method: 'PUT', body, auth: true }),

  // Admin — voice artists
  addVoiceArtist: (name) => request('/api/voice-artists', { method: 'POST', body: { name }, auth: true }),
  deleteVoiceArtist: (id) => request(`/api/voice-artists/${id}`, { method: 'DELETE', auth: true }),

  // Admin — comment moderation
  getAllComments: () => request('/api/admin/comments', { auth: true }),
  deleteComment: (id) => request(`/api/admin/comments/${id}`, { method: 'DELETE', auth: true }),
};
