import { useState, type CSSProperties } from "react";
import type { ExerciseResult } from "../../core/types";
import type { DailyCheckinInput, PlanResponsePlan, PlanWorkout } from "../api";
import { describeEnergy, greetingForHour, shortReason } from "../format";
import { describePainChange } from "../pain-feedback";
import { weekDays, type WeekSummary } from "../week";
import { AiCoachCard } from "./AiCoachCard";
import { StatusForm } from "./StatusForm";
import { TodayPlan } from "./TodayPlan";
import { Icon } from "./ui";

interface TodayViewProps {
  date: string;
  plan: PlanResponsePlan | null;
  loading: boolean;
  finishing: boolean;
  error: string | null;
  info: string | null;
  mode: "overview" | "task";
  latestStatus: DailyCheckinInput | null;
  /** From the training profile: the minutes offered first on the status form. */
  defaultMinutes?: number;
  week: WeekSummary | null;
  onModeChange: (mode: "overview" | "task") => void;
  /** Resolves to false when saving failed. */
  onSubmitStatus: (status: DailyCheckinInput) => Promise<boolean | void> | boolean | void;
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
  defaultMinutes,
  week,
  onModeChange,
  onSubmitStatus,
  onFinishWorkout,
  onPlanChange,
  onOpenSettings,
  onOpenRecords
}: TodayViewProps) {
  const messages = (
    <>
      {error && <p className="error-text" role="alert">{error}</p>}
      {info && <p className="success-text" role="status">{info}</p>}
    </>
  );

  if (mode === "task") {
    return (
      <section className="stack today-task-view">
        {info && <p className="success-text" role="status">{info}</p>}
        <TodayPlan
          plan={plan}
          latestStatus={latestStatus}
          finishing={finishing}
          finishError={error}
          onBack={() => onModeChange("overview")}
          onFinishWorkout={onFinishWorkout}
          onPlanChange={onPlanChange}
        />
      </section>
    );
  }

  const statusPanel = (
    <StatusPanel
      date={date}
      loading={loading}
      latestStatus={latestStatus}
      defaultMinutes={defaultMinutes}
      onSubmit={onSubmitStatus}
    />
  );

  if (hasSafetyStop(latestStatus, plan)) {
    return (
      <section className="stack">
        {messages}
        <SafetyStopCard latestStatus={latestStatus} message={plan?.safetyMessage} />
        {statusPanel}
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="stack">
        {messages}
        <header className="today-greeting">
          <h2>{greetingForHour(new Date().getHours())}</h2>
          <p>花 20 秒记一下状态，马上给你今天的训练。</p>
        </header>
        <StatusForm
          date={date}
          loading={loading}
          initialStatus={latestStatus}
          defaultMinutes={defaultMinutes}
          onSubmit={onSubmitStatus}
        />
      </section>
    );
  }

  const workout = plan.workout ?? null;
  return (
    <section className="stack">
      {messages}
      {workout ? (
        <DoneHero plan={plan} workout={workout} latestStatus={latestStatus} onReview={() => onModeChange("task")} onOpenRecords={onOpenRecords} />
      ) : (
        <PlanHero plan={plan} onStart={() => onModeChange("task")} />
      )}
      {statusPanel}
      <WeekCard week={week} today={date} />
      {!workout && <AiCoachCard plan={plan} onOpenSettings={onOpenSettings} />}
    </section>
  );
}

