import { useEffect, useMemo, useState } from "react";
import type { PlanResponsePlan } from "../api";

interface TodayPlanProps {
  plan: PlanResponsePlan | null;
  finishing: boolean;
  onFinishWorkout: () => Promise<void> | void;
}

export function TodayPlan({ plan, finishing, onFinishWorkout }: TodayPlanProps) {
  const [completedExerciseIds, setCompletedExerciseIds] = useState<string[]>([]);

  useEffect(() => {
    setCompletedExerciseIds([]);
  }, [plan?.id]);

  const completedCount = useMemo(() => completedExerciseIds.length, [completedExerciseIds]);

  if (!plan) {
    return (
      <section className="plan-card card">
        <p className="eyebrow">今日任务</p>
        <h2>还没有生成计划</h2>
        <p>先填状态，再点“生成今天任务”。</p>
      </section>
    );
  }

  return (
    <section className="plan-card card">
      <div className="plan-head">
        <div>
          <p className="eyebrow">今日任务</p>
          <h2>{describePlanType(plan.type)}</h2>
        </div>
        <span className="date-pill">{plan.timeVersion}</span>
      </div>

      <p className="reason-text">{plan.reason}</p>

      <div className="progress-pill">
        已完成 {completedCount}/{plan.exercises.length} 个动作
      </div>

      <div className="exercise-stack">
        {plan.exercises.map((exercise) => {
          const done = completedExerciseIds.includes(exercise.exerciseId);

          return (
            <article className={done ? "exercise-card done" : "exercise-card"} key={exercise.exerciseId}>
              <div className="exercise-head">
                <div>
                  <h3>{exercise.name}</h3>
                  <p className="muted">
                    {formatVolume(exercise)} · 休息 {exercise.restSeconds} 秒
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setCompletedExerciseIds((current) =>
                      current.includes(exercise.exerciseId)
                        ? current.filter((id) => id !== exercise.exerciseId)
                        : [...current, exercise.exerciseId]
                    )
                  }
                >
                  {done ? "已完成" : "完成"}
                </button>
              </div>

              <ul className="note-list">
                {exercise.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>

              <div className="detail-grid">
                <div>
                  <span className="detail-label">替代动作</span>
                  <p>{exercise.replacementId ?? "无"}</p>
                </div>
                <div>
                  <span className="detail-label">停止条件</span>
                  <p>{exercise.stopCondition}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button type="button" disabled={finishing || completedCount === 0} onClick={onFinishWorkout}>
        {finishing ? "提交中" : "完成训练"}
      </button>
    </section>
  );
}

function describePlanType(type: PlanResponsePlan["type"]): string {
  if (type === "full") return "完整训练";
  if (type === "reduced") return "降级训练";
  return "恢复日";
}

function formatVolume(exercise: PlanResponsePlan["exercises"][number]): string {
  if (typeof exercise.seconds === "number") {
    return `${exercise.sets} 组 × ${exercise.seconds} 秒`;
  }

  if (typeof exercise.reps === "number") {
    return `${exercise.sets} 组 × ${exercise.reps} 次`;
  }

  return `${exercise.sets} 组`;
}
