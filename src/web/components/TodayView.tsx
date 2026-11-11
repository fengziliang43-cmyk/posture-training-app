import type { CSSProperties } from "react";
import type { ExerciseResult } from "../../core/types";
import type { DailyCheckinInput, PlanResponsePlan } from "../api";
import { StatusForm } from "./StatusForm";
import { TodayPlan } from "./TodayPlan";
import { AiCoachCard } from "./AiCoachCard";
import { describePainChange } from "../pain-feedback";

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
  onFinishWorkout: (lowBackPainAfter: number, exerciseResults: ExerciseResult[]) => Promise<void> | void;
  onPlanChange: (plan: PlanResponsePlan) => void;
  onOpenSettings: () => void;
  onOpenRecords?: () => void;
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
  onPlanChange,
  onOpenSettings,
  onOpenRecords
}: TodayViewProps) {
  if (mode === "task") {
    return (
      <section className="stack today-task-view">
        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}
        <TodayPlan
          plan={plan}
          latestStatus={latestStatus}
          finishing={finishing}
          onBack={() => onModeChange("overview")}
          onFinishWorkout={onFinishWorkout}
          onPlanChange={onPlanChange}
        />
      </section>
    );
  }

  if (hasSafetyStop(latestStatus, plan)) {
    return (
      <section className="stack">
        {error && <p className="error-text">{error}</p>}
        {info && <p className="success-text">{info}</p>}
        <SafetyStopCard latestStatus={latestStatus} message={plan?.safetyMessage} />
        <StatusUpdateDrawer
          date={date}
          loading={loading}
          latestStatus={latestStatus}
          onSubmit={onSubmitStatus}
        />
      </section>
    );
  }

  return (
    <section className="stack">
      {error && <p className="error-text">{error}</p>}
      {info && <p className="success-text">{info}</p>}
      <TodayOverviewCard
        date={date}
        latestStatus={latestStatus}
        plan={plan}
        onViewTask={() => onModeChange("task")}
        onOpenRecords={onOpenRecords}
      />
      <AiCoachCard plan={plan} onOpenSettings={onOpenSettings} />
      {plan ? (
        <StatusUpdateDrawer
          date={date}
          loading={loading}
          latestStatus={latestStatus}
          onSubmit={onSubmitStatus}
        />
      ) : (
        <StatusForm date={date} loading={loading} initialStatus={latestStatus} onSubmit={onSubmitStatus} />
      )}
    </section>
  );
}

function StatusUpdateDrawer({
  date,
  loading,
  latestStatus,
  onSubmit
}: {
  date: string;
  loading: boolean;
  latestStatus: DailyCheckinInput | null;
  onSubmit: (status: DailyCheckinInput) => Promise<void> | void;
}) {
  return (
    <details className="status-drawer update-status-drawer">
      <summary>更新今日状态或上报不适</summary>
      <StatusForm
        date={date}
        loading={loading}
        initialStatus={latestStatus}
        submitLabel="更新状态并重新判断"
        onSubmit={onSubmit}
      />
    </details>
  );
}

function SafetyStopCard({
  latestStatus,
  message
}: {
  latestStatus: DailyCheckinInput | null;
  message?: string;
}) {
  const activeFlags = Object.entries(latestStatus?.redFlags ?? {})
    .filter(([, active]) => active)
    .map(([key]) => redFlagLabels[key as keyof NonNullable<DailyCheckinInput["redFlags"]>]);
  const displayMessage = activeFlags.length > 0
    ? "当前状态出现红旗症状，今天不提供任何可执行训练。"
    : message ?? "当前状态出现风险信号，今天不提供任何可执行训练。";

  return (
    <section className="safety-stop-card card" role="alert">
      <div className="safety-icon" aria-hidden="true">!</div>
      <p className="eyebrow">安全优先 · 今日计划已阻断</p>
      <h2>今天停止训练</h2>
      <p>{displayMessage}</p>
      {activeFlags.length > 0 && (
        <div className="safety-flag-list">
          {activeFlags.map((flag) => <span key={flag}>{flag}</span>)}
        </div>
      )}
      <div className="safety-advice">
        <strong>现在怎么做</strong>
        <p>停止负重、弯腰扭转和冲击动作；尽快联系医生做专业评估。若症状突然加重或出现大小便异常，请及时就医。</p>
      </div>
      <p className="muted small">这里不会生成 AI 解读或替代训练，避免把风险信号包装成可继续执行的建议。</p>
    </section>
  );
}

const redFlagLabels: Record<keyof NonNullable<DailyCheckinInput["redFlags"]>, string> = {
  legNumbness: "腿麻或持续刺痛",
  radiatingPain: "放射痛",
  weakness: "明显无力",
  bowelBladderChange: "大小便异常",
  sharpSuddenPain: "突发锐痛"
};

function hasSafetyStop(latestStatus: DailyCheckinInput | null, plan: PlanResponsePlan | null): boolean {
  return (
    Object.values(latestStatus?.redFlags ?? {}).some(Boolean) ||
    plan?.safetyMessage?.includes("红旗") === true
  );
}

