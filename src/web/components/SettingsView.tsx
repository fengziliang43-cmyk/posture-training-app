import { useEffect, useState } from "react";
import {
  getApiBaseUrl,
  getMe,
  getSettings,
  setApiBaseUrl,
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
    deepseekEnabled: false
  });
  const [serverUrl, setServerUrlState] = useState(getApiBaseUrl());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((response) => setSettings(response.settings))
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

  async function saveServerUrl() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const normalized = setApiBaseUrl(serverUrl);
      setServerUrlState(normalized);
      const ok = await testServerConnection(normalized);
      setInfo(ok ? "Mac server 地址已保存，连接正常。" : "地址已保存，但 server 未响应。");
    } catch {
      setError("Mac server 连接失败，请检查地址、Tailscale 和后端服务。");
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
          <strong>{settings.deepseekEnabled ? "已开启" : "第一版关闭"}</strong>
        </div>
      </section>

      <button type="button" className="secondary-button" onClick={onLogout}>
        退出登录
      </button>
    </section>
  );
}
