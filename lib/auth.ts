export type AuthUser = { sub: string; email: string; username: string; display_name: string; role: string };
export async function getCurrentUser(): Promise<AuthUser | null> { const response = await fetch('/api/v1/auth/me', { credentials: 'same-origin' }); if (!response.ok) return null; return response.json() as Promise<AuthUser>; }
export function startLogin(returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`) { window.location.href = `/auth/login?return_to=${encodeURIComponent(returnTo)}`; }
export async function logout() { await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }); window.location.reload(); }