function TodayOverviewCard({
  date,
  latestStatus,
  plan,
  onViewTask,
  onOpenRecords
}: {
  date: string;
  latestStatus: DailyCheckinInput | null;
  plan: PlanResponsePlan | null;
  onViewTask: () => void;
  onOpenRecords?: () => void;
}) {
  const workout = plan?.workout ?? null;
  if (plan && workout) {
    const painBefore = latestStatus?.lowBackPain;
    const painAfter = workout.lowBackPainAfter;
    const knowsBoth = typeof painBefore === "number" && typeof painAfter === "number";
    const completedExerciseCount = (workout.exerciseResults ?? []).filter(
      (result) => result.completionStatus === "completed"
    ).length;
    const headline =
      workout.completionStatus === "completed"
        ? "今天练完了"
        : workout.completionStatus === "partial"
          ? "今天练了一部分"
          : "今天先跳过了训练";

    return (
      <section className="today-overview-card card today-completed-hero">
        <div className="today-hero-head">
          <div>
            <p className="eyebrow">今日</p>
            <h2 className="completed-title">
              <span className="completed-check" aria-hidden="true">
                {workout.completionStatus === "completed" ? "✓" : "–"}
              </span>
              {headline}
            </h2>
          </div>
          <span className="date-pill">{formatDisplayDate(date)}</span>
        </div>

        <div className="signal-grid">
          <SignalTile label="完成动作" value={`${completedExerciseCount}/${plan.exercises.length}`} tone="good" />
          <SignalTile label="练前腰酸" value={typeof painBefore === "number" ? `${painBefore}/10` : "未记"} />
          <SignalTile
            label="练后腰酸"
            value={typeof painAfter === "number" ? `${painAfter}/10` : "未记"}
            tone={knowsBoth && painAfter - painBefore >= 2 ? "warn" : "good"}
          />
        </div>

        <p className="completed-note">
          {knowsBoth ? describePainChange(painBefore, painAfter) : "明天会按明天的状态重新判断训练安排。"}
        </p>

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onViewTask}>
            回顾今日动作
          </button>
          {onOpenRecords && (
            <button type="button" className="primary-button" onClick={onOpenRecords}>
              查看打卡与历史
            </button>
          )}
        </div>
      </section>
    );
  }

  const hasRecordedStatus = latestStatus !== null;
  const lowBackPain = latestStatus?.lowBackPain;
  const energy = latestStatus?.energy;
  const availableMinutes = latestStatus?.availableMinutes;
  const hasRedFlags = Object.values(latestStatus?.redFlags ?? {}).some(Boolean);
  const safetyStop = hasRedFlags || plan?.safetyMessage?.includes("红旗") === true;
  const recoveryScore = plan?.decision?.readinessScore ?? (
    hasRecordedStatus && typeof energy === "number" && typeof lowBackPain === "number"
      ? Math.max(
          30,
          Math.min(96, 72 + energy * 5 - lowBackPain * 4 + Math.min(8, Math.floor((availableMinutes ?? 45) / 10)))
        )
      : null
  );
  const painRisk = typeof lowBackPain === "number" ? Math.min(100, lowBackPain * 10) : null;
  const load = plan && typeof availableMinutes === "number" && availableMinutes > 0
    ? Math.min(100, Math.round((plan.estimatedMinutes / availableMinutes) * 100))
    : null;

  return (
    <section className="today-overview-card card">
      <div className="today-hero-head">
        <div>
          <p className="eyebrow">今日</p>
          <h2>{safetyStop ? "今天先停训" : plan ? "可以练，别硬扛" : "先看状态，再定任务"}</h2>
        </div>
        <span className="date-pill">{formatDisplayDate(date)}</span>
      </div>

      <div className="readiness-panel">
        <div
          className="readiness-ring"
          style={{ "--score": `${recoveryScore ?? 0}%` } as CSSProperties & Record<"--score", string>}
        >
          <strong>{recoveryScore !== null ? recoveryScore : "--"}</strong>
          <span>{recoveryScore !== null ? "恢复度" : "还没记录"}</span>
        </div>
        <div className="readiness-copy">
          <p className="eyebrow">今日判断</p>
          <h3>{plan ? describeTodayDecision(plan) : "等待生成"}</h3>
          <p>
            {safetyStop
              ? plan?.safetyMessage ?? "出现红旗症状，今天先暂停训练并考虑就医评估。"
              : plan?.reason ?? "填写腰酸、精神和可训练时间后，生成今天的保守训练任务。"}
          </p>
          <button type="button" className="primary-button" disabled={!plan} onClick={onViewTask}>
            {plan ? "查看任务" : "先生成任务"}
          </button>
        </div>
      </div>

      <div className="signal-grid">
        <SignalTile label="恢复" value={recoveryScore !== null ? `${recoveryScore}%` : "未记录"} tone="good" />
        <SignalTile label="训练压力" value={load !== null ? `${load}%` : "未记录"} tone="warn" />
        <SignalTile label="腰酸" value={typeof lowBackPain === "number" ? `${lowBackPain}/10` : "未记录"} />
      </div>

      <div className="body-signal-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">今日状态</p>
            <h3>三项决定强度</h3>
          </div>
          <span className="date-pill">{!hasRecordedStatus ? "待记录" : safetyStop ? "有红旗" : "无红旗"}</span>
        </div>
        <SignalBar label="睡眠与精神" value={typeof energy === "number" ? Math.min(100, energy * 20) : null} />
        <SignalBar label="腰酸风险" value={painRisk} />
        <SignalBar label="今日用时占比" value={load} />
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

function SignalBar({ label, value }: { label: string; value: number | null }) {
  const displayPercent = value !== null ? `${Math.round(value)}%` : "未记录";
  return (
    <div className="signal-bar">
      <div className="signal-bar-label">
        <span>{label}</span>
        <strong>{displayPercent}</strong>
      </div>
      <div className="signal-track">
        <span style={{ width: value !== null ? `${value}%` : "0%" }} />
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
