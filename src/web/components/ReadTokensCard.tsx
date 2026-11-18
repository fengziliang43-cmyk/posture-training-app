import { useEffect, useState } from "react";
import {
  createReadToken,
  describeApiError,
  listReadTokens,
  revokeReadToken,
  type CreatedReadTokenResponse,
  type ReadTokenRecord
} from "../api";

function formatTokenTime(iso: string | null): string {
  if (!iso) return "还没用过";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

export function ReadTokensCard() {
  const [tokens, setTokens] = useState<ReadTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [createdToken, setCreatedToken] = useState<CreatedReadTokenResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const response = await listReadTokens();
      setTokens(response.tokens);
    } catch (requestError) {
      setError(`读取钥匙列表失败：${describeApiError(requestError)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const created = await createReadToken(nameInput || undefined);
      setCreatedToken(created);
      setNameInput("");
      const response = await listReadTokens();
      setTokens(response.tokens);
    } catch (requestError) {
      setError(`生成钥匙失败：${describeApiError(requestError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(token: ReadTokenRecord) {
    if (typeof window !== "undefined" && !window.confirm(`确定作废「${token.name}」吗？作废后对应的仪表盘将立即无法读取。`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await revokeReadToken(token.id);
      setTokens((current) => current.filter((item) => item.id !== token.id));
      if (createdToken?.id === token.id) {
        setCreatedToken(null);
      }
    } catch (requestError) {
      setError(`作废钥匙失败：${describeApiError(requestError)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
    } catch {
      setError("复制失败，请长按或选中上方输入框手动复制。");
    }
  }

  return (
    <section className="card-solid setting-panel">
      <p className="eyebrow">外部仪表盘</p>
      <h3 className="section-title">只读钥匙（给自己的仪表盘用）</h3>
      <p className="muted small">
        生成一把只读钥匙，让你自己的仪表盘（比如中控台）读：这周和这个月练了哪几天、最近 14 天的不适和精力、有没有记过危险信号、最近一次计划调整。不含照片、档案和备注。钥匙随时能作废。
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}

      {createdToken && (
        <div className="stack compact-stack" role="status">
          <p className="success-text">已生成「{createdToken.name}」：只显示这一次，关掉就看不到了</p>
          <input
            type="text"
            readOnly
            value={createdToken.token}
            aria-label="新生成的只读钥匙"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="stack compact-stack">
            <button type="button" className="secondary-button" onClick={() => void handleCopy()}>
              {copied ? "已复制" : "复制"}
            </button>
            <button type="button" className="secondary-button" onClick={() => setCreatedToken(null)}>
              我已保存，收起
            </button>
          </div>
        </div>
      )}

      <div className="stack compact-stack">
        <label className="setting-input">
          钥匙名字（选填）
          <input
            type="text"
            value={nameInput}
            maxLength={40}
            placeholder="中控台"
            onChange={(event) => setNameInput(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || tokens.length >= 5}
          onClick={() => void handleCreate()}
        >
          {tokens.length >= 5 ? "已达上限（最多 5 把）" : busy ? "正在生成…" : "生成一把"}
        </button>
      </div>

      {loading ? (
        <p className="muted small">正在读取钥匙列表…</p>
      ) : tokens.length === 0 ? (
        <p className="muted small">还没有有效钥匙。</p>
      ) : (
        <div className="stack compact-stack">
          {tokens.map((token) => (
            <div key={token.id} className="stack compact-stack">
              <div>
                <strong>{token.name}</strong>
                <p className="muted small">
                  生成：{formatTokenTime(token.createdAt)} · 最近使用：{formatTokenTime(token.lastUsedAt)}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void handleRevoke(token)}
              >
                作废
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
