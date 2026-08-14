import { useEffect, useState } from "react";
import {
  describeApiError,
  generateDailyExplanation,
  getSettings,
  type AiTextResponse,
  type PlanResponsePlan,
  type SettingsRecord
} from "../api";

interface AiCoachCardProps {
  plan: PlanResponsePlan | null;
  onOpenSettings: () => void;
}

export function AiCoachCard({ plan, onOpenSettings }: AiCoachCardProps) {
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [result, setResult] = useState<AiTextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((response) => setSettings(response.settings))
      .catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [plan?.id]);

  const configured = settings?.deepseekApiKeyConfigured === true;
  const enabled = settings?.deepseekEnabled === true;
  const available = settings !== null && settings.deepseekAvailable !== false;
  const ready = available && configured && enabled;
  const source = result?.source === "deepseek" ? "DeepSeek" : "本地规则";
  const state = loading
    ? "loading"
    : error
      ? "error"
      : result?.source === "deepseek"
        ? "success"
        : result?.source === "local"
          ? "fallback"
          : ready
            ? "ready"
            : "setup";

  async function generate() {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await generateDailyExplanation(plan.id));
    } catch (requestError) {
      setError(describeApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`ai-coach-card liquid-glass ai-state-${state}`} aria-live="polite">
      <div className="ai-card-glow" aria-hidden="true" />
      <div className="ai-card-head">
        <div className="ai-orb" aria-hidden="true">
          <span>AI</span>
        </div>
        <div>
          <p className="eyebrow">AI 教练解读</p>
          <h3>{aiTitle(state, available, configured, enabled)}</h3>
        </div>
        <span className={`source-badge source-${result?.source ?? "local"}`}>{source}</span>
      </div>

      {loading ? (
        <div className="ai-skeleton" aria-label="DeepSeek 正在生成解读">
          <span />
          <span />
          <span />
          <p>DeepSeek 正在解释今天的本地训练计划…</p>
        </div>
      ) : (
        <p className="ai-copy">
          {error
            ? `连接失败：${error}`
            : result?.explanation ??
              plan?.explanation?.summary ??
              plan?.reason ??
              "先完成今日状态填写并生成计划，AI 才能解释今天为什么这样练。"}
        </p>
      )}

      {result?.source === "local" && (
        <p className="ai-state-note">{fallbackMessage(result.fallbackReason)}</p>
      )}
      {!ready && !result && (
        <p className="ai-state-note">
          {!available
            ? "当前正式版暂未开放个人 API Key，训练计划继续由本地规则生成。"
            : configured
              ? "DeepSeek 当前已关闭；本地规则仍正常生成训练。"
              : "尚未配置 DeepSeek API Key。"}
        </p>
      )}

      <div className="ai-card-footer">
        <div>
          <strong>只解释，不改计划</strong>
          <span>
            {result?.generatedAt ? `更新于 ${formatTime(result.generatedAt)}` : "不做医疗诊断，不读取体态照片"}
          </span>
        </div>
        {!ready && !result ? (
          <button type="button" className="glass-button" onClick={onOpenSettings}>
            {available ? "去配置" : "查看说明"}
          </button>
        ) : (
          <button type="button" className="glass-button" disabled={!plan || loading} onClick={() => void generate()}>
            {loading ? "生成中" : result ? "重新生成" : "生成今日解读"}
          </button>
        )}
      </div>
    </section>
  );
}

function aiTitle(
  state: "loading" | "error" | "success" | "fallback" | "ready" | "setup",
  available: boolean,
  configured: boolean,
  enabled: boolean
): string {
  if (state === "loading") return "正在读懂今天的训练";
  if (state === "error") return "这次没连上，可重试";
  if (state === "success") return "DeepSeek 解读已生成";
  if (state === "fallback") return "已切回本地规则说明";
  if (state === "ready") return "让 DeepSeek 解释今天为什么这样练";
  if (!available) return "当前使用本地规则";
  if (!configured) return "连接你的 DeepSeek";
  if (!enabled) return "DeepSeek 当前已关闭";
  return "AI 教练待命";
}

function fallbackMessage(reason?: AiTextResponse["fallbackReason"]): string {
  if (reason === "request_failed") return "DeepSeek 本次调用失败，已自动使用本地规则；可稍后重试。";
  if (reason === "not_configured") return "未配置 Key，本次显示本地规则说明。";
  if (reason === "disabled") return "DeepSeek 已关闭，本次显示本地规则说明。";
  return "本次由本地规则提供说明。";
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