function PlanHero({ plan, onStart }: { plan: PlanResponsePlan; onStart: () => void }) {
  const tone = plan.type === "full" ? "good" : "warn";
  const pill = plan.type === "full" ? "可以练" : plan.type === "reduced" ? "降一档" : "恢复日";
  const typeLabel = plan.type === "full" ? "完整训练" : plan.type === "reduced" ? "降级训练" : "低强度";
  const hasScore = plan.algorithmVersion !== "legacy-v1";
  const score = plan.decision.readinessScore;
  const meta = [
    plan.estimatedMinutes > 0 ? `${plan.estimatedMinutes} 分钟` : null,
    `${plan.exercises.length} 个动作`,
    typeLabel
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="card-solid plan-hero">
      <div className="plan-hero-top">
        <span className="muted-text">今日判断</span>
        <span className={`status-pill ${tone}`}>{pill}</span>
      </div>

      <div className="plan-hero-main">
        <div>
          <h2>{plan.decision.focusLabel}</h2>
          <p className="meta">{meta}</p>
        </div>
        {hasScore && (
          <div
            className={`score-ring ${tone}`}
            style={{ "--p": score } as CSSProperties}
            role="img"
            aria-label={`状态分 ${score}`}
          >
            <b>{score}</b>
            <span>状态分</span>
          </div>
        )}
      </div>

      <p className="plan-reason">{shortReason(plan.reason)}</p>

      <details className="why-panel">
        <summary>为什么是这套</summary>
        <ul>
          {plan.decision.reasons.slice(0, 4).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {plan.decision.avoidedReasons.length > 0 && (
          <p className="muted small">已主动避开：{plan.decision.avoidedReasons.join("；")}</p>
        )}
      </details>

      <button type="button" className="wide" onClick={onStart}>
        开始训练
      </button>
    </section>
  );
}

function DoneHero({
  plan,
  workout,
  latestStatus,
  onReview,
  onOpenRecords
}: {
  plan: PlanResponsePlan;
  workout: PlanWorkout;
  latestStatus: DailyCheckinInput | null;
  onReview: () => void;
  onOpenRecords?: () => void;
}) {
  const before = latestStatus?.lowBackPain;
  const after = workout.lowBackPainAfter;
  const knowsBoth = typeof before === "number" && typeof after === "number";
  const change = knowsBoth ? after - before : 0;
  const completed = (workout.exerciseResults ?? []).filter((result) => result.completionStatus === "completed").length;
  const headline =
    workout.completionStatus === "completed"
      ? "今天练完了"
      : workout.completionStatus === "partial"
        ? "今天练了一部分"
        : "今天先跳过了训练";

  return (
    <section className="card-solid done-hero">
      <span className={workout.completionStatus === "completed" ? "done-check" : "done-check partial"} aria-hidden="true">
        {workout.completionStatus === "completed" ? <Icon name="check" size={30} /> : "–"}
      </span>
      <div>
        <h2>{headline}</h2>
        <p className="meta">
          {completed}/{plan.exercises.length} 个动作
          {plan.estimatedMinutes > 0 ? ` · 约 ${plan.estimatedMinutes} 分钟` : ""}
        </p>
      </div>

      {typeof after === "number" && (
        <div className="pain-compare">
          {typeof before === "number" && (
            <>
              <div>
                练前不适<b>{before}</b>
              </div>
              <Icon name="right" size={18} />
            </>
          )}
          <div>
            练后<b>{after}</b>
          </div>
          {knowsBoth && <em className={change >= 2 ? "warn" : "good"}>{change >= 2 ? `高了 ${change} 分` : "没有加重"}</em>}
        </div>
      )}

      <p className="completed-note">
        {knowsBoth ? describePainChange(before, after) : "明天会按明天的状态重新判断训练安排。"}
      </p>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={onReview}>
          回顾今日动作
        </button>
        {onOpenRecords && (
          <button type="button" onClick={onOpenRecords}>
            看打卡与历史
          </button>
        )}
      </div>
    </section>
  );
}

function StatusPanel({
  date,
  loading,
  latestStatus,
  defaultMinutes,
  onSubmit
}: {
  date: string;
  loading: boolean;
  latestStatus: DailyCheckinInput | null;
  defaultMinutes?: number;
  onSubmit: (status: DailyCheckinInput) => unknown;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StatusForm
        date={date}
        loading={loading}
        initialStatus={latestStatus}
        defaultMinutes={defaultMinutes}
        title="更新今日状态"
        submitLabel="更新状态并重新判断"
        onCancel={() => setEditing(false)}
        onSubmit={async (status) => {
          const saved = await onSubmit(status);
          if (saved !== false) setEditing(false);
        }}
      />
    );
  }

  const flagged = Object.values(latestStatus?.redFlags ?? {}).some(Boolean);
  return (
    <section className="card-solid today-status">
      <div className="card-head-row">
        <span className="label">今日状态</span>
        <button type="button" className="text-button" onClick={() => setEditing(true)}>
          更新或上报不适
        </button>
      </div>
      {latestStatus ? (
        <div className="pill-row">
          <span>不适 {latestStatus.lowBackPain}/10</span>
          <span>精神 {describeEnergy(latestStatus.energy)}</span>
          <span>{latestStatus.availableMinutes} 分钟</span>
          <span className={flagged ? "bad" : "ok"}>{flagged ? "有危险信号" : "无危险信号"}</span>
        </div>
      ) : (
        <p className="muted">今天还没有记录。</p>
      )}
    </section>
  );
}

function WeekCard({ week, today }: { week: WeekSummary | null; today: string }) {
  if (!week) return null;
  const trained = new Set(week.trainedDates);

  return (
    <section className="card-solid week-card">
      <div className="card-head-row">
        <span className="label">本周</span>
        <b>
          已练 {week.mainCount} 次 · 最多 {week.limit} 次
        </b>
      </div>
      <div className="week-days">
        {weekDays(week.weekStart).map((day) => (
          <span
            key={day.date}
            className={["week-day", trained.has(day.date) ? "done" : "", day.date === today ? "today" : ""].filter(Boolean).join(" ")}
            aria-label={`周${day.label}${trained.has(day.date) ? "，练过" : ""}${day.date === today ? "，今天" : ""}`}
          >
            <i>{trained.has(day.date) && <Icon name="check" size={16} />}</i>
            {day.label}
          </span>
        ))}
      </div>
    </section>
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
  const displayMessage =
    activeFlags.length > 0
      ? "你记录了危险信号，今天不提供任何可执行训练。"
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
