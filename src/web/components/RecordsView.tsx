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
import { formatDayLabel, shortReason } from "../format";
import { Icon, Segmented } from "./ui";

const templateNameById: Map<string, string> = new Map(
  [
    ...trainingTemplates.map((template) => [template.id, template.name] as const),
    ["adaptive-balanced", "自适应平衡训练"] as const,
    ["adaptive-reduced", "自适应降级训练"] as const,
    ["adaptive-recovery", "自适应恢复日"] as const
  ]
);

type Summary = RecordsSummaryResponse["summary"];
type CalendarCheckins = Summary["calendarCheckins"];
type CheckinRecord = CalendarCheckins[number];

interface RecordsViewProps {
  /** Lets the empty state send a first-time person to where records are made. */
  onOpenToday?: () => void;
}

export function RecordsView({ onOpenToday }: RecordsViewProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // The calendar month on screen ("2026-11") and the records already fetched for each month.
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [monthCheckins, setMonthCheckins] = useState<Record<string, CalendarCheckins>>({});
  // Days with a finished main workout, from every month fetched so far.
  const [trainedDays, setTrainedDays] = useState<ReadonlySet<string>>(new Set());
  const [monthLoading, setMonthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyAiResult, setWeeklyAiResult] = useState<AiTextResponse | null>(null);
  const [weeklyAiLoading, setWeeklyAiLoading] = useState(false);
  const [weeklyAiError, setWeeklyAiError] = useState<string | null>(null);

  function loadSummary() {
    setError(null);
    getRecordsSummary()
      .then((response) => {
        setSummary(response.summary);
        setTrainedDays(new Set(response.summary.trainedDates));
      })
      .catch(() => setError("记录加载失败。"));
  }

  useEffect(loadSummary, []);

  const chronologicalCheckins = useMemo(
    () => [...(summary?.checkins ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [summary]
  );
  const chronologicalWeights = useMemo(
    () => chronologicalCheckins.filter((checkin) => typeof checkin.weightKg === "number"),
    [chronologicalCheckins]
  );
  // Every day we have a record for, from whichever month it was fetched.
  const checkinByDate = useMemo(() => {
    const byDate = new Map<string, CheckinRecord>();
    for (const list of Object.values(monthCheckins)) {
      for (const checkin of list) byDate.set(checkin.date, checkin);
    }
    for (const checkin of summary?.checkins ?? []) {
      if (!byDate.has(checkin.date)) byDate.set(checkin.date, checkin);
    }
    return byDate;
  }, [monthCheckins, summary]);

  // The first response holds the month of the latest record: start there.
  useEffect(() => {
    if (!summary || activeMonth) return;
    const firstMonth = summary.calendarCheckins[0]?.date.slice(0, 7) ?? formatLocalDate().slice(0, 7);
    setMonthCheckins((current) => ({ ...current, [firstMonth]: summary.calendarCheckins }));
    setActiveMonth(firstMonth);
  }, [summary, activeMonth]);

  // Open on today when it has a record, otherwise on the latest recorded day of the month.
  useEffect(() => {
    if (!summary || selectedDate || !activeMonth) return;
    const days = monthCheckins[activeMonth] ?? [];
    const today = formatLocalDate();
    setSelectedDate(days.some((day) => day.date === today) ? today : (days[days.length - 1]?.date ?? today));
  }, [selectedDate, summary, activeMonth, monthCheckins]);

  const newestMonth = [...Object.keys(monthCheckins), formatLocalDate().slice(0, 7)].sort().pop() ?? "";

  async function shiftMonth(delta: number) {
    if (!activeMonth || monthLoading) return;
    const target = shiftYearMonth(activeMonth, delta);
    const selectDayIn = (month: string, days: CalendarCheckins) =>
      setSelectedDate(days[days.length - 1]?.date ?? `${month}-01`);

    setActiveMonth(target);
    if (monthCheckins[target]) {
      selectDayIn(target, monthCheckins[target]);
      return;
    }

    setMonthLoading(true);
    try {
      // The summary of any day in a month carries that month's calendar records and trained days.
      const response = await getRecordsSummary(`${target}-01`);
      setMonthCheckins((current) => ({ ...current, [target]: response.summary.calendarCheckins }));
      setTrainedDays((current) => new Set([...current, ...response.summary.trainedDates]));
      selectDayIn(target, response.summary.calendarCheckins);
      setError(null);
    } catch {
      setActiveMonth(activeMonth);
      setError("这个月的记录加载失败，请再试一次。");
    } finally {
      setMonthLoading(false);
    }
  }

  async function handleWeeklyAiSummary(date: string) {
    setWeeklyAiLoading(true);
    setWeeklyAiError(null);
    try {
      setWeeklyAiResult(await generateWeeklyReview(date));
    } catch (requestError) {
      setWeeklyAiError(describeApiError(requestError));
    } finally {
      setWeeklyAiLoading(false);
    }
  }

  if (!summary) {
    return (
      <section className="stack">
        {error ? (
          <section className="card-solid empty-card">
            <p className="error-text" role="alert">{error}</p>
            <button type="button" className="wide" onClick={loadSummary}>
              重新加载
            </button>
          </section>
        ) : (
          <p className="muted-text records-loading">正在加载记录…</p>
        )}
      </section>
    );
  }

  if (summary.checkins.length === 0) {
    return (
      <section className="stack">
        <section className="card-solid empty-card">
          <h2>还没有记录</h2>
          <p>在“今日”记一次状态后，这里会出现月历、腰酸走势和每周复盘。</p>
          {onOpenToday && (
            <button type="button" className="wide" onClick={onOpenToday}>
              去记录今天的状态
            </button>
          )}
        </section>
      </section>
    );
  }

  const shownDate = selectedDate ?? formatLocalDate();

  return (
    <section className="stack">
      {error && <p className="error-text" role="alert">{error}</p>}

      <WeekSummaryCard summary={summary} />

      <WeeklyAiRow
        result={weeklyAiResult}
        loading={weeklyAiLoading}
        error={weeklyAiError}
        onGenerate={() => void handleWeeklyAiSummary(summary.weeklyReview.weekEnd)}
      />

      {activeMonth && (
        <MonthlyStatusCalendar
          month={activeMonth}
          recordedDays={(monthCheckins[activeMonth] ?? []).length}
          checkinByDate={checkinByDate}
          trainedDays={trainedDays}
          selectedDate={shownDate}
          onSelectDate={setSelectedDate}
          onShiftMonth={(delta) => void shiftMonth(delta)}
          canGoNext={activeMonth < newestMonth}
          loading={monthLoading}
        />
      )}

      <SelectedDayCard
        date={shownDate}
        checkin={checkinByDate.get(shownDate)}
        trained={trainedDays.has(shownDate)}
        progressionRecords={summary.progressionRecords}
      />

      <CombinedTrendCard checkins={chronologicalCheckins} weights={chronologicalWeights} />

      <RecentRecords checkins={summary.checkins.slice(0, 7)} />

      <PlanRecordsFold records={summary.progressionRecords} />
    </section>
  );
}

function WeekSummaryCard({ summary }: { summary: Summary }) {
  const review = summary.weeklyReview;
  const tone =
    review.recommendation === "eligible-for-progression" ? "good" : review.recommendation === "maintain" ? "neutral" : "warn";

  return (
    <section className="card-solid week-summary">
      <div className="card-head-row">
        <span className="label">本周</span>
        <span className={`status-pill ${tone}`}>{recommendationLabel(review.recommendation)}</span>
      </div>
      <div className="stat-row">
        <div>
          <b>{summary.weeklyTrainingCount}</b>
          <span>主训练</span>
        </div>
        <div>
          <b>{review.highestLowBackPain ?? "-"}</b>
          <span>最高腰酸</span>
        </div>
        <div>
          <b>{formatAverage(review.averageSleepHours)}</b>
          <span>平均睡眠 h</span>
        </div>
        <div>
          <b>{formatAverage(review.averageEnergy)}</b>
          <span>平均精神</span>
        </div>
      </div>
      <p className="week-text">{review.summary}</p>
    </section>
  );
}

function WeeklyAiRow({
  result,
  loading,
  error,
  onGenerate
}: {
  result: AiTextResponse | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <details className="ai-row" aria-live="polite">
      <summary>
        <Icon name="spark" />
        <span>让 AI 复盘这一周</span>
        <Icon name="right" size={16} />
      </summary>

      <div className="ai-row-body">
        {loading ? (
          <p className="muted">正在汇总本周状态…</p>
        ) : error ? (
          <p className="error-text">生成失败：{error}</p>
        ) : result ? (
          <>
            <p className="ai-copy">{result.summary}</p>
            <p className="muted small">
              {result.source === "deepseek" ? "DeepSeek" : "本地规则"}
              {result.generatedAt ? ` · 更新于 ${formatAiTime(result.generatedAt)}` : ""}
            </p>
          </>
        ) : (
          <p className="muted">用本周的记录生成一段复盘。</p>
        )}

        {result?.source === "local" && (
          <p className="ai-state-note">
            {result.fallbackReason === "request_failed"
              ? "DeepSeek 本次不可用，已自动回退到本地复盘。"
              : "当前展示本地保守复盘；可启用 DeepSeek 后重新生成。"}
          </p>
        )}

        <div className="ai-row-actions">
          <span className="muted small">只总结，不改训练规则。</span>
          <button type="button" className="secondary-button compact-button" disabled={loading} onClick={onGenerate}>
            {loading ? "生成中" : result || error ? "重新生成" : "生成周复盘"}
          </button>
        </div>
      </div>
    </details>
  );
}

function formatAiTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatAverage(value?: number): string {
  return typeof value === "number" ? String(Math.round(value * 10) / 10) : "-";
}

function MonthlyStatusCalendar({
  month,
  recordedDays,
  checkinByDate,
  trainedDays,
  selectedDate,
  onSelectDate,
  onShiftMonth,
  canGoNext,
  loading
}: {
  month: string;
  recordedDays: number;
  checkinByDate: ReadonlyMap<string, CheckinRecord>;
  trainedDays: ReadonlySet<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onShiftMonth: (delta: number) => void;
  canGoNext: boolean;
  loading: boolean;
}) {
  const anchorDate = `${month}-01`;
  const days = buildCalendarDays(anchorDate);
  const today = formatLocalDate();

  return (
    <section className="card-solid calendar-card" aria-busy={loading}>
      <div className="card-head-row">
        <div>
          <h2 className="cal-title">{formatMonthTitle(anchorDate)}</h2>
          <p className="muted-text">已记录 {recordedDays} 天</p>
        </div>
        <div className="cal-nav">
          <button type="button" className="icon-button" aria-label="上一月" disabled={loading} onClick={() => onShiftMonth(-1)}>
            <Icon name="left" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="下一月"
            disabled={loading || !canGoNext}
            onClick={() => onShiftMonth(1)}
          >
            <Icon name="right" />
          </button>
        </div>
      </div>

      <div className="cal-weekdays" aria-hidden="true">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="cal-grid">
        {days.map((day) => {
          const checkin = checkinByDate.get(day.date);
          const trained = trainedDays.has(day.date);
          const isToday = day.date === today;
          const selected = day.date === selectedDate;
          return (
            <button
              type="button"
              key={day.date}
              className={[
                "cal-day",
                day.inMonth ? "" : "outside",
                checkin ? statusClass(checkin.lowBackPain, checkin.energy) : "",
                isToday ? "today" : "",
                selected ? "selected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={selected}
              aria-label={`${formatDayLabel(day.date)}${checkin ? `，腰酸 ${checkin.lowBackPain}` : "，没有记录"}${trained ? "，练过" : ""}${isToday ? "，今天" : ""}`}
              onClick={() => onSelectDate(day.date)}
            >
              <span>{day.dayNumber}</span>
              {trained && <i className="cal-trained" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="cal-legend" aria-label="图例">
        <span><i className="good" />状态好</span>
        <span><i className="medium" />一般</span>
        <span><i className="hard" />较差</span>
        <span><i className="dot" />练过</span>
        <span><i className="ring" />今天</span>
      </div>
      <p className="muted small">颜色按当天的腰酸和精神一起算。</p>
    </section>
  );
}

function SelectedDayCard({
  date,
  checkin,
  trained,
  progressionRecords
}: {
  date: string;
  checkin?: CheckinRecord;
  trained: boolean;
  progressionRecords: Summary["progressionRecords"];
}) {
  const dayPlans = progressionRecords.filter((record) => record.date === date);
  const extras = checkin
    ? [
        typeof checkin.neckShoulderPain === "number" ? `肩颈 ${checkin.neckShoulderPain}/10` : null,
        typeof checkin.steps === "number" ? `步数 ${checkin.steps}` : null,
        checkin.eatingStatus ? `饮食 ${formatEatingStatus(checkin.eatingStatus)}` : null,
        typeof checkin.weightKg === "number" ? `体重 ${checkin.weightKg}kg` : null
      ].filter((item): item is string => item !== null)
    : [];

  return (
    <section className="card-solid selected-day">
      <div className="card-head-row">
        <h3>{formatDayLabel(date)}</h3>
        <span className="day-pills">
          {trained && <span className="status-pill good">练过</span>}
          <span className="status-pill neutral">{checkin ? "已记录" : "没有记录"}</span>
        </span>
      </div>

      {checkin ? (
        <>
          <div className="mini-stats">
            <div>
              <span>腰酸</span>
              <b>{checkin.lowBackPain}/10</b>
            </div>
            <div>
              <span>精神</span>
              <b>{checkin.energy}/5</b>
            </div>
            <div>
              <span>睡眠</span>
              <b>{formatSleep(checkin.sleepHours)}</b>
            </div>
            <div>
              <span>可练</span>
              <b>{checkin.availableMinutes}分</b>
            </div>
          </div>
          {extras.length > 0 && (
            <div className="pill-row">
              {extras.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="muted">这一天没有状态记录。</p>
      )}

      {dayPlans.length > 0 && (
        <p className="muted small">当天安排：{dayPlans.map((record) => formatTemplateName(record.templateId)).join("、")}</p>
      )}
    </section>
  );
}

function formatTemplateName(templateId: string): string {
  return templateNameById.get(templateId) ?? templateId;
}

type TrendTab = "pain" | "energy" | "sleep" | "weight";

const TREND_TABS: ReadonlyArray<{ value: TrendTab; label: string }> = [
  { value: "pain", label: "腰酸" },
  { value: "energy", label: "精神" },
  { value: "sleep", label: "睡眠" },
  { value: "weight", label: "体重" }
];

function CombinedTrendCard({
  checkins,
  weights
}: {
  checkins: Array<{ date: string; lowBackPain: number; energy: number; sleepHours?: number | null }>;
  weights: Array<{ date: string; weightKg?: number | null }>;
}) {
  const [tab, setTab] = useState<TrendTab>("pain");

  return (
    <section className="card-solid combined-trend-card">
      <div className="card-head-row">
        <h3>
          {tab === "pain"
            ? "腰酸走势"
            : tab === "energy"
              ? "精神状态走势"
              : tab === "sleep"
                ? "睡眠时长走势"
                : "体重走势"}
        </h3>
        <span className="muted-text">最近 7 次记录</span>
      </div>

      <Segmented label="看哪一项的走势" options={TREND_TABS} value={tab} onChange={setTab} />

      {tab === "pain" && (
        <TrendBars values={checkins.map((c) => ({ label: c.date.slice(5), value: c.lowBackPain, max: 10 }))} />
      )}
      {tab === "energy" && (
        <TrendBars values={checkins.map((c) => ({ label: c.date.slice(5), value: c.energy, max: 5 }))} />
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
          <p className="muted small">暂无体重记录。每天记录状态时可以选填。</p>
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
    <div className="trend-rows">
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
          percentage = span > 0 ? Math.min(100, Math.max(0, Math.round(((entry.value - min) / span) * 100))) : 0;
          if (entry.value > min && percentage < 4) percentage = 4;
        }
        return (
          <div className="trend-row" key={`trend-${entry.label}`}>
            <span className="trend-date">{entry.label}</span>
            <div className="trend-track">
              <div className="trend-fill" style={{ width: entry.value !== null ? `${percentage}%` : "0%" }} />
            </div>
            <span className="trend-num">{entry.displayValue ?? (entry.value !== null ? `${entry.value}` : "未记")}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecentRecords({ checkins }: { checkins: Summary["checkins"] }) {
  return (
    <section className="card-solid">
      <h3>最近记录</h3>
      <table className="records-table">
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">腰酸</th>
            <th scope="col">睡眠</th>
            <th scope="col">精神</th>
          </tr>
        </thead>
        <tbody>
          {checkins.map((checkin) => (
            <tr key={checkin.id}>
              <th scope="row">{formatDayLabel(checkin.date)}</th>
              <td>{checkin.lowBackPain}</td>
              <td>{typeof checkin.sleepHours === "number" ? `${checkin.sleepHours}h` : "未记"}</td>
              <td>{checkin.energy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PlanRecordsFold({ records }: { records: Summary["progressionRecords"] }) {
  if (records.length === 0) return null;

  return (
    <details className="fold-card">
      <summary>
        <span>训练计划记录</span>
        <small>最近 {records.length} 次</small>
        <Icon name="right" size={16} />
      </summary>
      <ul className="plan-records">
        {records.map((record) => (
          <li key={record.id}>
            <div>
              <b>{formatDayLabel(record.date)}</b>
              <span>{formatTemplateName(record.templateId)}</span>
            </div>
            <p>{shortReason(record.reason)}</p>
          </li>
        ))}
      </ul>
    </details>
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

  // A sixth row that is all next month is only empty space.
  return days[35].inMonth ? days : days.slice(0, 35);
}

function formatMonthTitle(anchorDate: string): string {
  const [year, month] = anchorDate.slice(0, 7).split("-").map(Number);
  // Say the year only once it is not this year, so paging far back stays unambiguous.
  return year === new Date().getFullYear() ? `${month} 月` : `${year} 年 ${month} 月`;
}

function shiftYearMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
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
