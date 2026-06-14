import { useEffect, useState } from "react";
import {
  clearDeepSeekApiKey,
  describeApiError,
  describeServerConnectionResult,
  downloadBackup,
  getApiBaseUrl,
  getMe,
  getSettings,
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
    getMe().catch(() => undefined);
  }, []);

  async function toggleNotifications(checked: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await updateSettings({ ...settings, notificationsEnabled: checked });
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
      const response = await updateSettings({ ...settings, deepseekEnabled: checked, deepseekModel });
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
      setError(`Mac server 测试异常：${describeApiError(error)}`);
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
      link.download = `锻体修容备份-${new Date().toISOString().slice(0, 10)}.zip`;
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

  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">设置</p>
        <h2>本地与隐私</h2>
        <p>DeepSeek 第一版默认关闭，照片只保存在手机和 Mac 上。</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {info && <p className="success-text">{info}</p>}

      <section className="card">
        <h3 className="section-title">账号</h3>
        <div className="setting-row">
          <span>当前用户</span>
          <strong>{username}</strong>
        </div>
        <div className="setting-row">
          <span>当前连接</span>
          <strong>{serverUrl || window.location.origin}</strong>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Tailscale</h3>
        <p className="muted">Mac 和 OPPO 登录同一 Tailscale 账号后，通过私有地址访问本地服务。</p>
        <label className="setting-input">
          Mac server 地址
          <input
            value={serverUrl}
            onChange={(event) => setServerUrlState(event.target.value)}
            placeholder="http://100.x.x.x:8787"
          />
        </label>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveServerUrl()}>
          保存并测试连接
        </button>
      </section>

      <section className="card">
        <h3 className="section-title">通知</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            disabled={saving}
            onChange={(event) => void toggleNotifications(event.target.checked)}
          />
          开启提醒
        </label>
        <p className="muted small">提醒填写状态、每周体态照片、以及未完成训练任务。</p>
      </section>

      <section className="card">
        <h3 className="section-title">AI 路线</h3>
        <div className="setting-row">
          <span>DeepSeek</span>
          <strong>
            {settings.deepseekEnabled ? "已开启" : "已关闭"} ·{" "}
            {settings.deepseekApiKeyConfigured ? "已配置" : "未配置"}
          </strong>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.deepseekEnabled}
            disabled={saving}
            onChange={(event) => void toggleDeepSeek(event.target.checked)}
          />
          开启 DeepSeek 解释和复盘
        </label>
        <label className="setting-input">
          模型
          <input
            value={deepseekModel}
            onChange={(event) => setDeepseekModel(event.target.value)}
            placeholder="deepseek-v4-flash"
          />
        </label>
        <label className="setting-input">
          DeepSeek API key
          <input
            type="password"
            value={deepseekApiKeyInput}
            onChange={(event) => setDeepseekApiKeyInput(event.target.value)}
            placeholder={settings.deepseekApiKeyConfigured ? "已配置，留空不变" : "粘贴新的 API key"}
            autoComplete="off"
          />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveDeepSeekKey()}>
            保存 key
          </button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void runDeepSeekTest()}>
            测试连接
          </button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => void clearDeepSeekKey()}>
            清除 key
          </button>
        </div>
        {settings.deepseekLastTestAt && (
          <p className="muted small">
            最近测试：{settings.deepseekLastTestOk ? "成功" : "失败"} · {settings.deepseekLastTestAt.slice(0, 16)}
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">本地备份</h3>
        <p className="muted small">导出训练记录和体态照片；DeepSeek API key 默认不进入备份。</p>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void exportBackup()}>
          导出本地备份
        </button>
      </section>

      <button type="button" className="secondary-button" onClick={onLogout}>
        退出登录
      </button>
    </section>
  );
}
