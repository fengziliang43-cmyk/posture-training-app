import { useEffect, useState } from "react";
import { getEquipmentCompatibleExercises } from "../../core/exercise-library";
import type { TrainingProfile } from "../../core/types";
import { getCurrentAppVersion } from "../../release";
import {
  changePassword,
  clearDeepSeekApiKey,
  deleteAccount,
  describeApiError,
  describePasswordChangeError,
  downloadBackup,
  getProfile,
  getSettings,
  saveDeepSeekApiKey,
  testDeepSeekConnection,
  updateSettings,
  type SettingsRecord
} from "../api";
import {
  checkForAppUpdate,
  getAppPlatform,
  refreshWebApp,
  type AppUpdateResult
} from "../app-update";
import { OnboardingView } from "./OnboardingView";
import { Icon, type IconName } from "./ui";

export type MeRoute =
  | "home"
  | "profile"
  | "settings"
  | "deepseek"
  | "notifications"
  | "updates"
  | "privacy"
  | "rules";

export const settingsMenuEntries = [
  { id: "deepseek", label: "DeepSeek AI" },
  { id: "updates", label: "检查更新" },
  { id: "privacy", label: "账号与隐私" },
  { id: "rules", label: "规则与说明" }
] as const;

interface MeViewProps {
  route: MeRoute;
  username: string;
  onRouteChange: (route: MeRoute) => void;
  onLogout: () => void;
  onPasswordChanged: () => void;
}

const initialSettings: SettingsRecord = {
  notificationsEnabled: false,
  deepseekAvailable: false,
  deepseekEnabled: false,
  deepseekApiKeyConfigured: false,
  deepseekModel: "deepseek-v4-flash"
};

