import { useEffect, useMemo, useState } from "react";
import { trainingTemplates } from "../../core/training-templates";
import { recommendationLabel } from "../../core/weekly-review";
import {
  describeApiError,
  generateWeeklyReview,
  getRecordsSummary,
  type AiTextResponse,
  type RecordsSummaryResponse
} from "../api";

const templateNameById: Map<string, string> = new Map(
  [
    ...trainingTemplates.map((template) => [template.id, template.name] as const),
    ["adaptive-balanced", "自适应平衡训练"] as const,
    ["adaptive-reduced", "自适应降级训练"] as const,
    ["adaptive-recovery", "自适应恢复日"] as const
  ]
);

export function RecordsView() {
  const [summary, setSummary] = useState<RecordsSummaryResponse["summary"] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weeklyAiResult, setWeeklyAiResult] = useState<AiTextResponse | null>(null);
  const [weeklyAiLoading, setWeeklyAiLoading] = useState(false);
  const [weeklyAiError, setWeeklyAiError] = useState<string | null>(null);

  useEffect(() => {
    getRecordsSummary()
      .then((response) => setSummary(response.summary))
      .catch(() => setError("记录加载失败。"));
  }, []);

  const chronologicalCheckins = useMemo(
    () => [...(summary?.checkins ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [summary]
  );
  const chronologicalWeights = useMemo(
    () => chronologicalCheckins.filter((checkin) => typeof checkin.weightKg === "number"),
    [chronologicalCheckins]
  );
  const checkinByDate = useMemo(
    () => new Map((summary?.calendarCheckins ?? []).map((checkin) => [checkin.date, checkin])),
    [summary]
  );

  useEffect(() => {
    if (!summary || selectedDate) return;
    setSelectedDate(summary.calendarCheckins[0]?.date ?? formatLocalDate());
  }, [selectedDate, summary]);

  if (!summary && !error) {
    return (
      <section className="stack">
        <div className="hero-card">
          <p className="eyebrow">记录</p>
          <h2>正在加载趋势</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="hero-card record-hero-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">记录</p>
            <h2>本周稳住</h2>
          </div>
          {summary && <span className="date-pill">已记录 {summary.calendarCheckins.length} 天</span>}
        </div>
        <p>腰酸、睡眠、精神和训练量放在一起看，避免被某一天带偏。</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {summary && (
        <>
          <MonthlyStatusCalendar
            checkins={summary.calendarCheckins}
            selectedDate={selectedDate ?? formatLocalDate()}
            onSelectDate={setSelectedDate}
          />

          <SelectedDayCard
            date={selectedDate ?? formatLocalDate()}
            checkin={checkinByDate.get(selectedDate ?? formatLocalDate())}
            progressionRecords={summary.progressionRecords}
          />

          <div className="metric-grid">
            <article className="card">
              <span className="metric">{summary.weeklyTrainingCount}</span>
              <p>主训练</p>
            </article>
            <article className="card">
              <span className="metric">{summary.weeklyReview.highestLowBackPain ?? "-"}/10</span>
              <p>最高腰酸</p>
            </article>
            <article className="card">
              <span className="metric">{summary.weeklyReview.averageSleepHours ?? "-"}h</span>
              <p>平均睡眠</p>
            </article>
          </div>

          <WeeklyReviewCard
            summary={summary}
            aiResult={weeklyAiResult}
            loading={weeklyAiLoading}
            error={weeklyAiError}
            onGenerate={() => void handleWeeklyAiSummary(summary.weeklyReview.weekEnd)}
          />

          <CombinedTrendCard
            checkins={chronologicalCheckins}
            weights={chronologicalWeights}
          />

          <section className="card">
            <h3 className="section-title">最近记录</h3>
            <div className="record-list">
              {summary.checkins.slice(0, 7).map((checkin) => (
                <div className="record-row" key={checkin.id}>
                  <span>{checkin.date}</span>
                  <span>腰酸 {checkin.lowBackPain}</span>
                  <span>{typeof checkin.sleepHours === "number" ? `睡眠 ${checkin.sleepHours}h` : "睡眠未记"}</span>
                  <span>精神 {checkin.energy}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3 className="section-title">进阶记录</h3>
            <div className="record-list">
              {summary.progressionRecords.map((record) => (
                <div className="record-row" key={record.id}>
                  <span>{record.date}</span>
                  <span>{formatTemplateName(record.templateId)}</span>
                  <span>{record.reason}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );

  async function handleWeeklyAiSummary(date: string) {
    setWeeklyAiLoading(true);
    setWeeklyAiError(null);
    try {
      const result = await generateWeeklyReview(date);
      setWeeklyAiResult(result);
    } catch (requestError) {
      setWeeklyAiError(describeApiError(requestError));
    } finally {
      setWeeklyAiLoading(false);
    }
  }
}

function WeeklyReviewCard({
  summary,
  aiResult,
  loading,
  error,
  onGenerate
}: {
  summary: RecordsSummaryResponse["summary"];
  aiResult: AiTextResponse | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const review = summary.weeklyReview;
  const sourceLabel = aiResult?.source === "deepseek" ? "DeepSeek" : "本地规则";

  return (
    <section className="weekly-review-card liquid-glass" aria-live="polite">
      <div className="mini-head">
        <div>
          <p className="eyebrow">AI 周复盘</p>
          <h3>{recommendationLabel(review.recommendation)}</h3>
        </div>
        <span className={`source-badge source-${aiResult?.source ?? "local"}`}>{sourceLabel}</span>
      </div>
      {loading ? (
        <div className="ai-skeleton compact" aria-label="正在生成周复盘">
          <span /><span /><span />
          <p>正在汇总本周状态…</p>
        </div>
      ) : (
        <p>{error ? `生成失败：${error}` : aiResult?.summary ?? review.summary}</p>
      )}
      {aiResult?.source === "local" && (
        <p className="ai-state-note">
          {aiResult.fallbackReason === "request_failed"
            ? "DeepSeek 本次不可用，已自动回退到本地复盘。"
            : "当前展示本地保守复盘；可启用 DeepSeek 后重新生成。"}
        </p>
      )}
      <div className="review-grid">
        <span>主训练 {review.completedMainWorkouts} 次</span>
        <span>最高腰酸 {review.highestLowBackPain ?? "-"} / 10</span>
        <span>平均睡眠 {review.averageSleepHours ?? "-"}h</span>
        <span>平均精神 {review.averageEnergy ?? "-"} / 5</span>
      </div>
      <div className="ai-card-footer">
        <div>
          <strong>只总结，不改规则</strong>
          <span>{aiResult?.generatedAt ? `更新于 ${formatAiTime(aiResult.generatedAt)}` : "建议始终保持保守"}</span>
        </div>
        <button type="button" className="glass-button" disabled={loading} onClick={onGenerate}>
          {loading ? "生成中" : aiResult || error ? "重新生成" : "生成 AI 周复盘"}
        </button>
      </div>
    </section>
  );
}

function formatAiTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function MonthlyStatusCalendar({
  checkins,
  selectedDate,
  onSelectDate
}: {
  checkins: RecordsSummaryResponse["summary"]["calendarCheckins"];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const initialAnchor = checkins[0]?.date ? checkins[0].date.slice(0, 7) : formatLocalDate().slice(0, 7);
  const [activeMonth, setActiveMonth] = useState(initialAnchor);

  function shiftMonth(delta: number) {
    const [y, m] = activeMonth.split("-").map(Number);
    const nextDate = new Date(y, m - 1 + delta, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    setActiveMonth(nextMonthStr);
  }

  const anchorDate = `${activeMonth}-01`;
  const days = buildCalendarDays(anchorDate);
  const checkinByDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));

  return (
    <section className="card calendar-card">
      <div className="calendar-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">月历</p>
          <h2>状态分布</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="secondary-button compact-button"
            style={{ minHeight: "32px", padding: "0 10px", fontSize: "14px" }}
            aria-label="上一月"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </button>
          <span className="date-pill">{formatMonthTitle(anchorDate)}</span>
          <button
            type="button"
            className="secondary-button compact-button"
            style={{ minHeight: "32px", padding: "0 10px", fontSize: "14px" }}
            aria-label="下一月"
            onClick={() => shiftMonth(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="status-calendar-grid">
        {days.map((day) => {
          const checkin = checkinByDate.get(day.date);
          const isToday = day.date === formatLocalDate();
          return (
            <button
              type="button"
              className={[
                "status-day",
                day.inMonth ? "" : "outside-month",
                checkin ? "has-checkin" : "",
                checkin ? statusClass(checkin.lowBackPain, checkin.energy) : "",
                isToday ? "today" : "",
                day.date === selectedDate ? "selected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={day.date}
              aria-pressed={day.date === selectedDate}
              onClick={() => onSelectDate(day.date)}
            >
              <div className="status-day-head">
                <span>{day.dayNumber}</span>
                {isToday && <strong>今</strong>}
              </div>
              {checkin ? (
                <div className="status-day-body">
                  <span>腰{checkin.lowBackPain}</span>
                  <span>精{checkin.energy}</span>
                  <span>睡{formatSleep(checkin.sleepHours)}</span>
                </div>
              ) : (
                <span className="status-empty">-</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedDayCard({
  date,
  checkin,
  progressionRecords
}: {
  date: string;
  checkin?: RecordsSummaryResponse["summary"]["calendarCheckins"][number];
  progressionRecords: RecordsSummaryResponse["summary"]["progressionRecords"];
}) {
  const dayProgressions = progressionRecords.filter((record) => record.date === date);

  return (
    <section className="card selected-day-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">当天状态</p>
          <h3>{formatDisplayDate(date)}</h3>
        </div>
        <span className="date-pill">{checkin ? "已记录" : "未记录"}</span>
      </div>

      {checkin ? (
        <>
          <div className="selected-day-grid">
            <MetricPill label="腰酸" value={`${checkin.lowBackPain}/10`} />
            <MetricPill label="精神" value={`${checkin.energy}/5`} />
            <MetricPill label="睡眠" value={formatSleep(checkin.sleepHours)} />
            <MetricPill label="时间" value={`${checkin.availableMinutes} 分`} />
          </div>
          <div className="selected-day-list">
            <span>肩颈 {formatOptionalScore(checkin.neckShoulderPain)}</span>
            <span>步数 {typeof checkin.steps === "number" ? checkin.steps : "-"}</span>
            <span>饮食 {formatEatingStatus(checkin.eatingStatus)}</span>
            <span>体重 {typeof checkin.weightKg === "number" ? `${checkin.weightKg}kg` : "-"}</span>
          </div>
          {dayProgressions.length > 0 && (
            <p className="muted small">
              当天训练：{dayProgressions.map((record) => formatTemplateName(record.templateId)).join("、")}
            </p>
          )}
        </>
      ) : (
        <p className="muted">这一天还没有状态记录。后面数据多了，直接点日期就能定位，不用往下翻最近记录。</p>
      )}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="selected-day-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTemplateName(templateId: string): string {
  return templateNameById.get(templateId) ?? templateId;
}

type TrendTab = "pain" | "energy" | "sleep" | "weight";

function CombinedTrendCard({
  checkins,
  weights
}: {
  checkins: Array<{ date: string; lowBackPain: number; energy: number; sleepHours?: number | null }>;
  weights: Array<{ date: string; weightKg?: number | null }>;
}) {
  const [tab, setTab] = useState<TrendTab>("pain");

  return (
    <section className="card combined-trend-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">身体趋势</p>
          <h3 className="section-title">
            {tab === "pain"
              ? "腰酸走势"
              : tab === "energy"
                ? "精神状态走势"
                : tab === "sleep"
                  ? "睡眠时长走势"
                  : "体重走势"}
          </h3>
        </div>
        <span className="date-pill">最近 7 天</span>
      </div>

      <div className="chip-row" style={{ marginTop: "8px", marginBottom: "14px" }}>
        <button
          type="button"
          className={tab === "pain" ? "secondary-button active-chip" : "secondary-button"}
          onClick={() => setTab("pain")}
        >
          腰酸
        </button>
        <button
          type="button"
          className={tab === "energy" ? "secondary-button active-chip" : "secondary-button"}
          onClick={() => setTab("energy")}
        >
          精神
        </button>
        <button
          type="button"
          className={tab === "sleep" ? "secondary-button active-chip" : "secondary-button"}
          onClick={() => setTab("sleep")}
        >
          睡眠
        </button>
        <button
          type="button"
          className={tab === "weight" ? "secondary-button active-chip" : "secondary-button"}
          onClick={() => setTab("weight")}
        >
          体重
        </button>
      </div>

      {tab === "pain" && (
        <TrendBars
          values={checkins.map((c) => ({
            label: c.date.slice(5),
            value: c.lowBackPain,
            max: 10
          }))}
        />
      )}
      {tab === "energy" && (
        <TrendBars
          values={checkins.map((c) => ({
            label: c.date.slice(5),
            value: c.energy,
            max: 5
          }))}
        />
      )}
      {tab === "sleep" && (
        <TrendBars
          values={checkins.map((c) => ({
            label: c.date.slice(5),
            value: typeof c.sleepHours === "number" ? Math.round(c.sleepHours * 10) / 10 : null,
            displayValue: typeof c.sleepHours === "number" ? `${Math.round(c.sleepHours * 10) / 10}h` : "未记",
            max: 10
          }))}
        />
      )}
      {tab === "weight" &&
        (weights.length > 0 ? (
          <TrendBars
            isWeight
            values={weights.map((w) => ({
              label: w.date.slice(5),
              value: typeof w.weightKg === "number" ? w.weightKg : null,
              displayValue: typeof w.weightKg === "number" ? `${w.weightKg}kg` : "未记"
            }))}
          />
        ) : (
          <p className="muted small" style={{ margin: "16px 0" }}>
            暂无体重记录数据，每日记录时可选择性填写。
          </p>
        ))}
    </section>
  );
}

function TrendBars({
  values,
  isWeight = false
}: {
  values: Array<{ label: string; value: number | null; displayValue?: string; max?: number; min?: number }>;
  isWeight?: boolean;
}) {
  const numericValues = values.map((v) => v.value).filter((v): v is number => typeof v === "number");
  const overallMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const overallMax = numericValues.length > 0 ? Math.max(...numericValues) : 1;

  return (
    <div className="trend-grid">
      {values.slice(-7).map((entry) => {
        let percentage = 0;
        if (entry.value !== null) {
          const min =
            entry.min !== undefined
              ? entry.min
              : isWeight && overallMax - overallMin > 0
                ? Math.max(0, overallMin - 2)
                : 0;
          const max = entry.max !== undefined ? entry.max : overallMax;
          const span = max - min;
          percentage = span > 0 ? Math.max(10, Math.min(100, Math.round(((entry.value - min) / span) * 100))) : 50;
        }
        return (
          <div className="trend-item" key={`trend-${entry.label}`}>
            <span className="trend-label">{entry.label}</span>
            <div className="trend-bar-track">
              <div
                className="trend-bar"
                style={{ width: entry.value !== null ? `${percentage}%` : "0%" }}
              />
            </div>
            <span className="trend-value">
              {entry.displayValue ?? (entry.value !== null ? `${entry.value}` : "未记")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function buildCalendarDays(anchorDate: string): Array<{ date: string; dayNumber: number; inMonth: boolean }> {
  const [year, month] = anchorDate.slice(0, 7).split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const startDate = new Date(year, month - 1, 1 - firstDate.getDay());
  const days: Array<{ date: string; dayNumber: number; inMonth: boolean }> = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    days.push({
      date: formatDate(date),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === month - 1
    });
  }

  return days;
}

function formatMonthTitle(anchorDate: string): string {
  const [, month] = anchorDate.slice(0, 7).split("-").map(Number);
  return `${month} 月`;
}

function formatDisplayDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

function formatSleep(hours?: number): string {
  return typeof hours === "number" ? `${Math.round(hours * 10) / 10}h` : "-";
}

function formatOptionalScore(score?: number): string {
  return typeof score === "number" ? `${score}/10` : "-";
}

function formatEatingStatus(status?: "poor" | "normal" | "good"): string {
  if (status === "poor") return "偏差";
  if (status === "good") return "好";
  if (status === "normal") return "一般";
  return "-";
}

function statusClass(lowBackPain: number, energy: number): string {
  if (lowBackPain >= 6 || energy <= 2) {
    return "status-hard";
  }
  if (lowBackPain >= 3 || energy === 3) {
    return "status-medium";
  }
  return "status-good";
}

function formatLocalDate(): string {
  return formatDate(new Date());
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
