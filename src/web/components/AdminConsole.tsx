import { useEffect, useState } from "react";
import { getAdminStats, type AdminStatsResponse } from "../api";

interface AdminConsoleProps {
  username: string;
  onLogout: () => void;
}

export function AdminConsole({ username, onLogout }: AdminConsoleProps) {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminStats()
      .then((response) => {
        if (active) setStats(response);
      })
      .catch(() => {
        if (active) setError("运营数据暂时无法读取，请稍后刷新。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin-console-page">
      <header className="admin-console-header">
        <div className="brand-lockup">
          <span className="app-mark" aria-hidden="true">数</span>
          <div className="brand-copy">
            <strong>姿序运营后台</strong>
            <span>仅管理员账号可访问</span>
          </div>
        </div>
        <div className="admin-console-actions">
          <span className="date-pill">{username}</span>
          <a className="secondary-button" href="/">返回姿序</a>
          <button type="button" className="secondary-button" onClick={onLogout}>退出登录</button>
        </div>
      </header>

      <main className="admin-console-main">
        <div className="admin-console-heading">
          <div>
            <p className="eyebrow">私有后台</p>
            <h1>运营数据</h1>
            <p className="muted">用户、活跃、训练使用与网站访问聚合数据，不展示账号或健康明细。</p>
          </div>
          <span className="date-pill">仅管理员</span>
        </div>

        {loading && <section className="card setting-panel"><p className="muted">正在读取运营数据…</p></section>}
        {error && <p className="error-text" role="alert">{error}</p>}
        {stats && <AdminAnalyticsDashboard stats={stats} />}
      </main>
    </div>
  );
}

function AdminAnalyticsDashboard({ stats }: { stats: AdminStatsResponse }) {
  return (
    <div className="stack admin-dashboard">
      <section className="card setting-panel">
        <div className="mini-head">
          <div>
            <p className="eyebrow">用户</p>
            <h2 className="section-title">账号与活跃</h2>
          </div>
        </div>
        <div className="admin-metric-grid">
          <AdminMetric label="有效账号" value={stats.users.total} />
          <AdminMetric label="已建档" value={stats.users.onboarded} />
          <AdminMetric label="7 天新增" value={stats.users.new7d} />
          <AdminMetric label="30 天新增" value={stats.users.new30d} />
          <AdminMetric label="7 天活跃" value={stats.users.active7d} />
          <AdminMetric label="30 天活跃" value={stats.users.active30d} />
        </div>
      </section>

      <section className="card setting-panel">
        <p className="eyebrow">训练使用</p>
        <h2 className="section-title">聚合活动</h2>
        <div className="admin-metric-grid three-columns">
          <AdminMetric label="7 天状态记录" value={stats.activity.checkins7d} />
          <AdminMetric label="7 天完成训练" value={stats.activity.completedWorkouts7d} />
          <AdminMetric label="累计完成训练" value={stats.activity.completedWorkoutsTotal} />
        </div>
      </section>

      <section className={`card setting-panel ${stats.traffic.available ? "traffic-ready-card" : "traffic-pending-card"}`}>
        <div className="mini-head">
          <div>
            <p className="eyebrow">网站访问</p>
            <h2 className="section-title">{stats.traffic.available ? "GoAccess 访问统计" : "访问统计尚未接入"}</h2>
          </div>
          <span className="date-pill">{stats.traffic.available ? "已接入" : "待配置"}</span>
        </div>
        <p className="muted small">
          {stats.traffic.available
            ? "统计来自服务器 Nginx 访问日志，可查看真实访问量、访客趋势和热门页面。"
            : "服务器尚未提供访问统计，因此这里不显示假数据。"}
        </p>
        {stats.traffic.available && stats.traffic.dashboardUrl && (
          <a
            className="secondary-button update-install-link"
            href={stats.traffic.dashboardUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开访问统计
          </a>
        )}
      </section>

      <p className="muted small admin-generated-at">数据生成于 {formatAdminTimestamp(stats.generatedAt)}；本页只显示聚合数字。</p>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("zh-CN")}</strong>
    </div>
  );
}

function formatAdminTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
