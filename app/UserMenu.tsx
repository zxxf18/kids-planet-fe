'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { logout, startLogin, type AuthUser } from '../lib/auth';

export function UserMenu({ user }: { user: AuthUser | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelID = useId();
  const name = user?.display_name?.trim() || user?.username || user?.email || '用户';

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function handleLogout() {
    setBusy(true);
    setError('');
    try { await logout(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '退出失败，请重试。'); }
    finally { setBusy(false); }
  }

  if (!user) return <button className="user-trigger" type="button" onClick={() => startLogin()}>登录</button>;

  return <div className="user-menu" ref={root}>
    <button className="user-trigger" type="button" ref={trigger} aria-expanded={open} aria-controls={panelID} onClick={() => setOpen(!open)}>
      <span className="user-name" title={name}>{name}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="user-panel" id={panelID}>
      <div className="user-panel-heading"><strong title={name}>{name}</strong><span title={user.email}>{user.email}</span></div>
      <a href="https://sso.yebuluo.com.cn/account">用户资料 <span aria-hidden="true">↗</span></a>
      <p className="user-profile-hint">在统一账户中心修改资料</p>
      <button type="button" onClick={() => void handleLogout()} disabled={busy}>{busy ? '正在退出…' : '退出登录'}</button>
      {error && <p className="user-menu-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
