export const USER_STORAGE_KEY = "pt_user";
export const TOKEN_STORAGE_KEY = "pt_auth_token";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredUser() {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken() {
  if (!canUseStorage()) return "";
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

export function setSession({ user, token }) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token || "");
}

export function clearSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

