export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.your-domain.com';

export const fetcher = async (url: string) => {
  const res = await fetch(`${API_BASE_URL}${url}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message || 'エラーが発生しました');
    throw error;
  }
  return res.json();
};

export const apiFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE_URL}${url}`, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message || 'エラーが発生しました');
    (error as any).code = errorData?.error?.code;
    throw error;
  }
  return res.json();
};

export const createThread = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'スレッド作成に失敗しました');
  }
  return res.json();
};

import { getDeviceId } from '../utils/deviceId';

export const createPost = async (threadId: string, data: any) => {
  const payload = { ...data, deviceId: getDeviceId() };
  const res = await fetch(`${API_BASE_URL}/threads/${threadId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || '書き込みに失敗しました');
  }
  return res.json();
};
