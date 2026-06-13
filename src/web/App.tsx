import { useEffect, useState } from "react";
import {
  completeWorkout,
  createTodayPlan,
  describeApiError,
  describeServerConnectionResult,
  flushQueuedOfflineActions,
  getApiBaseUrl,
  getMe,
  getTodayPlan,
  login,
  logout,
  setApiBaseUrl,
  setup,
  submitCheckin,
  testServerConnection,
  type AuthUser,
  type DailyCheckinInput,
  type PlanResponsePlan
} from "./api";
import { StatusForm } from "./components/StatusForm";
import { RecordsView } from "./components/RecordsView";
import { PostureView } from "./components/PostureView";
import { SettingsView } from "./components/SettingsView";
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
      setTodayInfo(navigator.onLine ? "训练完成已记录。" : "已离线保存，联网后自动同步。");
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

  useEffect(() => {
    if (!authUser) return;

    getTodayPlan(todayDate())
      .then((response) => setTodayPlan(response.plan))
      .catch(() => undefined);

    flushQueuedOfflineActions()
      .then((flushed) => {
        if (flushed > 0) setTodayInfo(`已同步 ${flushed} 条离线记录。`);
      })
      .catch(() => undefined);

    function handleOnline() {
      flushQueuedOfflineActions()
        .then((flushed) => {
          if (flushed > 0) setTodayInfo(`已同步 ${flushed} 条离线记录。`);
        })
        .catch(() => undefined);
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [authUser]);

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
      {activeTab === "records" && <RecordsView />}
      {activeTab === "posture" && <PostureView />}
      {activeTab === "settings" && (
        <SettingsView username={authUser.username} onLogout={() => handleLogout(setAuthUser)} />
      )}
    </Layout>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("liang");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"login" | "setup" | null>(null);

  async function runAuth(action: "login" | "setup") {
    setError(null);
    setInfo(null);
    setPendingAction(action);

    try {
      const normalized = setApiBaseUrl(serverUrl);
      setServerUrl(normalized);
      const response =
        action === "login" ? await login(username, password) : await setup(username, password);
      onAuthed(response.user);
    } catch (error) {
      setError(
        action === "login"
          ? `登录失败：${describeApiError(error)}`
          : `首次设置失败：${describeApiError(error)}`
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleServerTest() {
    setError(null);
    setInfo(null);
    setPendingAction("login");

    try {
      const normalized = setApiBaseUrl(serverUrl);
      setServerUrl(normalized);
      const result = await testServerConnection(normalized);
      const message = describeServerConnectionResult(result);
      if (result.ok) {
        setInfo(message);
      } else {
        setError(message);
      }
    } catch (error) {
      setError(`Mac server 测试异常：${describeApiError(error)}`);
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

        <label>
          Mac server 地址
          <input
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="浏览器留空；APK 填 http://Tailscale-IP:8787"
          />
        </label>
        <p className="muted small">浏览器开发时可以留空；手机 APK 需要填 Mac 的 Tailscale 地址。</p>

        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}

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
          <button
            className="secondary-button"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void handleServerTest()}
          >
            测试连接
          </button>
        </div>
      </form>
    </div>
  );
}

async function handleLogout(setAuthUser: (user: AuthUser | null) => void) {
  await logout().catch(() => undefined);
  setAuthUser(null);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
