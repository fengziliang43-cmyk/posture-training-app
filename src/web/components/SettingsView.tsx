import { useEffect, useState } from "react";
import {
  clearDeepSeekApiKey,
  deleteAccount,
  describeApiError,
  describeServerConnectionResult,
  downloadBackup,
  getApiBaseUrl,
  getSettings,
  isNativeClient,
  saveDeepSeekApiKey,
  setApiBaseUrl,
  testDeepSeekConnection,
  testServerConnection,
  updateSettings,
  type SettingsRecord
} from "../api";

interface SettingsViewProps {
  username: string;
  onLogout: () => void;
}

export function SettingsView({ username, onLogout }: SettingsViewProps) {
  const nativeClient = isNativeClient();
  const [settings, setSettings] = useState<SettingsRecord>({
    notificationsEnabled: false,
    deepseekEnabled: false,
    deepseekApiKeyConfigured: false,
    deepseekModel: "deepseek-v4-flash"
  });
  const [serverUrl, setServerUrlState] = useState(getApiBaseUrl());
  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-v4-flash");
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((response) => {
        setSettings(response.settings);
        setDeepseekModel(response.settings.deepseekModel ?? "deepseek-v4-flash");
    })
      .catch(() => setError("设置加载失败。"));
    setServerUrlState(getApiBaseUrl());
  }, []);

  async function toggleNotifications(checked: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await updateSettings({ notificationsEnabled: checked });
      setSettings(response.settings);
    } catch {
      setError("通知设置保存失败。");
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
    } catch {
      setError("DeepSeek 设置保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function saveServerUrl() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const normalized = setApiBaseUrl(serverUrl);
      setServerUrlState(normalized);
      const result = await testServerConnection(normalized);
      const message = describeServerConnectionResult(result);
      if (result.ok) {
        setInfo(`地址已保存，连接正常。${message}`);
      } else {
        setError(`地址已保存，但连接失败。${message}`);
      }
    } catch (error) {
      setError(`服务器连接测试异常：${describeApiError(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveDeepSeekKey() {
    if (!deepseekApiKeyInput.trim()) {
      setError("请先粘贴 DeepSeek API key。");
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await saveDeepSeekApiKey(deepseekApiKeyInput, deepseekModel);
      setSettings(response.settings);
      setDeepseekApiKeyInput("");
      setInfo("DeepSeek API key 已保存到 Mac 本地。");
    } catch (error) {
      setError(`DeepSeek API key 保存失败：${describeApiError(error)}`);
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
      setInfo("DeepSeek API key 已清除。");
    } catch (error) {
      setError(`DeepSeek API key 清除失败：${describeApiError(error)}`);
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
    } catch (error) {
      setError(`DeepSeek 暂不可用，本地规则仍正常。${describeApiError(error)}`);
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
      setInfo("本地备份已生成。");
    } catch (error) {
      setError(`备份导出失败：${describeApiError(error)}`);
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

  const displayName = username;
  const connectionLabel = serverUrl || window.location.origin;
  const aiStatus = settings.deepseekEnabled
    ? settings.deepseekApiKeyConfigured
      ? "已开启"
      : "未配置"
    : "本地规则";
  const deepseekAvailable = settings.deepseekAvailable !== false;
  const modelOptions = Array.from(new Set(["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner", deepseekModel]));

  return (
    <section className="stack settings-view">
      <div className="hero-card settings-hero-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">设置</p>
            <h2>账号与隐私</h2>
          </div>
          <span className="date-pill">本人数据</span>
        </div>
        <p>训练记录和照片按账号隔离，个人导出只包含你自己的数据。训练计划始终由本地确定性规则生成。</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {info && <p className="success-text">{info}</p>}

      <div className="settings-status-grid">
        <article className="settings-status-card">
          <span>账号</span>
          <strong>{displayName}</strong>
          <p>本地账号</p>
        </article>
        <article className="settings-status-card">
          <span>连接</span>
          <strong>{nativeClient ? (serverUrl ? "服务器" : "未配置") : "网站"}</strong>
          <p>{shortConnectionLabel(connectionLabel)}</p>
        </article>
        <article className="settings-status-card">
          <span>AI</span>
          <strong>{deepseekAvailable ? aiStatus : "本地规则"}</strong>
          <p>{deepseekAvailable ? (settings.deepseekApiKeyConfigured ? "Key 已配置" : "Key 未配置") : "公开版不收集 Key"}</p>
        </article>
      </div>

      {nativeClient && <section className="card setting-panel">
        <div className="mini-head">
          <div>
            <p className="eyebrow">连接</p>
            <h3 className="section-title">训练服务器</h3>
          </div>
          <span className="date-pill">{serverUrl ? "已配置" : "当前设备"}</span>
        </div>
        <p className="muted">手机 App 默认连接姿序正式服务器；本地联调时可改为其他可访问地址，iOS 与公开版使用 HTTPS。</p>
        <label className="setting-input">
          服务器地址
          <input
            value={serverUrl}
            onChange={(event) => setServerUrlState(event.target.value)}
            placeholder="https://你的服务器域名"
          />
        </label>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveServerUrl()}>
          保存并测试连接
        </button>
      </section>}

      <section className="card setting-panel">
        <div className="setting-toggle-row">
          <div>
            <p className="eyebrow">提醒</p>
            <h3 className="section-title">训练节奏</h3>
            <p className="muted small">填写状态、每周体态照片、未完成训练任务。</p>
          </div>
          <label className="switch-field" aria-label="开启提醒">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              disabled={saving}
              onChange={(event) => void toggleNotifications(event.target.checked)}
            />
            <span />
          </label>
        </div>
      </section>

      {deepseekAvailable && <section className="ai-settings-panel liquid-glass">
        <div className="mini-head">
          <div>
            <p className="eyebrow">DeepSeek</p>
            <h3 className="section-title">AI 教练解读</h3>
          </div>
          <span className="date-pill">{aiStatus}</span>
        </div>
        <div className="setting-toggle-row compact">
          <div>
            <strong>启用 DeepSeek</strong>
            <p className="muted small">只解释本地规则已经生成的训练与恢复建议，不改变计划。</p>
          </div>
          <label className="switch-field" aria-label="开启 DeepSeek 解释和复盘">
            <input
              type="checkbox"
              checked={settings.deepseekEnabled}
              disabled={saving}
              onChange={(event) => void toggleDeepSeek(event.target.checked)}
            />
            <span />
          </label>
        </div>

        <div className="ai-privacy-note">
          <strong>边界很明确</strong>
          <p>不做医疗诊断；体态照片永不发送给 DeepSeek；API Key 只写入 Mac，手机端不回显任何字符。</p>
        </div>

        <details className="settings-details">
          <summary>配置密钥与模型</summary>
          <div className="key-status-row">
            <span>API Key 状态</span>
            <strong>{settings.deepseekApiKeyConfigured ? "已配置" : "未配置"}</strong>
          </div>
          <label className="setting-input">
            模型
            <select
              value={deepseekModel}
              onChange={(event) => setDeepseekModel(event.target.value)}
            >
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveDeepSeekModel()}>
            保存模型
          </button>
          <label className="setting-input">
            新的 DeepSeek API Key
            <input
              type="password"
              value={deepseekApiKeyInput}
              onChange={(event) => setDeepseekApiKeyInput(event.target.value)}
              placeholder={settings.deepseekApiKeyConfigured ? "已配置；仅在更换时输入" : "粘贴 API Key"}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveDeepSeekKey()}>
              保存 Key
            </button>
            <button type="button" className="secondary-button" disabled={saving || !settings.deepseekApiKeyConfigured} onClick={() => void runDeepSeekTest()}>
              测试连接
            </button>
            <button type="button" className="secondary-button danger-button" disabled={saving || !settings.deepseekApiKeyConfigured} onClick={() => void clearDeepSeekKey()}>
              清除 Key
            </button>
          </div>
        </details>
        {settings.deepseekLastTestAt && (
          <p className="muted small">
            最近测试：{settings.deepseekLastTestOk ? "成功" : "失败"} · {settings.deepseekLastTestAt.slice(0, 16)}
          </p>
        )}
      </section>}

      <section className="card setting-panel">
        <div className="mini-head">
          <div>
            <p className="eyebrow">备份</p>
            <h3 className="section-title">本地导出</h3>
          </div>
          <span className="date-pill">不含 Key</span>
        </div>
        <p className="muted small">导出仅属于当前账号的训练记录和体态照片；DeepSeek API Key 永不进入导出。</p>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void exportBackup()}>
          导出本地备份
        </button>
      </section>

      <details className="card setting-panel account-danger-zone">
        <summary>注销账号与删除数据</summary>
        <div className="stack compact-stack">
          <p className="muted small">
            注销后，当前账号的档案、状态记录、训练记录、设置和体态照片会被永久删除。建议先导出备份。
          </p>
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

      <button type="button" className="secondary-button logout-button" onClick={onLogout}>
        退出登录
      </button>
    </section>
  );
}

function shortConnectionLabel(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
