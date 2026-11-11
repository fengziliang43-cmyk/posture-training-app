import { useEffect, useState } from "react";
import {
  describeApiError,
  generateDailyExplanation,
  getSettings,
  type AiTextResponse,
  type PlanResponsePlan,
  type SettingsRecord
} from "../api";
import { Icon } from "./ui";

interface AiCoachCardProps {
  plan: PlanResponsePlan | null;
  onOpenSettings: () => void;
}

/** One closed row on Today; opens to the AI's explanation of today's plan. */
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
    <details className="ai-row" aria-live="polite">
      <summary>
        <Icon name="spark" />
        <span>让 AI 讲讲今天的安排</span>
        <Icon name="right" size={16} />
      </summary>

      <div className="ai-row-body">
        {loading ? (
          <p className="muted">DeepSeek 正在解释今天的训练计划…</p>
        ) : error ? (
          <p className="error-text">这次没连上：{error}</p>
        ) : result?.explanation ? (
          <>
            <p className="ai-copy">{result.explanation}</p>
            <p className="muted small">
              {result.source === "deepseek" ? "DeepSeek" : "本地规则"}
              {result.generatedAt ? ` · 更新于 ${formatTime(result.generatedAt)}` : ""}
            </p>
          </>
        ) : (
          <p className="muted">
            {!ready
              ? !available
                ? "个人 API Key 当前被服务器的安全开关暂停，训练计划继续由本地规则生成。"
                : configured
                  ? "DeepSeek 当前已关闭；本地规则仍正常生成训练。"
                  : "还没连接 DeepSeek。连接后，这里会用你自己的 Key 解释今天为什么这样练。"
              : "点下面的按钮，让 DeepSeek 解释今天为什么这样练。"}
          </p>
        )}

        {result?.source === "local" && <p className="ai-state-note">{fallbackMessage(result.fallbackReason)}</p>}

        <div className="ai-row-actions">
          <span className="muted small">只解释，不改计划；不做医疗诊断，不读取体态照片。</span>
          {!ready && !result ? (
            <button type="button" className="secondary-button compact-button" onClick={onOpenSettings}>
              {available ? "去配置" : "查看说明"}
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={!plan || loading}
              onClick={() => void generate()}
            >
              {loading ? "生成中" : result ? "重新生成" : "生成今日解读"}
            </button>
          )}
        </div>
      </div>
    </details>
  );
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
