import { useEffect, useState } from "react";
import {
  completeWorkout,
  createTodayPlan,
  describeLoginError,
  describeRegistrationError,
  flushQueuedOfflineActions,
  getAuthCaptcha,
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
import { AdminConsole } from "./components/AdminConsole";
import { TodayView } from "./components/TodayView";
import { Layout, type AppTab } from "./components/Layout";
import { OnboardingView } from "./components/OnboardingView";
import { ScoliosisRiskGuide } from "./components/ScoliosisRiskGuide";
import { SiteFooter } from "./components/SiteFooter";
import { InstallOptions } from "./components/InstallOptions";
import { formatLocalDate } from "../core/date";
import type { ExerciseResult } from "../core/types";

export const ACCOUNT_IDENTIFIER_INPUT_PATTERN =
  "(?:[a-zA-Z0-9_.\\-]{3,32}|[^\\s@]+@[^\\s@]+\\.[^\\s@]+)";

export function isAdminConsolePath(pathname: string): boolean {
  return pathname === "/admin" || pathname === "/admin/";
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );
  const [meRoute, setMeRoute] = useState<MeRoute>("home");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [todayPlan, setTodayPlan] = useState<PlanResponsePlan | null>(null);
  const [todayMode, setTodayMode] = useState<"overview" | "task">("overview");
  const [latestStatus, setLatestStatus] = useState<DailyCheckinInput | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [finishLoading, setFinishLoading] = useState(false);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [todayInfo, setTodayInfo] = useState<string | null>(null);
  const [completedWorkout, setCompletedWorkout] = useState<{ lowBackPainAfter?: number; completedCount?: number } | null>(() => {
    try {
      const raw = localStorage.getItem(`posture-training.completed-workout.${formatLocalDate()}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash;
      setCurrentHash(hash);
      if (hash === "#today" || hash === "#records" || hash === "#posture" || hash === "#me") {
        setActiveTab(hash.slice(1) as AppTab);
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    if (window.location.hash) {
      handleHashChange();
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
      const completedInfo = {
        lowBackPainAfter,
        completedCount: exerciseResults.filter((r) => r.completionStatus === "completed").length
      };
      setCompletedWorkout(completedInfo);
      try {
        localStorage.setItem(
          `posture-training.completed-workout.${formatLocalDate()}`,
          JSON.stringify(completedInfo)
        );
      } catch {
        // ignore
      }
      setTodayInfo(result.queued ? "网络暂不可用，已离线保存，联网后自动同步。" : "训练完成已记录。");
      setTodayMode("overview");
    } catch {
      setTodayError("训练完成记录提交失败。");
    } finally {
      setFinishLoading(false);
    }
  }

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = `#${tab}`;
    }
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

  if (currentHash === "#guide") {
    return (
      <PublicGuideScreen
        onBack={() => {
          if (typeof window !== "undefined") {
            window.location.hash = authUser ? "#posture" : "";
          }
        }}
      />
    );
  }

  if (!authUser) {
    return (
      <AuthScreen
        initialInfo={authNotice}
        onOpenGuide={() => {
          if (typeof window !== "undefined") {
            window.location.hash = "#guide";
          }
        }}
        onAuthed={(user) => {
          setAuthNotice(null);
          setAuthUser(user);
        }}
      />
    );
  }

  if (typeof window !== "undefined" && isAdminConsolePath(window.location.pathname)) {
    if (authUser.role !== "admin") {
      return <AdminAccessDenied />;
    }
    return (
      <AdminConsole
        username={authUser.username}
        onLogout={() => void handleAdminLogout(setAuthUser)}
      />
    );
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
    <Layout
      activeTab={activeTab}
      username={authUser.username}
      hideNav={activeTab === "today" && todayMode === "task"}
      onTabChange={handleTabChange}
    >
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
          completedWorkout={completedWorkout}
          onModeChange={setTodayMode}
          onSubmitStatus={handleStatusSubmit}
          onFinishWorkout={handleFinishTodayWorkout}
          onPlanChange={setTodayPlan}
          onOpenSettings={() => openMeRoute("deepseek")}
          onOpenRecords={() => handleTabChange("records")}
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
          onPasswordChanged={() => {
            setAuthNotice("密码已修改，请使用新密码重新登录。");
            setAuthUser(null);
          }}
        />
      )}
    </Layout>
  );
}

function AuthScreen({
  onAuthed,
  onOpenGuide,
  initialInfo
}: {
  onAuthed: (user: AuthUser) => void;
  onOpenGuide?: () => void;
  initialInfo?: string | null;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialInfo ?? null);
  const [pendingAction, setPendingAction] = useState<"login" | "register" | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [authCapabilitiesReady, setAuthCapabilitiesReady] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captcha, setCaptcha] = useState<{ id: string; imageDataUrl: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  async function refreshCaptcha() {
    setCaptchaLoading(true);
    setCaptchaError(null);
    setCaptchaAnswer("");
    try {
      const response = await getAuthCaptcha();
      setCaptcha({ id: response.captcha.id, imageDataUrl: response.captcha.imageDataUrl });
    } catch {
      setCaptcha(null);
      setCaptchaError("验证码暂时无法加载，请点击刷新重试。");
    } finally {
      setCaptchaLoading(false);
    }
  }

  async function refreshRegistrationCapability() {
    try {
      const capabilities = await getAuthCapabilities();
      setAuthCapabilitiesReady(true);
      setRegistrationEnabled(capabilities.registrationEnabled);
      setCaptchaEnabled(capabilities.captchaEnabled);
      if (capabilities.captchaEnabled) {
        await refreshCaptcha();
      } else {
        setCaptcha(null);
        setCaptchaAnswer("");
      }
      if (!capabilities.registrationEnabled) setMode("login");
    } catch {
      setAuthCapabilitiesReady(false);
      setRegistrationEnabled(false);
      setCaptchaEnabled(false);
      setMode("login");
      setError("登录安全验证暂时无法加载，请刷新页面后再试。");
    }
  }

  useEffect(() => {
    void refreshRegistrationCapability();
  }, []);

  async function runAuth() {
    setError(null);
    setInfo(null);
    if (captchaEnabled && (!captcha || !/^\d{4}$/.test(captchaAnswer))) {
      setError("请输入图中的四位数字验证码。");
      return;
    }
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
          ? await login(
              username,
              password,
              captcha ? { captchaId: captcha.id, captchaAnswer } : undefined
            )
          : await register({
              username,
              password,
              adultConfirmed,
              termsAccepted,
              ...(captcha ? { captchaId: captcha.id, captchaAnswer } : {})
            });
      onAuthed(response.user);
    } catch (error) {
      setError(
        mode === "login"
          ? describeLoginError(error)
          : describeRegistrationError(error)
      );
      if (captchaEnabled) await refreshCaptcha();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="center-screen auth-page">
      <div className="auth-shell auth-shell-responsive">
        <div className="auth-intro-card">
          <div className="auth-intro-brand">
            <span className="app-mark ink-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34">
                <circle cx="12.5" cy="5" r="2.7" fill="#c8402f" stroke="none" />
                <path d="M12.5 9.6c-3.6 2.2-3.8 6.6-.9 9.4 1.2 1.2 2.4 1.8 3.6 2.1" stroke="#1f1e24" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <h1 className="auth-brand-title">姿序</h1>
              <p className="auth-brand-subtitle">脊柱侧弯保守辅助训练</p>
            </div>
          </div>
          <p className="auth-intro-lead">
            不盲目上量，不承诺矫正。先按体能、目标与器械建立安全运动库，每天按身体状态动态决定训练量。
          </p>

          <div className="auth-value-props">
            <div className="auth-prop-item">
              <span className="auth-prop-dot" />
              <div>
                <strong>不盲目练</strong>
                <p>先做三步安全筛查，排除不适合动作，设定活动边界。</p>
              </div>
            </div>
            <div className="auth-prop-item">
              <span className="auth-prop-dot" />
              <div>
                <strong>动态匹配</strong>
                <p>每天根据腰酸、精神与可用时间匹配低门槛动作，杜绝硬撑。</p>
              </div>
            </div>
            <div className="auth-prop-item">
              <span className="auth-prop-dot" />
              <div>
                <strong>保守降阶</strong>
                <p>红旗症状严格停训，练后不适主动降阶，把安全放在第一位。</p>
              </div>
            </div>
          </div>

          {onOpenGuide && (
            <button
              type="button"
              className="text-button auth-guide-link"
              onClick={onOpenGuide}
            >
              了解脊柱侧弯与运动安全指南 →
            </button>
          )}
        </div>

        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            void runAuth();
          }}
        >
        <p className="eyebrow">个人化运动与状态匹配</p>
        <h2>{mode === "login" ? "账号登录" : "新用户建档"}</h2>
        <p className="muted">先按你的体能、目标与器械建立运动库，再按当天精力、疼痛和可用时间生成任务。</p>

        {registrationEnabled && (
          <div className="auth-mode-switch" aria-label="登录或注册">
            <button
              className={mode === "login" ? "selected" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setPasswordVisible(false);
                setPasswordConfirmationVisible(false);
                setError(null);
                setInfo(null);
                if (captchaEnabled) void refreshCaptcha();
              }}
            >
              登录
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setPasswordVisible(false);
                setPasswordConfirmationVisible(false);
                setError(null);
                setInfo(null);
                if (captchaEnabled) void refreshCaptcha();
              }}
            >
              注册
            </button>
          </div>
        )}

        <label>
          账号或邮箱
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={254}
            pattern={ACCOUNT_IDENTIFIER_INPUT_PATTERN}
            placeholder="账号或 QQ、Gmail 等邮箱"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <span className="muted small">邮箱仅作为姿序登录名；请使用你为姿序单独设置的密码。</span>
        </label>

        <label>
          密码
          <div className="password-input-wrap">
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              maxLength={128}
              placeholder={mode === "register" ? "至少 6 位" : "输入密码"}
              required
            />
            <button
              type="button"
              className="password-visibility-button"
              aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <PasswordVisibilityIcon visible={passwordVisible} />
            </button>
          </div>
          {mode === "register" && (
            <span className="muted small">至少 6 位；建议使用 10 位以上且不要与其他网站重复。</span>
          )}
        </label>

        {mode === "register" && (
          <>
            <label>
              再输入一次密码
              <div className="password-input-wrap">
                <input
                  autoComplete="new-password"
                  type={passwordConfirmationVisible ? "text" : "password"}
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  minLength={6}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-visibility-button"
                  aria-label={passwordConfirmationVisible ? "隐藏确认密码" : "显示确认密码"}
                  aria-pressed={passwordConfirmationVisible}
                  onClick={() => setPasswordConfirmationVisible((visible) => !visible)}
                >
                  <PasswordVisibilityIcon visible={passwordConfirmationVisible} />
                </button>
              </div>
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
              <p>账号或邮箱和密码用于登录；年龄段、体能、运动目标、当日状态等用于训练匹配。邮箱目前只作为登录账号，不发送验证邮件。身高体重可选，姿势照片不是必填项。姿序不做医疗诊断或治疗；动作视频会打开哔哩哔哩第三方页面。</p>
            </details>
          </>
        )}

        {captchaEnabled && (
          <div className="captcha-field">
            <span className="captcha-label">验证码</span>
            <div className="captcha-image-row">
              {captcha ? (
                <img className="captcha-image" src={captcha.imageDataUrl} alt="四位数字验证码" />
              ) : (
                <div className="captcha-image captcha-placeholder">
                  {captchaLoading ? "正在加载" : "加载失败"}
                </div>
              )}
              <button
                type="button"
                className="secondary-button captcha-refresh-button"
                disabled={captchaLoading}
                onClick={() => void refreshCaptcha()}
              >
                换一张
              </button>
            </div>
            <input
              aria-label="输入四位数字验证码"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={captchaAnswer}
              onChange={(event) => setCaptchaAnswer(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="输入图中 4 位数字"
              required
            />
            {captchaError && <span className="error-text small" role="alert">{captchaError}</span>}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}

        <div className="button-row">
          <button
            type="submit"
            disabled={!authCapabilitiesReady || pendingAction !== null || (captchaEnabled && (!captcha || captchaAnswer.length !== 4))}
          >
            {pendingAction === mode ? (mode === "login" ? "登录中" : "注册中") : (mode === "login" ? "登录" : "注册并开始建档")}
          </button>
        </div>
        </form>
        <InstallOptions />
        <SiteFooter />
      </div>
    </div>
  );
}

function PublicGuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="center-screen public-guide-screen">
      <div className="auth-shell">
        <header className="public-guide-header card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginBottom: "16px" }}>
          <button type="button" className="secondary-button" onClick={onBack}>
            ‹ 返回
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 800, fontSize: "16px", color: "#17201d" }}>姿序</span>
            <span className="date-pill">公开科普</span>
          </div>
        </header>
        <ScoliosisRiskGuide openByDefault />
        <InstallOptions />
        <SiteFooter />
      </div>
    </div>
  );
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {visible && <path d="M4 4l16 16" />}
    </svg>
  );
}

async function handleLogout(setAuthUser: (user: AuthUser | null) => void) {
  await logout().catch(() => undefined);
  setAuthUser(null);
}

async function handleAdminLogout(setAuthUser: (user: AuthUser | null) => void) {
  await logout().catch(() => undefined);
  setAuthUser(null);
  window.location.assign("/");
}

function AdminAccessDenied() {
  return (
    <div className="center-screen">
      <div className="status-card">
        <p className="eyebrow">404</p>
        <h1>页面不存在</h1>
        <p className="muted">请返回姿序继续使用。</p>
        <a className="secondary-button update-install-link" href="/">返回姿序</a>
      </div>
    </div>
  );
}
