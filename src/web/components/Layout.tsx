import type { ReactNode } from "react";
import { Icon, type IconName } from "./ui";

export type AppTab = "today" | "records" | "posture" | "me";

export const mainTabs: ReadonlyArray<{ id: AppTab; label: string; icon: IconName }> = [
  { id: "today", label: "今日", icon: "today" },
  { id: "records", label: "记录", icon: "records" },
  { id: "posture", label: "体态", icon: "posture" },
  { id: "me", label: "我的", icon: "me" }
];

interface LayoutProps {
  activeTab: AppTab;
  /** Replaces the tab's name in the top bar, e.g. while a workout is open. */
  title?: string;
  /** Small line under the title: today's date on the Today tab. */
  subtitle?: string;
  hideNav?: boolean;
  children: ReactNode;
  onTabChange: (tab: AppTab) => void;
}

export function Layout({ activeTab, title, subtitle, hideNav = false, children, onTabChange }: LayoutProps) {
  const heading = title ?? mainTabs.find((tab) => tab.id === activeTab)?.label ?? "姿序";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="app-mark ink-logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <circle cx="12.5" cy="5" r="2.7" fill="#c8402f" stroke="none" />
            <path d="M12.5 9.6c-3.6 2.2-3.8 6.6-.9 9.4 1.2 1.2 2.4 1.8 3.6 2.1" stroke="#1f1e24" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <div className="top-bar-copy">
          <h1>{heading}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
      </header>

      <main className="page-content">{children}</main>

      {!hideNav && (
        <nav className="bottom-nav" aria-label="主导航">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "nav-item active" : "nav-item"}
              type="button"
              aria-current={tab.id === activeTab ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
