import { useEffect, useState } from "react";
import {
  completeWorkout,
  createTodayPlan,
  getMe,
  login,
  logout,
  setup,
  submitCheckin,
  type AuthUser,
  type DailyCheckinInput,
  type PlanResponsePlan
} from "./api";
import { StatusForm } from "./components/StatusForm";
import { TodayPlan } from "./components/TodayPlan";
import { Layout, type AppTab } from "./components/Layout";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [todayPlan, setTodayPlan] = useState<PlanResponsePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [finishLoading, setFinishLoading] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [todayInfo, setTodayInfo] = useState<string | null>(null);

  async function handleStatusSubmit(status: DailyCheckinInput) {
    setPlanLoading(true);
    setTodayError(null);
    setTodayInfo(null);

    try {
      await submitCheckin(status);
      const result = await createTodayPlan(status.date);
      setTodayPlan(result.plan);
      setTodayInfo("今天任务已生成。");
    } catch {
      setTodayError("今天任务生成失败，请检查服务器连接。");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleFinishTodayWorkout() {
    if (!todayPlan) {
      return;
    }

    setFinishLoading(true);
    setTodayError(null);
    setTodayInfo(null);

    try {
      await completeWorkout(todayPlan.id, { completionStatus: "completed" });
      setTodayInfo("训练完成已记录。");
    } catch {
      setTodayError("训练完成记录提交失败。");
    } finally {
      setFinishLoading(false);
    }
  }

  useEffect(() => {
    getMe()
      .then((response) => setAuthUser(response.user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="center-screen">
        <div className="status-card">
          <p className="eyebrow">正在连接本地服务器</p>
          <h1>锻体修容</h1>
          <p>检查登录状态中。</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen onAuthed={setAuthUser} />;
  }

  return (
    <Layout activeTab={activeTab} username={authUser.username} onTabChange={setActiveTab}>
      {activeTab === "today" && (
        <section className="stack">
          <StatusForm date={todayDate()} loading={planLoading} onSubmit={handleStatusSubmit} />
          {todayError && <p className="error-text">{todayError}</p>}
          {todayInfo && <p className="success-text">{todayInfo}</p>}
          <TodayPlan plan={todayPlan} finishing={finishLoading} onFinishWorkout={handleFinishTodayWorkout} />
        </section>
      )}
      {activeTab === "records" && <RecordsPlaceholder />}
      {activeTab === "posture" && <PosturePlaceholder />}
      {activeTab === "settings" && <SettingsPlaceholder onLogout={() => handleLogout(setAuthUser)} />}
    </Layout>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("liang");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"login" | "setup" | null>(null);

  async function runAuth(action: "login" | "setup") {
    setError(null);
    setPendingAction(action);

    try {
      const response =
        action === "login" ? await login(username, password) : await setup(username, password);
      onAuthed(response.user);
    } catch {
      setError(action === "login" ? "登录失败，检查密码或先完成本地账号设置。" : "设置失败，可能账号已存在。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="center-screen">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          void runAuth("login");
        }}
      >
        <p className="eyebrow">本地私有训练 App</p>
        <h1>锻体修容</h1>
        <p className="muted">Mac 做服务器，手机通过 Tailscale 访问。照片和训练数据只走本地。</p>

        <label>
          账号
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>

        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="button-row">
          <button type="submit" disabled={pendingAction !== null}>
            {pendingAction === "login" ? "登录中" : "登录"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runAuth("setup")}
          >
            {pendingAction === "setup" ? "设置中" : "首次设置"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RecordsPlaceholder() {
  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">记录</p>
        <h2>趋势比单日更重要</h2>
        <p>这里会展示腰酸、睡眠、精神、体重和训练完成率。</p>
      </div>
    </section>
  );
}

function PosturePlaceholder() {
  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">体态</p>
        <h2>每周固定角度留档</h2>
        <p>后续支持正面、侧面、背面照片并排对比。</p>
      </div>
    </section>
  );
}

function SettingsPlaceholder({ onLogout }: { onLogout: () => void }) {
  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">设置</p>
        <h2>本地服务器和隐私</h2>
        <p>DeepSeek 默认关闭，照片不发第三方 AI。</p>
        <button className="secondary-button" type="button" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </section>
  );
}

async function handleLogout(setAuthUser: (user: AuthUser | null) => void) {
  await logout().catch(() => undefined);
  setAuthUser(null);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
