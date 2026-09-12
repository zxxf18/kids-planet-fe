// Casdoor owns a separate host-only session cookie. Clearing just our cookie is
// not a complete logout; the credentialed request also ends that SSO session.
export async function endSSOSession(localEndpoint: string): Promise<void> {
  const [central, local] = await Promise.allSettled([
    fetch('https://sso.yebuluo.com.cn/api/logout', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    }).then(async (response) => {
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== 'object' || !('status' in body) || body.status !== 'ok') throw new Error('SSO logout failed');
    }),
    fetch(localEndpoint, {
      method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(10000),
    }).then((response) => {
      if (!response.ok) throw new Error('Local logout failed');
    }),
  ]);
  // Always attempt both. Never display success/reload into auto-login when one failed.
  if (central.status === 'rejected') throw new Error('未能完成统一退出，请检查网络后重试。');
  if (local.status === 'rejected') throw new Error('未能清除应用登录状态，请重试退出。');
}
