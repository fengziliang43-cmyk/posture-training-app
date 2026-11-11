import type { ReactNode } from "react";

export type AppTab = "today" | "records" | "posture" | "me";

export const mainTabs: ReadonlyArray<{ id: AppTab; label: string }> = [
  { id: "today", label: "今日" },
  { id: "records", label: "记录" },
  { id: "posture", label: "体态" },
  { id: "me", label: "我的" }
];

interface LayoutProps {
  activeTab: AppTab;
  username?: string;
  hideNav?: boolean;
  children: ReactNode;
  onTabChange: (tab: AppTab) => void;
}

export function Layout({ activeTab, username, hideNav = false, children, onTabChange }: LayoutProps) {
  const displayName = username ?? "未登录";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="app-mark ink-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="12.5" cy="5" r="2.7" fill="#c8402f" stroke="none" />
              <path d="M12.5 9.6c-3.6 2.2-3.8 6.6-.9 9.4 1.2 1.2 2.4 1.8 3.6 2.1" stroke="#1f1e24" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </span>
          <div className="brand-copy">
            <strong>姿序</strong>
            <span>脊柱侧弯保守辅助训练</span>
          </div>
        </div>
        <div className="user-pill">{displayName}</div>
      </header>

      <main className="page-content">{children}</main>

      {!hideNav && (
        <nav className="bottom-nav" aria-label="主导航">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "nav-item active" : "nav-item"}
              type="button"
              onClick={() => onTabChange(tab.id)}
            >
              <NavIcon tab={tab.id} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function NavIcon({ tab }: { tab: AppTab }) {
  const path = {
    today: "M4 10.5h16M7 3v3m10-3v3M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Zm2 9 2.2 2.2L16 10.5",
    records: "M5 19V9m7 10V4m7 15v-6M3 21h18",
    posture: "M12 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 9l5-2 5 2m-5-2v6m0 0-4 8m4-8 4 8",
    me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"
  }[tab];

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
