import { useEffect, useState } from "react";
import type { TrainingProfile } from "../../core/types";
import {
  clearDeepSeekApiKey,
  deleteAccount,
  describeApiError,
  downloadBackup,
  getProfile,
  getSettings,
  saveDeepSeekApiKey,
  testDeepSeekConnection,
  updateSettings,
  type SettingsRecord
} from "../api";

export type MeRoute =
  | "home"
  | "profile"
  | "settings"
  | "deepseek"
  | "notifications"
  | "privacy"
  | "rules";

export const settingsMenuEntries = [
  { id: "deepseek", label: "DeepSeek AI" },
  { id: "notifications", label: "训练提醒" },
  { id: "privacy", label: "账号与隐私" },
  { id: "rules", label: "规则与说明" }
] as const;

interface MeViewProps {
  route: MeRoute;
  username: string;
  onRouteChange: (route: MeRoute) => void;
  onOpenRecords: () => void;
  onOpenPosture: () => void;
  onLogout: () => void;
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
  onOpenRecords,
  onOpenPosture,
  onLogout
}: MeViewProps) {
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsRecord>(initialSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-v4-flash");
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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
  }, [route]);

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
      setInfo("DeepSeek API Key 已保存到当前姿序服务器。");
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
      setError(`请输入密码，并完整输入账号名 ${username}。`);
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

  const commonMessages = (
    <>
      {error && <p className="error-text" role="alert">{error}</p>}
      {info && <p className="success-text" role="status">{info}</p>}
    </>
  );

  if (route === "home") {
    return (
      <section className="stack me-view">
        <PageHeading eyebrow="我的" title="个人训练空间" description="训练档案、历史记录和应用设置都从这里进入。" />
        {commonMessages}
        <TrainingProfileCard
          profile={profile}
          loading={profileLoading}
          onOpen={() => onRouteChange("profile")}
        />
        <div className="me-shortcut-grid" aria-label="训练数据快捷入口">
          <ShortcutButton icon="记" label="训练记录" description="查看状态与完成情况" onClick={onOpenRecords} />
          <ShortcutButton icon="态" label="体态记录" description="查看照片与变化" onClick={onOpenPosture} />
        </div>
        <div className="me-entry-list card">
          <EntryButton
            icon="设"
            label="设置"
            description="DeepSeek、提醒、隐私与规则"
            onClick={() => onRouteChange("settings")}
          />
        </div>
      </section>
    );
  }

  if (route === "profile") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="训练档案" onBack={() => onRouteChange("home")} />
        {commonMessages}
        <ProfileDetails profile={profile} loading={profileLoading} />
      </section>
    );
  }

  if (route === "settings") {
    const deepseekDescription = settingsLoading
      ? "正在读取状态"
      : settings.deepseekAvailable === false
        ? "正式版当前使用本地规则"
        : settings.deepseekApiKeyConfigured
          ? "已配置，可调整模型与连接"
          : "未配置，点此开始";

    return (
      <section className="stack me-view">
        <SubpageHeader title="设置" onBack={() => onRouteChange("home")} />
        {commonMessages}
        <div className="me-entry-list card" aria-label="设置项目">
          <EntryButton icon="AI" label={settingsMenuEntries[0].label} description={deepseekDescription} onClick={() => onRouteChange("deepseek")} />
          <EntryButton
            icon="醒"
            label={settingsMenuEntries[1].label}
            description={settings.notificationsEnabled ? "已开启" : "未开启"}
            onClick={() => onRouteChange("notifications")}
          />
          <EntryButton icon="隐" label={settingsMenuEntries[2].label} description="备份、退出与账号注销" onClick={() => onRouteChange("privacy")} />
          <EntryButton icon="则" label={settingsMenuEntries[3].label} description="本地规则、AI 与数据边界" onClick={() => onRouteChange("rules")} />
        </div>
      </section>
    );
  }

  if (route === "deepseek") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="DeepSeek AI" onBack={() => onRouteChange("settings")} />
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
        <SubpageHeader title="训练提醒" onBack={() => onRouteChange("settings")} />
        {commonMessages}
        <section className="card setting-panel">
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

  if (route === "privacy") {
    return (
      <section className="stack me-view">
        <SubpageHeader title="账号与隐私" onBack={() => onRouteChange("settings")} />
        {commonMessages}
        <section className="card setting-panel privacy-summary-card">
          <p className="eyebrow">数据边界</p>
          <h3 className="section-title">你的记录只归当前账号</h3>
          <p className="muted small">训练记录和体态照片按账号隔离；导出只包含当前账号的数据，不包含任何 DeepSeek API Key。</p>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void exportBackup()}>
            导出账号备份
          </button>
        </section>

        <button type="button" className="secondary-button logout-button" onClick={onLogout}>
          退出登录
        </button>

        <details className="card setting-panel account-danger-zone">
          <summary>注销账号与删除数据</summary>
          <div className="stack compact-stack">
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
              输入账号名 {username} 确认
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="secondary-button danger-button"
              disabled={deletingAccount || saving || deleteConfirmation !== username || !deletePassword}
              onClick={() => void removeAccount()}
            >
              {deletingAccount ? "正在注销…" : "永久注销当前账号"}
            </button>
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="stack me-view">
      <SubpageHeader title="规则与说明" onBack={() => onRouteChange("settings")} />
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

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="me-page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function SubpageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="me-subpage-header">
      <button type="button" className="me-back-button" onClick={onBack} aria-label={`返回，当前页面：${title}`}>
        <span aria-hidden="true">‹</span>
        返回
      </button>
      <h2>{title}</h2>
    </header>
  );
}

