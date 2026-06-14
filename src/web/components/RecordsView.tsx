import { useEffect, useMemo, useState } from "react";
import { trainingTemplates } from "../../core/training-templates";
import { recommendationLabel } from "../../core/weekly-review";
import { describeApiError, generateWeeklyReview, getRecordsSummary, type RecordsSummaryResponse } from "../api";

const templateNameById: Map<string, string> = new Map(
  trainingTemplates.map((template) => [template.id, template.name])
);

export function RecordsView() {
  const [summary, setSummary] = useState<RecordsSummaryResponse["summary"] | null>(null);
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
      {summary && <MonthlyStatusCalendar checkins={summary.calendarCheckins} />}

      <div className="hero-card">
        <p className="eyebrow">记录</p>
        <h2>趋势看板</h2>
        <p>腰酸、睡眠、精神和体重都按时间看，不只看某一天。</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {weeklyAiInfo && <p className="success-text">{weeklyAiInfo}</p>}

      {summary && (
        <>
          <div className="card-grid">
            <article className="card">
              <span className="metric">{summary.weeklyTrainingCount}</span>
              <p>本周已完成主训练次数</p>
            </article>
            <article className="card">
              <span className="metric">{summary.progressionRecords.length}</span>
              <p>进阶记录</p>
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
  checkins
}: {
  checkins: RecordsSummaryResponse["summary"]["calendarCheckins"];
}) {
  const anchorDate = checkins[0]?.date ?? formatLocalDate();
  const days = buildCalendarDays(anchorDate);
  const checkinByDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));

  return (
    <section className="card calendar-card">
      <div className="calendar-head">
        <div>
          <p className="eyebrow">月历</p>
          <h2>{formatMonthTitle(anchorDate)}</h2>
        </div>
        <span className="date-pill">已记录 {checkins.length} 天</span>
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
            <div
              className={[
                "status-day",
                day.inMonth ? "" : "outside-month",
                checkin ? "has-checkin" : "",
                checkin ? statusClass(checkin.lowBackPain, checkin.energy) : "",
                isToday ? "today" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={day.date}
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
            </div>
          );
        })}
      </div>
    </section>
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
  const [year, month] = anchorDate.slice(0, 7).split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function formatSleep(hours?: number): string {
  return typeof hours === "number" ? `${Math.round(hours * 10) / 10}h` : "-";
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
