import { LockKeyhole, RefreshCw } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import type { AuthView } from '../hooks/useSyncedPrivyAuth';

type AppLayoutProps = {
  auth: AuthView;
};

export function AppLayout({ auth }: AppLayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="top-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/memes"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            Meme launches
          </NavLink>
          <button
            className="back-button"
            type="button"
            aria-label="Refresh"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} strokeWidth={2} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="top-actions">
          {!auth.ready ? (
            <button className="login-button" type="button" disabled>
              <LockKeyhole size={14} />
              <span>Restoring…</span>
            </button>
          ) : !auth.authenticated ? (
            <button
              className="login-button"
              type="button"
              disabled={!auth.privyConfigured}
              onClick={auth.onAuthClick}
              title={
                auth.privyConfigured
                  ? 'Connect with Privy'
                  : 'Set VITE_PRIVY_APP_ID to enable Privy'
              }
            >
              <LockKeyhole size={14} />
              <span>
                {auth.privyConfigured ? 'Login' : 'Privy app id required'}
              </span>
            </button>
          ) : null}
          <span className="version-pill">v2</span>
        </div>
      </header>

      <Outlet />
    </main>
  );
}
