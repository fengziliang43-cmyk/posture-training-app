import { useEffect, useMemo, useState } from "react";
import { trainingTemplates } from "../../core/training-templates";
import { recommendationLabel } from "../../core/weekly-review";
import { describeApiError, generateWeeklyReview, getRecordsSummary, type RecordsSummaryResponse } from "../api";

const templateNameById: Map<string, string> = new Map(
  trainingTemplates.map((template) => [template.id, template.name])
);

export function RecordsView() {
  const [summary, setSummary] = useState<RecordsSummaryResponse["summary"] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weeklyAiSummary, setWeeklyAiSummary] = useState<string | null>(null);
  const [weeklyAiInfo, setWeeklyAiInfo] = useState<string | null>(null);

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
      {weeklyAiInfo && <p className="success-text">{weeklyAiInfo}</p>}

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
            aiSummary={weeklyAiSummary}
            onGenerate={() => void handleWeeklyAiSummary(summary.weeklyReview.weekEnd)}
          />

          <TrendBlock
            title="腰酸趋势"
            values={chronologicalCheckins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: checkin.lowBackPain,
              max: 10
            }))}
          />
          <TrendBlock
            title="精神趋势"
            values={chronologicalCheckins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: checkin.energy,
              max: 5
            }))}
          />
          <TrendBlock
            title="睡眠趋势"
            values={chronologicalCheckins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: Math.round((checkin.sleepHours ?? 0) * 10) / 10,
              max: 10
            }))}
          />

          {chronologicalWeights.length > 0 && (
            <TrendBlock
              title="体重趋势"
              values={chronologicalWeights.map((checkin) => ({
                label: checkin.date.slice(5),
                value: checkin.weightKg ?? 0,
                max: Math.max(...chronologicalWeights.map((item) => item.weightKg ?? 0)) || 1
              }))}
            />
          )}

          <section className="card">
            <h3 className="section-title">最近记录</h3>
            <div className="record-list">
              {summary.checkins.slice(0, 7).map((checkin) => (
                <div className="record-row" key={checkin.id}>
                  <span>{checkin.date}</span>
                  <span>腰酸 {checkin.lowBackPain}</span>
                  <span>睡眠 {checkin.sleepHours ?? "-"}h</span>
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
    setError(null);
    setWeeklyAiInfo(null);
    try {
      const result = await generateWeeklyReview(date);
      setWeeklyAiSummary(result.summary ?? "");
      setWeeklyAiInfo(result.source === "deepseek" ? "AI 周复盘已生成。" : "当前使用本地周复盘。");
    } catch (error) {
      setError(`周复盘生成失败：${describeApiError(error)}`);
    }
  }
}

function WeeklyReviewCard({
  summary,
  aiSummary,
  onGenerate
}: {
  summary: RecordsSummaryResponse["summary"];
  aiSummary: string | null;
  onGenerate: () => void;
}) {
  const review = summary.weeklyReview;

  return (
    <section className="card weekly-review-card">
      <div className="mini-head">
        <div>
          <p className="eyebrow">本周复盘</p>
          <h3>{recommendationLabel(review.recommendation)}</h3>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={onGenerate}>
          AI 复盘
        </button>
      </div>
      <p>{aiSummary ?? review.summary}</p>
      <div className="review-grid">
        <span>主训练 {review.completedMainWorkouts} 次</span>
        <span>最高腰酸 {review.highestLowBackPain ?? "-"} / 10</span>
        <span>平均睡眠 {review.averageSleepHours ?? "-"}h</span>
        <span>平均精神 {review.averageEnergy ?? "-"} / 5</span>
      </div>
    </section>
  );
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
  const anchorDate = checkins[0]?.date ?? formatLocalDate();
  const days = buildCalendarDays(anchorDate);
  const checkinByDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));

  return (
    <section className="card calendar-card">
      <div className="calendar-head">
        <div>
          <p className="eyebrow">月历</p>
          <h2>状态分布</h2>
        </div>
        <span className="date-pill">{formatMonthTitle(anchorDate)}</span>
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

function TrendBlock({
  title,
  values
}: {
  title: string;
  values: Array<{ label: string; value: number; max: number }>;
}) {
  return (
    <section className="card">
      <h3 className="section-title">{title}</h3>
      <div className="trend-grid">
        {values.slice(-7).map((entry) => (
          <div className="trend-item" key={`${title}-${entry.label}`}>
            <span className="trend-label">{entry.label}</span>
            <div className="trend-bar-track">
              <div
                className="trend-bar"
                style={{ width: `${Math.min(100, (entry.value / entry.max) * 100)}%` }}
              />
            </div>
            <span className="trend-value">{entry.value}</span>
          </div>
        ))}
      </div>
    </section>
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