export function MeView({
  route,
  username,
  onRouteChange,
  onLogout,
  onPasswordChanged
}: MeViewProps) {
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileEditing, setProfileEditing] = useState(false);
  const [settings, setSettings] = useState<SettingsRecord>(initialSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-v4-flash");
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((response) => setProfile(response.profile))
      .catch(() => setError("训练档案加载失败。"))
      .finally(() => setProfileLoading(false));

    getSettings()
      .then((response) => {
        setSettings(response.settings);
        setDeepseekModel(response.settings.deepseekModel ?? "deepseek-v4-flash");
      })
      .catch(() => setError("设置加载失败。"))
      .finally(() => setSettingsLoading(false));

  }, []);

  useEffect(() => {
    setError(null);
    setInfo(null);
    if (route !== "profile") setProfileEditing(false);
  }, [route]);

  useEffect(() => {
    if (route === "profile") window.scrollTo({ top: 0, behavior: "auto" });
  }, [route, profileEditing]);

  async function toggleNotifications(checked: boolean) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await updateSettings({ notificationsEnabled: checked });
      setSettings(response.settings);
      setInfo(checked ? "训练提醒已开启。" : "训练提醒已关闭。");
    } catch (requestError) {
      setError(`提醒设置保存失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeepSeek(checked: boolean) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await updateSettings({ deepseekEnabled: checked, deepseekModel });
      setSettings(response.settings);
      setInfo(checked ? "DeepSeek 已开启。" : "DeepSeek 已关闭，本地规则仍正常。");
    } catch (requestError) {
      setError(`DeepSeek 设置保存失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveDeepSeekKey() {
    if (!deepseekApiKeyInput.trim()) {
      setError("请先粘贴 DeepSeek API Key。");
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await saveDeepSeekApiKey(deepseekApiKeyInput, deepseekModel);
      setSettings(response.settings);
      setDeepseekApiKeyInput("");
      setInfo("DeepSeek API Key 已按当前账号加密保存到姿序服务器。");
    } catch (requestError) {
      setError(`DeepSeek API Key 保存失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveDeepSeekModel() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await updateSettings({ deepseekModel });
      setSettings(response.settings);
      setInfo("DeepSeek 模型已保存。");
    } catch (requestError) {
      setError(`模型保存失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function clearDeepSeekKey() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await clearDeepSeekApiKey();
      setSettings(response.settings);
      setDeepseekApiKeyInput("");
      setInfo("DeepSeek API Key 已清除。");
    } catch (requestError) {
      setError(`DeepSeek API Key 清除失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function runDeepSeekTest() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const result = await testDeepSeekConnection();
      if (result.ok) {
        const response = await getSettings();
        setSettings(response.settings);
        setInfo("DeepSeek 连接正常。");
      } else {
        setError(`DeepSeek 暂不可用，本地规则仍正常。${result.error ? `原因：${result.error}` : ""}`);
      }
    } catch (requestError) {
      setError(`DeepSeek 暂不可用，本地规则仍正常。${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const blob = await downloadBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `姿序备份-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setInfo("账号备份已生成。");
    } catch (requestError) {
      setError(`备份导出失败：${describeApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount() {
    if (!deletePassword || deleteConfirmation !== username) {
      setError(`请输入密码，并完整输入账号或邮箱 ${username}。`);
      return;
    }

    setDeletingAccount(true);
    setError(null);
    setInfo(null);
    try {
      await deleteAccount(deletePassword, deleteConfirmation);
      onLogout();
    } catch (requestError) {
      setError(`账号注销失败：${describeApiError(requestError)}`);
      setDeletingAccount(false);
    }
  }

  async function updatePassword() {
    if (newPassword.length < 6) {
      setError("新密码至少需要 6 位。");
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (currentPassword === newPassword) {
      setError("新密码不能与当前密码相同。");
      return;
    }

    setChangingPassword(true);
    setError(null);
    setInfo(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      onPasswordChanged();
    } catch (requestError) {
      setError(describePasswordChangeError(requestError));
      setChangingPassword(false);
    }
  }

  const commonMessages = (
    <>
      {error && <p className="error-text" role="alert">{error}</p>}
      {info && <p className="success-text" role="status">{info}</p>}
    </>
  );

  if (route === "home" || route === "settings") {
    const deepseekDescription = settingsLoading
      ? "正在读取状态"
      : settings.deepseekAvailable === false
        ? "管理员暂时关闭，训练仍使用本地规则"
        : settings.deepseekApiKeyConfigured
          ? "已配置，可调整模型与连接"
          : "未配置，点此开始";

    return (
      <section className="stack me-view">
        {commonMessages}
        <TrainingProfileCard
          username={username}
          profile={profile}
          loading={profileLoading}
          onOpen={() => onRouteChange("profile")}
        />
        <nav className="card-solid me-list" aria-label="设置项目">
          <EntryButton icon="spark" label={settingsMenuEntries[0].label} description={deepseekDescription} onClick={() => onRouteChange("deepseek")} />
          <EntryButton icon="refresh" label={settingsMenuEntries[1].label} description={`当前版本 ${getCurrentAppVersion(getAppPlatform())}`} onClick={() => onRouteChange("updates")} />
          <EntryButton icon="lock" label={settingsMenuEntries[2].label} description="修改密码、备份、退出与账号注销" onClick={() => onRouteChange("privacy")} />
          <EntryButton icon="book" label={settingsMenuEntries[3].label} description="本地规则、AI 与数据边界" onClick={() => onRouteChange("rules")} />
        </nav>
        <button type="button" className="secondary-button me-logout" onClick={onLogout}>
          <Icon name="logout" size={18} />
          退出登录
        </button>
      </section>
    );
  }

  if (route === "profile") {
    return (
      <section className="stack me-view">
        <SubpageHeader
          title={profileEditing ? "修改训练档案" : "训练档案"}
          onBack={() => profileEditing ? setProfileEditing(false) : onRouteChange("home")}
        />
        {commonMessages}
        {profileEditing && profile ? (
          <OnboardingView
            username={username}
            initialProfile={profile}
            onCancel={() => setProfileEditing(false)}
            onComplete={(updatedProfile) => {
              setProfile(updatedProfile);
              setProfileEditing(false);
              setInfo("训练档案已更新；新计划和动作替换会按新的器械与条件筛选。");
            }}
          />
        ) : (
          <ProfileDetails
            profile={profile}
            loading={profileLoading}
            onEdit={() => setProfileEditing(true)}
          />
        )}
      </section>
    );
  }

  if (route === "deepseek") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="DeepSeek AI" onBack={() => onRouteChange("home")} />
        {commonMessages}
        <DeepSeekSettings
          settings={settings}
          loading={settingsLoading}
          saving={saving}
          apiKeyInput={deepseekApiKeyInput}
          model={deepseekModel}
          onApiKeyInputChange={setDeepseekApiKeyInput}
          onModelChange={setDeepseekModel}
          onToggle={toggleDeepSeek}
          onSaveKey={saveDeepSeekKey}
          onSaveModel={saveDeepSeekModel}
          onTest={runDeepSeekTest}
          onClear={clearDeepSeekKey}
        />
      </section>
    );
  }

  if (route === "notifications") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="训练提醒" onBack={() => onRouteChange("home")} />
        {commonMessages}
        <section className="card-solid setting-panel">
          <div className="setting-toggle-row">
            <div>
              <p className="eyebrow">提醒</p>
              <h3 className="section-title">保持训练节奏</h3>
              <p className="muted small">用于提醒填写状态、完成训练和记录每周体态。</p>
            </div>
            <label className="switch-field" aria-label="开启训练提醒">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                disabled={saving || settingsLoading}
                onChange={(event) => void toggleNotifications(event.target.checked)}
              />
              <span />
            </label>
          </div>
        </section>
      </section>
    );
  }

  if (route === "updates") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="检查更新" onBack={() => onRouteChange("home")} />
        <AppUpdateSettings />
      </section>
    );
  }

  if (route === "privacy") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="账号与隐私" onBack={() => onRouteChange("home")} />
        {commonMessages}
        <form
          className="card-solid setting-panel password-change-card"
          onSubmit={(event) => {
            event.preventDefault();
            void updatePassword();
          }}
        >
          <p className="eyebrow">账号安全</p>
          <h3 className="section-title">修改密码</h3>
          <p className="muted small">修改成功后，当前账号在所有设备上的登录都会失效，需要使用新密码重新登录。</p>
          <label className="setting-input">
            当前密码
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              minLength={6}
              maxLength={128}
            />
          </label>
          <label className="setting-input">
            新密码
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              placeholder="至少 6 位"
            />
            <span className="muted small">建议使用 10 位以上且不要与其他网站重复。</span>
          </label>
          <label className="setting-input">
            再输入一次新密码
            <input
              type="password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
            />
          </label>
          <button
            type="submit"
            className="secondary-button"
            disabled={changingPassword || !currentPassword || !newPassword || !newPasswordConfirmation}
          >
            {changingPassword ? "正在修改…" : "保存新密码"}
          </button>
        </form>
        <section className="card-solid setting-panel privacy-summary-card">
          <p className="eyebrow">数据边界</p>
          <h3 className="section-title">你的记录只归当前账号</h3>
          <p className="muted small">训练记录和体态照片按账号隔离保存在姿序服务器；导出只包含当前账号的数据，不包含任何 DeepSeek API Key。</p>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void exportBackup()}>
            导出账号备份
          </button>
        </section>

        <button type="button" className="secondary-button logout-button" onClick={onLogout}>
          退出登录
        </button>

        <details className="danger-fold">
          <summary>注销账号与删除数据</summary>
          <form
            className="stack compact-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void removeAccount();
            }}
          >
            <p className="muted small">注销后，当前账号的档案、训练记录、设置和体态照片会永久删除。建议先导出备份。</p>
            <label className="setting-input">
              当前密码
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="setting-input">
              输入账号或邮箱 {username} 确认
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              className="secondary-button danger-button"
              disabled={deletingAccount || saving || deleteConfirmation !== username || !deletePassword}
            >
              {deletingAccount ? "正在注销…" : "永久注销当前账号"}
            </button>
          </form>
        </details>
      </section>
    );
  }

  return (
    <section className="stack me-view">
      <SubpageHeader title="规则与说明" onBack={() => onRouteChange("home")} />
      {commonMessages}
      <div className="rule-card-list">
        <RuleCard title="训练计划由本地规则生成" description="体能、疼痛、精力和可用时间决定训练任务；AI 不修改训练结果。" />
        <RuleCard title="DeepSeek 只负责解释" description="启用后仅解释已经生成的计划与复盘，不做医疗诊断，也不替代医生。" />
        <RuleCard title="体态照片不发送给 AI" description="照片用于当前账号内的体态记录，不会作为 DeepSeek 请求内容。" />
        <RuleCard title="风险信号优先停训" description="出现放射痛、麻木、明显无力等红旗信号时，姿序停止生成可执行训练。" />
      </div>
    </section>
  );
}

function SubpageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="me-sub-head">
      <button type="button" className="text-button train-back" onClick={onBack} aria-label={`返回，当前页面：${title}`}>
        <Icon name="left" size={16} />
        返回
      </button>
      <h2>{title}</h2>
    </header>
  );
}

function TrainingProfileCard({
  username,
  profile,
  loading,
  onOpen
}: {
  username: string;
  profile: TrainingProfile | null;
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <section className="card-solid me-profile">
      <div className="me-who">
        <span className="me-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{username}</h2>
          <p className="muted-text">训练档案</p>
        </div>
        <button type="button" className="text-button" onClick={onOpen}>查看与修改</button>
      </div>
      <div className="mini-stats three">
        <div>
          <span>体能</span>
          <b>{loading ? "…" : profile ? fitnessLabels[profile.fitnessLevel] : "未填写"}</b>
        </div>
        <div>
          <span>每周</span>
          <b>{loading ? "…" : profile ? `${profile.weeklyTrainingDays} 天` : "--"}</b>
        </div>
        <div>
          <span>单次</span>
          <b>{loading ? "…" : profile ? `${profile.defaultSessionMinutes} 分钟` : "--"}</b>
        </div>
      </div>
      {profile && profile.goals.length > 0 && (
        <div className="pill-row" aria-label="训练目标">
          {profile.goals.map((goal) => <span key={goal}>{goalLabels[goal]}</span>)}
        </div>
      )}
    </section>
  );
}

