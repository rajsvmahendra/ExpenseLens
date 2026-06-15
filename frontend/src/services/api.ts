const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Helper to get auth token from localStorage
export const getAuthToken = () => localStorage.getItem('expenselens_token');
export const setAuthToken = (token: string) => localStorage.setItem('expenselens_token', token);
export const removeAuthToken = () => localStorage.removeItem('expenselens_token');

export const getStoredUser = () => {
  const user = localStorage.getItem('expenselens_user');
  return user ? JSON.parse(user) : null;
};
export const setStoredUser = (user: any) => localStorage.setItem('expenselens_user', JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem('expenselens_user');

// Centralized request handler. Throws BACKEND_DISCONNECTED if connection fails.
async function request(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Token ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        removeAuthToken();
        removeStoredUser();
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }
    
    if (res.status === 204) return null;
    return await res.json();
  } catch (e: any) {
    console.error(`API Request failed for ${url}:`, e);
    // If fetch failed completely (backend down)
    if (e instanceof TypeError || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError') || e.message?.includes('network')) {
      throw new Error('BACKEND_DISCONNECTED');
    }
    throw e;
  }
}

// API functions connected to Django REST Framework backend
export const api = {
  auth: {
    register: async (data: any) => {
      const res = await request('/auth/register/', { method: 'POST', body: JSON.stringify(data) });
      if (res && res.token) {
        setAuthToken(res.token);
        setStoredUser({ id: res.user_id, username: res.username, email: res.email });
      }
      return res;
    },
    login: async (data: any) => {
      const res = await request('/auth/login/', { method: 'POST', body: JSON.stringify(data) });
      if (res && res.token) {
        setAuthToken(res.token);
        // Put a basic user profile in state (username as entered)
        setStoredUser({ id: 1, username: data.username, email: `${data.username}@expenselens.com` });
      }
      return res;
    },
    logout: () => {
      removeAuthToken();
      removeStoredUser();
    }
  },
  groups: {
    list: () => request('/groups/'),
    retrieve: (id: string) => request(`/groups/${id}/`),
    create: (data: any) => request('/groups/', { method: 'POST', body: JSON.stringify(data) }),
    getBalances: (id: string) => request(`/groups/${id}/balances/`)
  },
  memberships: {
    list: (groupId?: string) => request(groupId ? `/memberships/?group=${groupId}` : '/memberships/'),
    create: (data: any) => request('/memberships/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/memberships/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
  },
  expenses: {
    list: (groupId?: string) => request(groupId ? `/expenses/?group=${groupId}` : '/expenses/'),
    create: (data: any) => request('/expenses/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/expenses/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/expenses/${id}/`, { method: 'DELETE' })
  },
  settlements: {
    list: (groupId?: string) => request(groupId ? `/settlements/?group=${groupId}` : '/settlements/'),
    create: (data: any) => request('/settlements/', { method: 'POST', body: JSON.stringify(data) })
  },
  anomalies: {
    list: (groupId?: string) => request(groupId ? `/anomalies/?group=${groupId}` : '/anomalies/'),
    resolve: (id: string, data: any) => request(`/anomalies/${id}/resolve/`, { method: 'POST', body: JSON.stringify(data) })
  },
  decisions: {
    list: (groupId?: string) => request(groupId ? `/decisions/?group=${groupId}` : '/decisions/')
  },
  imports: {
    list: (groupId?: string) => request(groupId ? `/import-batches/?group=${groupId}` : '/import-batches/'),
    upload: async (groupId: string, file: File) => {
      const formData = new FormData();
      formData.append('group', groupId);
      formData.append('file', file);
      
      const token = getAuthToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Token ${token}`);
      }

      try {
        const res = await fetch(`${API_BASE_URL}/import-batches/upload/`, {
          method: 'POST',
          headers,
          body: formData
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }
        return await res.json();
      } catch (e: any) {
        console.error("Upload fetch failed:", e);
        if (e instanceof TypeError || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
          throw new Error('BACKEND_DISCONNECTED');
        }
        throw e;
      }
    },
    getReport: (batchId: string) => request(`/import-batches/${batchId}/report/`),
    listRows: (batchId: string) => request(`/import-rows/?batch=${batchId}`)
  }
};
