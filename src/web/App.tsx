import { useEffect, useState } from "react";
import {
  completeWorkout,
  createTodayPlan,
  describeApiError,
  flushQueuedOfflineActions,
  getAuthCapabilities,
  getMe,
  getRecentCheckins,
  getTodayPlan,
  login,
  logout,
  register,
  submitCheckin,
  type AuthUser,
  type DailyCheckinInput,
  type PlanResponsePlan
} from "./api";
import { RecordsView } from "./components/RecordsView";
import { PostureView } from "./components/PostureView";
import { MeView, type MeRoute } from "./components/SettingsView";
import { TodayView } from "./components/TodayView";
import { Layout, type AppTab } from "./components/Layout";
import { OnboardingView } from "./components/OnboardingView";
import { SiteFooter } from "./components/SiteFooter";
import { formatLocalDate } from "../core/date";
import type { ExerciseResult } from "../core/types";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [meRoute, setMeRoute] = useState<MeRoute>("home");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [todayPlan, setTodayPlan] = useState<PlanResponsePlan | null>(null);
  const [todayMode, setTodayMode] = useState<"overview" | "task">("overview");
  const [latestStatus, setLatestStatus] = useState<DailyCheckinInput | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [finishLoading, setFinishLoading] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [todayInfo, setTodayInfo] = useState<string | null>(null);

  async function handleStatusSubmit(status: DailyCheckinInput) {
    setPlanLoading(true);
    setTodayError(null);
    setTodayInfo(null);

    try {
      const checkinResponse = await submitCheckin(status);
      const result = await createTodayPlan(status.date);
      setLatestStatus(checkinResponse.checkin);
      setTodayPlan(result.plan);
      setTodayMode("overview");
      setTodayInfo(
        Object.values(status.redFlags ?? {}).some(Boolean)
          ? "风险信号已记录，今天停止训练。"
          : "今天任务已生成。"
      );
    } catch {
      setTodayError("今天任务生成失败，请检查服务器连接。");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleFinishTodayWorkout(
    lowBackPainAfter: number,
    exerciseResults: ExerciseResult[]
  ) {
    if (!todayPlan) {
      return;
    }

    setFinishLoading(true);
    setTodayError(null);
    setTodayInfo(null);

    try {
      const result = await completeWorkout(todayPlan.id, {
        lowBackPainAfter,
        exerciseResults
      });
      setTodayInfo(result.queued ? "网络暂不可用，已离线保存，联网后自动同步。" : "训练完成已记录。");
    } catch {
      setTodayError("训练完成记录提交失败。");
    } finally {
      setFinishLoading(false);
    }
  }

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    if (tab === "today") {
      setTodayMode("overview");
    }
    if (tab === "me") {
      setMeRoute("home");
    }
  }

  function openMeRoute(route: MeRoute) {
    setMeRoute(route);
    setActiveTab("me");
  }

  useEffect(() => {
    getMe()
      .then((response) => setAuthUser(response.user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!authUser?.onboardingCompleted) return;

    getTodayPlan(formatLocalDate())
      .then((response) => setTodayPlan(response.plan))
      .catch(() => undefined);

    getRecentCheckins()
      .then((response) => {
        const today = response.checkins.find((checkin) => checkin.date === formatLocalDate());
        if (today) setLatestStatus(today);
      })
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
          <p className="eyebrow">正在连接姿序</p>
          <h1>姿序</h1>
          <p>检查登录状态中。</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen onAuthed={setAuthUser} />;
  }

  if (!authUser.onboardingCompleted) {
    return (
      <OnboardingView
        username={authUser.username}
        onComplete={() => setAuthUser({ ...authUser, onboardingCompleted: true })}
      />
    );
  }

  return (
    <Layout activeTab={activeTab} username={authUser.username} onTabChange={handleTabChange}>
      {activeTab === "today" && (
        <TodayView
          date={formatLocalDate()}
          plan={todayPlan}
          loading={planLoading}
          finishing={finishLoading}
          error={todayError}
          info={todayInfo}
          mode={todayMode}
          latestStatus={latestStatus}
          onModeChange={setTodayMode}
          onSubmitStatus={handleStatusSubmit}
          onFinishWorkout={handleFinishTodayWorkout}
          onPlanChange={setTodayPlan}
          onOpenSettings={() => openMeRoute("deepseek")}
        />
      )}
      {activeTab === "records" && <RecordsView />}
      {activeTab === "posture" && <PostureView />}
      {activeTab === "me" && (
        <MeView
          route={meRoute}
          username={authUser.username}
          onRouteChange={setMeRoute}
          onOpenRecords={() => setActiveTab("records")}
          onOpenPosture={() => setActiveTab("posture")}
          onLogout={() => handleLogout(setAuthUser)}
        />
      )}
    </Layout>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"login" | "register" | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  async function refreshRegistrationCapability() {
    try {
      const capabilities = await getAuthCapabilities();
      setRegistrationEnabled(capabilities.registrationEnabled);
      if (!capabilities.registrationEnabled) setMode("login");
    } catch {
      setRegistrationEnabled(false);
      setMode("login");
    }
  }

  useEffect(() => {
    void refreshRegistrationCapability();
  }, []);

  async function runAuth() {
    setError(null);
    setInfo(null);
    if (mode === "register") {
      if (!registrationEnabled) {
        setError("当前未开放新账号注册。");
        return;
      }
      if (password !== passwordConfirmation) {
        setError("两次输入的密码不一致。");
        return;
      }
      if (!adultConfirmed || !termsAccepted) {
        setError("开放注册目前仅支持已满 18 岁用户，且需同意使用与隐私说明。");
        return;
      }
    }
    setPendingAction(mode);

    try {
      const response =
        mode === "login"
          ? await login(username, password)
          : await register({ username, password, adultConfirmed, termsAccepted });
      onAuthed(response.user);
    } catch (error) {
      setError(
        mode === "login"
          ? `登录失败：${describeApiError(error)}`
          : `注册失败：${describeApiError(error)}`
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="center-screen">
      <div className="auth-shell">
        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            void runAuth();
          }}
        >
        <p className="eyebrow">个人化运动与状态匹配</p>
        <h1>姿序</h1>
        <p className="muted">先按你的体能、目标与器械建立运动库，再按当天精力、疼痛和可用时间生成任务。</p>

        {registrationEnabled && (
          <div className="auth-mode-switch" aria-label="登录或注册">
            <button
              className={mode === "login" ? "selected" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
            >
              登录
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
                setInfo(null);
              }}
            >
              注册
            </button>
          </div>
        )}

        <label>
          账号
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_.-]+"
            placeholder="3–32 位英文、数字或 _.-"
            required
          />
        </label>

        <label>
          密码
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={mode === "login" ? 6 : 10}
            maxLength={128}
            placeholder={mode === "register" ? "至少 10 位" : "输入密码"}
            required
          />
        </label>

        {mode === "register" && (
          <>
            <label>
              再输入一次密码
              <input
                autoComplete="new-password"
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={10}
                maxLength={128}
                required
              />
            </label>
            <label className="check-row consent-row">
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(event) => setAdultConfirmed(event.target.checked)}
              />
              <span>我已满 18 岁。</span>
            </label>
            <label className="check-row consent-row">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>我已阅读并同意下方的使用与隐私说明。</span>
            </label>
            <details className="privacy-summary">
              <summary>使用与隐私说明摘要</summary>
              <p>账号和密码用于登录；年龄段、体能、运动目标、当日状态等用于训练匹配。身高体重可选，姿势照片不是必填项。姿序不做医疗诊断或治疗；动作视频会打开哔哩哔哩第三方页面。</p>
            </details>
          </>
        )}

        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}

        <div className="button-row">
          <button type="submit" disabled={pendingAction !== null}>
            {pendingAction === mode ? (mode === "login" ? "登录中" : "注册中") : (mode === "login" ? "登录" : "注册并开始建档")}
          </button>
        </div>
        </form>
        <SiteFooter />
      </div>
    </div>
  );
}

async function handleLogout(setAuthUser: (user: AuthUser | null) => void) {
  await logout().catch(() => undefined);
  setAuthUser(null);
}