function ProfileDetails({
  profile,
  loading,
  onEdit
}: {
  profile: TrainingProfile | null;
  loading: boolean;
  onEdit: () => void;
}) {
  if (loading) {
    return <section className="card-solid setting-panel"><p className="muted">正在读取训练档案…</p></section>;
  }

  if (!profile) {
    return <section className="card-solid setting-panel"><p className="muted">暂未找到训练档案。</p></section>;
  }

  const compatibleExercises = getEquipmentCompatibleExercises(profile.equipment);

  return (
    <section className="card-solid setting-panel profile-detail-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">当前档案</p>
          <h3 className="section-title">训练与动作筛选基线</h3>
        </div>
        <button type="button" className="text-button" onClick={onEdit}>修改</button>
      </div>
      <div className="profile-detail-grid">
        <ProfileValue label="年龄段" value={profile.ageRange} />
        <ProfileValue label="体能水平" value={fitnessLabels[profile.fitnessLevel]} />
        <ProfileValue label="每周训练" value={`${profile.weeklyTrainingDays} 天`} />
        <ProfileValue label="默认时长" value={`${profile.defaultSessionMinutes} 分钟`} />
        <ProfileValue label="身高" value={profile.heightCm ? `${profile.heightCm} cm` : "未填写"} />
        <ProfileValue label="体重" value={profile.weightKg ? `${profile.weightKg} kg` : "未填写"} />
      </div>
      <ProfileList label="训练目标" values={profile.goals.map((value) => goalLabels[value])} />
      <ProfileList label="可用器械" values={profile.equipment.map((value) => equipmentLabels[value] ?? value)} />
      <ProfileList label="需要保护" values={profile.limitations.map((value) => limitationLabels[value])} emptyLabel="未标记" />
      <ProfileList
        label={`器械匹配运动库 · ${compatibleExercises.length} 个动作`}
        values={compatibleExercises.map((exercise) => exercise.name)}
      />
      <p className="muted small profile-library-note">每日计划还会继续按体能、需要保护的部位和当天状态做保守筛选。修改档案不会改写已经完成或正在执行的历史任务。</p>
    </section>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return <div className="profile-value"><span>{label}</span><strong>{value}</strong></div>;
}

function ProfileList({
  label,
  values,
  emptyLabel = "未填写"
}: {
  label: string;
  values: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="profile-list-block">
      <span>{label}</span>
      <div>{values.length > 0 ? values.map((value) => <strong key={value}>{value}</strong>) : <strong>{emptyLabel}</strong>}</div>
    </div>
  );
}

function AppUpdateSettings() {
  const [result, setResult] = useState<AppUpdateResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function runCheck() {
    setChecking(true);
    setUpdateError(null);
    try {
      setResult(await checkForAppUpdate());
    } catch {
      setUpdateError("暂时无法检查更新，请确认网络正常后重试。");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void runCheck();
  }, []);

  const platform = result?.platform ?? getAppPlatform();
  const platformLabel = platform === "android" ? "Android" : platform === "ios" ? "iPhone / iPad" : "网页版";

  return (
    <section className="card-solid setting-panel app-update-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">{platformLabel}</p>
          <h3 className="section-title">姿序 {result?.currentVersion ?? getCurrentAppVersion(platform)}</h3>
        </div>
        <span className="date-pill">
          {checking ? "检查中" : result?.updateAvailable ? "有新版" : result ? "已是最新" : "未检查"}
        </span>
      </div>

      {checking && <p className="muted">正在向姿序官网检查最新版本…</p>}
      {updateError && <p className="error-text" role="alert">{updateError}</p>}

      {result && !checking && (
        <>
          <div className="update-version-grid">
            <ProfileValue label="当前版本" value={result.currentVersion} />
            <ProfileValue label="官网最新版" value={result.latest.version} />
          </div>
          <p className="muted small">发布于 {result.latest.publishedAt}</p>
          <div className="update-release-notes">
            <strong>本版更新</strong>
            <ul>
              {result.latest.releaseNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>

          {!result.updateAvailable && (
            <div className="update-status-note success-update-note">
              <strong>你已在使用最新版</strong>
              <p>以后仍可随时回到这里主动检查。</p>
            </div>
          )}

          {result.updateAvailable && platform === "android" && (
            <div className="stack compact-stack">
              {result.installAvailable && result.latest.installUrl ? (
                <a className="secondary-button update-install-link" href={result.latest.installUrl}>
                  下载最新版安装包
                </a>
              ) : (
                <button type="button" className="secondary-button" disabled>新版安装包正在准备</button>
              )}
              <p className="muted small">下载完成后，Android 会打开系统安装确认；首次安装可能需要允许当前浏览器安装未知应用。姿序不会绕过系统确认。</p>
            </div>
          )}

          {result.updateAvailable && platform === "ios" && (
            <div className="stack compact-stack">
              {result.installAvailable && result.latest.installUrl ? (
                <a className="secondary-button update-install-link" href={result.latest.installUrl}>
                  前往 TestFlight / App Store
                </a>
              ) : (
                <button type="button" className="secondary-button" disabled>iOS 新版正在准备</button>
              )}
              <p className="muted small">iOS 版本只通过 TestFlight 或 App Store 更新，不直接下载或侧载 IPA。</p>
            </div>
          )}

          {result.updateAvailable && platform === "web" && (
            <button type="button" className="secondary-button" onClick={() => void refreshWebApp()}>
              刷新到最新版
            </button>
          )}
        </>
      )}

      <button type="button" className="secondary-button" disabled={checking} onClick={() => void runCheck()}>
        {checking ? "正在检查…" : "重新检查"}
      </button>
    </section>
  );
}

function DeepSeekSettings({
  settings,
  loading,
  saving,
  apiKeyInput,
  model,
  onApiKeyInputChange,
  onModelChange,
  onToggle,
  onSaveKey,
  onSaveModel,
  onTest,
  onClear
}: {
  settings: SettingsRecord;
  loading: boolean;
  saving: boolean;
  apiKeyInput: string;
  model: string;
  onApiKeyInputChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onToggle: (checked: boolean) => Promise<void>;
  onSaveKey: () => Promise<void>;
  onSaveModel: () => Promise<void>;
  onTest: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  if (loading) {
    return <section className="card-solid setting-panel"><p className="muted">正在读取 DeepSeek 配置状态…</p></section>;
  }

  if (settings.deepseekAvailable === false) {
    return (
      <section className="card-solid setting-panel deepseek-unavailable-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">当前状态</p>
            <h3 className="section-title">个人 API Key 当前已暂停</h3>
          </div>
          <span className="date-pill">本地规则</span>
        </div>
        <p className="muted">服务器的 DeepSeek 紧急开关当前处于关闭状态，所以暂时不接收新的 Key；训练计划仍由本地规则正常生成。</p>
        <div className="deepseek-boundary-note">
          <strong>入口为什么仍然保留？</strong>
          <p>你可以随时确认真实状态。管理员重新开启后，本页会直接恢复每个账号独立的加密配置表单。</p>
        </div>
        <div className="setup-step-list" aria-label="DeepSeek 开放后的配置步骤">
          <span><b>1</b> 输入 API Key</span>
          <span><b>2</b> 选择模型并保存</span>
          <span><b>3</b> 测试连接后开启解读</span>
        </div>
        <p className="muted small">DeepSeek 未开启不影响训练：计划仍由本地确定性规则正常生成。</p>
      </section>
    );
  }

  const aiStatus = settings.deepseekEnabled
    ? settings.deepseekApiKeyConfigured
      ? "已开启"
      : "缺少 Key"
    : "已关闭";
  const modelOptions = Array.from(new Set(["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner", model]));

  return (
    <section className="card-solid ai-settings-panel deepseek-settings-page">
      <div className="mini-head">
        <div>
          <p className="eyebrow">AI 教练解读</p>
          <h3 className="section-title">配置 DeepSeek</h3>
        </div>
        <span className="date-pill">{aiStatus}</span>
      </div>

      <div className="setting-toggle-row compact">
        <div>
          <strong>启用 DeepSeek</strong>
          <p className="muted small">只解释本地规则生成的训练与恢复建议，不改变计划。</p>
        </div>
        <label className="switch-field" aria-label="开启 DeepSeek 解释和复盘">
          <input
            type="checkbox"
            checked={settings.deepseekEnabled}
            disabled={saving}
            onChange={(event) => void onToggle(event.target.checked)}
          />
          <span />
        </label>
      </div>

      <div className="ai-privacy-note">
        <strong>数据边界</strong>
        <p>Key 按当前账号加密保存在姿序服务器且永不回显；不做医疗诊断；体态照片永不发送给 DeepSeek。</p>
      </div>

      <div className="key-status-row">
        <span>API Key 状态</span>
        <strong>{settings.deepseekApiKeyConfigured ? "已配置" : "未配置"}</strong>
      </div>

      <label className="setting-input">
        模型
        <select value={model} onChange={(event) => onModelChange(event.target.value)}>
          {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <button type="button" className="secondary-button" disabled={saving} onClick={() => void onSaveModel()}>
        保存模型
      </button>

      <label className="setting-input">
        DeepSeek API Key
        <input
          type="password"
          value={apiKeyInput}
          onChange={(event) => onApiKeyInputChange(event.target.value)}
          placeholder={settings.deepseekApiKeyConfigured ? "已配置；仅在更换时输入" : "粘贴 API Key"}
          autoComplete="off"
        />
      </label>
      <div className="button-row deepseek-action-row">
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void onSaveKey()}>保存 Key</button>
        <button type="button" className="secondary-button" disabled={saving || !settings.deepseekApiKeyConfigured} onClick={() => void onTest()}>测试连接</button>
        <button type="button" className="secondary-button danger-button" disabled={saving || !settings.deepseekApiKeyConfigured} onClick={() => void onClear()}>清除 Key</button>
      </div>
      {settings.deepseekLastTestAt && (
        <p className="muted small">最近测试：{settings.deepseekLastTestOk ? "成功" : "失败"} · {settings.deepseekLastTestAt.slice(0, 16)}</p>
      )}
    </section>
  );
}

function EntryButton({
  icon,
  label,
  description,
  onClick
}: {
  icon: IconName;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="me-row" onClick={onClick}>
      <span className="me-row-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="me-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <Icon name="right" size={16} />
    </button>
  );
}

function RuleCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="card-solid rule-card">
      <span className="rule-check" aria-hidden="true">✓</span>
      <div><strong>{title}</strong><p>{description}</p></div>
    </article>
  );
}

const fitnessLabels: Record<TrainingProfile["fitnessLevel"], string> = {
  beginner: "刚开始",
  regular: "规律训练",
  experienced: "有经验"
};

const goalLabels: Record<TrainingProfile["goals"][number], string> = {
  "safe-movement": "安全活动",
  posture: "改善体态",
  "fat-loss": "减脂",
  strength: "增肌力量",
  conditioning: "提升体能"
};

const limitationLabels: Record<TrainingProfile["limitations"][number], string> = {
  "low-back": "腰背",
  shoulder: "肩颈",
  knee: "膝关节",
  balance: "平衡"
};

const equipmentLabels: Partial<Record<TrainingProfile["equipment"][number], string>> = {
  bodyweight: "徒手",
  floor: "地垫",
  "pull-up-bar": "单杠",
  "resistance-band": "弹力带",
  wall: "墙面",
  step: "台阶",
  "walking-space": "步行空间"
};
