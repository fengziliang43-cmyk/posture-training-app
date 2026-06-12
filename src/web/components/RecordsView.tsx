import { useEffect, useMemo, useState } from "react";
import { getRecordsSummary, type RecordsSummaryResponse } from "../api";

export function RecordsView() {
  const [summary, setSummary] = useState<RecordsSummaryResponse["summary"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecordsSummary()
      .then((response) => setSummary(response.summary))
      .catch(() => setError("记录加载失败。"));
  }, []);

  const weights = useMemo(
    () => (summary?.checkins ?? []).filter((checkin) => typeof checkin.weightKg === "number"),
    [summary]
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
      <div className="hero-card">
        <p className="eyebrow">记录</p>
        <h2>趋势看板</h2>
        <p>腰酸、睡眠、精神和体重都按时间看，不只看某一天。</p>
      </div>

      {error && <p className="error-text">{error}</p>}

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

          <TrendBlock
            title="腰酸趋势"
            values={summary.checkins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: checkin.lowBackPain,
              max: 10
            }))}
          />
          <TrendBlock
            title="精神趋势"
            values={summary.checkins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: checkin.energy,
              max: 5
            }))}
          />
          <TrendBlock
            title="睡眠趋势"
            values={summary.checkins.map((checkin) => ({
              label: checkin.date.slice(5),
              value: Math.round((checkin.sleepHours ?? 0) * 10) / 10,
              max: 10
            }))}
          />

          {weights.length > 0 && (
            <TrendBlock
              title="体重趋势"
              values={weights.map((checkin) => ({
                label: checkin.date.slice(5),
                value: checkin.weightKg ?? 0,
                max: Math.max(...weights.map((item) => item.weightKg ?? 0)) || 1
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
                  <span>{record.templateId}</span>
                  <span>{record.reason}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
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