function TrainingProfileCard({
  profile,
  loading,
  onOpen
}: {
  profile: TrainingProfile | null;
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <section className="card me-profile-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">训练档案</p>
          <h3 className="section-title">你的训练基线</h3>
        </div>
        <button type="button" className="text-button" onClick={onOpen}>查看档案</button>
      </div>
      <div className="me-metric-grid">
        <div className="me-metric">
          <span>体能</span>
          <strong>{loading ? "…" : profile ? fitnessLabels[profile.fitnessLevel] : "未填写"}</strong>
        </div>
        <div className="me-metric">
          <span>每周</span>
          <strong>{loading ? "…" : profile ? `${profile.weeklyTrainingDays} 天` : "--"}</strong>
        </div>
        <div className="me-metric">
          <span>单次</span>
          <strong>{loading ? "…" : profile ? `${profile.defaultSessionMinutes} 分钟` : "--"}</strong>
        </div>
      </div>
      {profile && (
        <div className="me-goal-tags" aria-label="训练目标">
          {profile.goals.map((goal) => <span key={goal}>{goalLabels[goal]}</span>)}
        </div>
      )}
    </section>
  );
}

function ProfileDetails({ profile, loading }: { profile: TrainingProfile | null; loading: boolean }) {
  if (loading) {
    return <section className="card setting-panel"><p className="muted">正在读取训练档案…</p></section>;
  }

  if (!profile) {
    return <section className="card setting-panel"><p className="muted">暂未找到训练档案。</p></section>;
  }

  return (
    <section className="card setting-panel profile-detail-card">
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
    return <section className="card setting-panel"><p className="muted">正在读取 DeepSeek 配置状态…</p></section>;
  }

  if (settings.deepseekAvailable === false) {
    return (
      <section className="card setting-panel deepseek-unavailable-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">当前状态</p>
            <h3 className="section-title">正式版暂未开放个人 API Key</h3>
          </div>
          <span className="date-pill">本地规则</span>
        </div>
        <p className="muted">现在的公开服务器为多人账号服务。在接入独立的密钥保险库前，姿序不会接收或明文保存每位用户的 DeepSeek Key，所以当前不显示无法安全保存的配置框。</p>
        <div className="deepseek-boundary-note">
          <strong>入口为什么仍然保留？</strong>
          <p>你可以随时在这里确认真实状态。安全存储能力接入后，本页会直接出现完整配置表单，不需要再找入口。</p>
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
    <section className="ai-settings-panel liquid-glass deepseek-settings-page">
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
        <p>不做医疗诊断；体态照片永不发送给 DeepSeek；手机端不会回显已保存 Key 的任何字符。</p>
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

function ShortcutButton({
  icon,
  label,
  description,
  onClick
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="me-shortcut-card card" onClick={onClick}>
      <span className="me-shortcut-icon" aria-hidden="true">{icon}</span>
      <strong>{label}</strong>
      <small>{description}</small>
    </button>
  );
}

function EntryButton({
  icon,
  label,
  description,
  onClick
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="me-entry-button" onClick={onClick}>
      <span className="me-entry-icon" aria-hidden="true">{icon}</span>
      <span className="me-entry-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="me-entry-chevron" aria-hidden="true">›</span>
    </button>
  );
}

function RuleCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="card rule-card">
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
