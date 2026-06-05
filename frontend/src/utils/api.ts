const API_BASE_URL = "http://localhost:5000/api";

export const getAuthToken = () => localStorage.getItem("scm-token");
export const setAuthToken = (token: string) => localStorage.setItem("scm-token", token);
export const removeAuthToken = () => localStorage.removeItem("scm-token");

interface RequestOptions extends RequestInit {
  body?: any;
}

export const apiFetch = async (endpoint: string, options: RequestOptions = {}) => {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
};
