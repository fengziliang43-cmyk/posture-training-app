import type { ReactNode } from "react";

export type AppTab = "today" | "records" | "posture" | "settings";

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: "today", label: "今日" },
  { id: "records", label: "记录" },
  { id: "posture", label: "体态" },
  { id: "settings", label: "设置" }
];

interface LayoutProps {
  activeTab: AppTab;
  username?: string;
  children: ReactNode;
  onTabChange: (tab: AppTab) => void;
}

export function Layout({ activeTab, username, children, onTabChange }: LayoutProps) {
  const displayName = username === "liang" ? "良" : username ?? "未登录";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="app-mark" aria-hidden="true">锻</span>
          <div className="brand-copy">
            <strong>锻体修容</strong>
            <span>状态档案型教练</span>
          </div>
        </div>
        <div className="user-pill">{displayName}</div>
      </header>

      <main className="page-content">{children}</main>

      <nav className="bottom-nav" aria-label="主导航">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
