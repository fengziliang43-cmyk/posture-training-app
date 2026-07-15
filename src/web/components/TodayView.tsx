import type { CSSProperties } from "react";
import type { DailyCheckinInput, PlanResponsePlan } from "../api";
import { StatusForm } from "./StatusForm";
import { TodayPlan } from "./TodayPlan";

interface TodayViewProps {
  date: string;
  plan: PlanResponsePlan | null;
  loading: boolean;
  finishing: boolean;
  error: string | null;
  info: string | null;
  mode: "overview" | "task";
  latestStatus: DailyCheckinInput | null;
  onModeChange: (mode: "overview" | "task") => void;
  onSubmitStatus: (status: DailyCheckinInput) => Promise<void> | void;
  onFinishWorkout: () => Promise<void> | void;
  onPlanChange: (plan: PlanResponsePlan) => void;
}

export function TodayView({
  date,
  plan,
  loading,
  finishing,
  error,
  info,
  mode,
  latestStatus,
  onModeChange,
  onSubmitStatus,
  onFinishWorkout,
  onPlanChange
}: TodayViewProps) {
  if (mode === "task") {
    return (
      <section className="stack today-task-view">
        <TodayPlan
          plan={plan}
          finishing={finishing}
          onBack={() => onModeChange("overview")}
          onFinishWorkout={onFinishWorkout}
          onPlanChange={onPlanChange}
        />
        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}
      </section>
    );
  }

  return (
    <section className="stack">
      <TodayOverviewCard
        date={date}
        latestStatus={latestStatus}
        plan={plan}
        onViewTask={() => onModeChange("task")}
      />
      {error && <p className="error-text">{error}</p>}
      {info && <p className="success-text">{info}</p>}
      {!plan && <StatusForm date={date} loading={loading} onSubmit={onSubmitStatus} />}
    </section>
  );
}

function TodayOverviewCard({
  date,
  latestStatus,
  plan,
  onViewTask
}: {
  date: string;
  latestStatus: DailyCheckinInput | null;
  plan: PlanResponsePlan | null;
  onViewTask: () => void;
}) {
  const lowBackPain = latestStatus?.lowBackPain ?? 2;
  const energy = latestStatus?.energy ?? 4;
  const availableMinutes = latestStatus?.availableMinutes ?? 45;
  const recoveryScore = Math.max(
    30,
    Math.min(96, 72 + energy * 5 - lowBackPain * 4 + Math.min(8, Math.floor(availableMinutes / 10)))
  );
  const painRisk = Math.min(100, lowBackPain * 10);
  const load = plan ? (plan.type === "full" ? 58 : plan.type === "reduced" ? 42 : 24) : 34;

  return (
    <section className="today-overview-card card">
      <div className="today-hero-head">
        <div>
          <p className="eyebrow">今日</p>
          <h2>{plan ? "可以练，别硬扛" : "先看状态，再定任务"}</h2>
        </div>
        <span className="date-pill">{formatDisplayDate(date)}</span>
      </div>

      <div className="readiness-panel">
        <div
          className="readiness-ring"
          style={{ "--score": `${recoveryScore}%` } as CSSProperties & Record<"--score", string>}
        >
          <strong>{recoveryScore}</strong>
          <span>恢复度</span>
        </div>
        <div className="readiness-copy">
          <p className="eyebrow">今日判断</p>
          <h3>{plan ? describeTodayDecision(plan) : "等待生成"}</h3>
          <p>{plan?.reason ?? "填写腰酸、精神和可训练时间后，生成今天的保守训练任务。"}</p>
          <button type="button" className="primary-button" disabled={!plan} onClick={onViewTask}>
            {plan ? "查看任务" : "先生成任务"}
          </button>
        </div>
      </div>

      <div className="signal-grid">
        <SignalTile label="恢复" value={`${recoveryScore}%`} tone="good" />
        <SignalTile label="训练压力" value={`${load}%`} tone="warn" />
        <SignalTile label="腰酸" value={`${lowBackPain}/10`} />
      </div>

      <div className="body-signal-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">今日状态</p>
            <h3>三项决定强度</h3>
          </div>
          <span className="date-pill">无红旗</span>
        </div>
        <SignalBar label="睡眠与精神" value={Math.min(100, energy * 20)} />
        <SignalBar label="腰酸风险" value={painRisk} />
        <SignalBar label="本周累计量" value={load} />
      </div>
    </section>
  );
}

function SignalTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className={["signal-tile", tone ? `signal-${tone}` : ""].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="signal-bar">
      <div className="signal-bar-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="signal-track">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function describePlanType(type: PlanResponsePlan["type"]): string {
  if (type === "full") return "完整训练";
  if (type === "reduced") return "降级训练";
  return "恢复日";
}

function describeTimeVersion(timeVersion: PlanResponsePlan["timeVersion"]): string {
  if (timeVersion === "full") return "完整版";
  if (timeVersion === "short") return "短版";
  return "压缩版";
}

function describeTodayDecision(plan: PlanResponsePlan): string {
  if (plan.type === "full") return "完整训练 · 控制版";
  if (plan.type === "reduced") return `降级训练 · ${describeTimeVersion(plan.timeVersion)}`;
  return "恢复日 · 保守版";
}

function formatDisplayDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}
