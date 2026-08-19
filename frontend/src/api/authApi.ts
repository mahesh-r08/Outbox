import { apiClient } from './client.js';
import type { User, ApiResponse } from '../types/index.js';

/**
 * Fetch the currently authenticated user from the session.
 * If an auth_token exists in the URL from OAuth callback, exchanges it for a persistent session.
 * Returns null if not authenticated (401).
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');

    if (authToken) {
      try {
        const exchangeRes = await apiClient.post<ApiResponse<User & { token?: string }>>('/auth/exchange-token', {
          token: authToken,
        });

        // Clean query parameter from URL
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        if (exchangeRes.data.data) {
          if (exchangeRes.data.data.token) {
            localStorage.setItem('reachinbox_token', exchangeRes.data.data.token);
          }
          return exchangeRes.data.data;
        }
      } catch (exchangeErr) {
        console.error('Failed to exchange OAuth token:', exchangeErr);
      }
    }

    const res = await apiClient.get<ApiResponse<User & { token?: string }>>('/auth/me');
    if (res.data.data?.token) {
      localStorage.setItem('reachinbox_token', res.data.data.token);
    }
    return res.data.data || null;
  } catch {
    return null;
  }
}

/**
 * Destroy the current session and log out.
 */
export async function logoutUser(): Promise<void> {
  localStorage.removeItem('reachinbox_token');
  await apiClient.post('/auth/logout');
}

