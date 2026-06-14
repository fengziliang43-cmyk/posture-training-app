import { useEffect, useMemo, useState } from "react";
import { exerciseLibrary } from "../../core/exercise-library";
import {
  describeApiError,
  generateDailyExplanation,
  replacePlanExercise,
  revertPlanExercise,
  type PlanResponsePlan
} from "../api";

const exerciseNameById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise.name]));

interface TodayPlanProps {
  plan: PlanResponsePlan | null;
  finishing: boolean;
  onFinishWorkout: () => Promise<void> | void;
  onPlanChange?: (plan: PlanResponsePlan) => void;
}

export function TodayPlan({ plan, finishing, onFinishWorkout, onPlanChange }: TodayPlanProps) {
  const [completedExerciseKeys, setCompletedExerciseKeys] = useState<string[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setCompletedExerciseKeys([]);
    setAiExplanation(null);
    setPlanInfo(null);
    setPlanError(null);
  }, [plan?.id]);

  const completedCount = useMemo(() => completedExerciseKeys.length, [completedExerciseKeys]);

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
        <span className="date-pill">{describeTimeVersion(plan.timeVersion)}</span>
      </div>

      <p className="reason-text">{plan.reason}</p>

      <section className="explanation-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">今日解释</p>
            <h3>{plan.explanation?.title ?? describePlanType(plan.type)}</h3>
          </div>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => void handleAiExplanation(plan.id)}
          >
            AI 解释
          </button>
        </div>
        <p>{aiExplanation ?? plan.explanation?.summary ?? plan.reason}</p>
      </section>

      {planInfo && <p className="success-text">{planInfo}</p>}
      {planError && <p className="error-text">{planError}</p>}

      <div className="progress-pill">
        已完成 {completedCount}/{plan.exercises.length} 个动作
      </div>

      <div className="exercise-stack">
        {plan.exercises.map((exercise, index) => {
          const exerciseKey = getExerciseInstanceKey(plan.id, index, exercise);
          const done = completedExerciseKeys.includes(exerciseKey);

          return (
            <article className={done ? "exercise-card done" : "exercise-card"} key={exerciseKey}>
              <div className="exercise-head">
                <div>
                  <h3>{exercise.name}</h3>
                  <p className="muted">
                    {formatVolume(exercise)} · 组间休息 {formatRest(exercise.restSeconds)}
                  </p>
                  {exercise.replacedFromId && (
                    <p className="muted small">已从 {formatReplacement(exercise.replacedFromId)} 替换</p>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setCompletedExerciseKeys((current) =>
                      current.includes(exerciseKey)
                        ? current.filter((key) => key !== exerciseKey)
                        : [...current, exerciseKey]
                    )
                  }
                >
                  {done ? "已完成" : "完成"}
                </button>
              </div>

              <ul className="note-list">
                {exercise.notes.map((note, noteIndex) => (
                  <li key={`${exerciseKey}-note-${noteIndex}`}>{note}</li>
                ))}
              </ul>

              <div className="detail-grid">
                <div>
                  <span className="detail-label">替代动作</span>
                  <p>{formatReplacement(exercise.replacementId)}</p>
                </div>
                <div>
                  <span className="detail-label">组间休息</span>
                  <p>{formatRest(exercise.restSeconds)}</p>
                </div>
                <div>
                  <span className="detail-label">停止条件</span>
                  <p>{exercise.stopCondition}</p>
                </div>
              </div>

              <div className="button-row">
                {exercise.replacedFromId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionBusyKey === exerciseKey}
                    onClick={() => void handleRevert(plan.id, exercise.exerciseId, exerciseKey)}
                  >
                    撤回替换
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!exercise.replacementId || actionBusyKey === exerciseKey}
                    onClick={() => void handleReplace(plan.id, exercise.exerciseId, exerciseKey)}
                  >
                    换成替代动作
                  </button>
                )}
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

  async function handleAiExplanation(planId: number) {
    setPlanError(null);
    setPlanInfo(null);
    try {
      const result = await generateDailyExplanation(planId);
      setAiExplanation(result.explanation ?? "");
      setPlanInfo(result.source === "deepseek" ? "AI 解释已生成。" : "当前使用本地规则解释。");
    } catch (error) {
      setPlanError(`AI 解释生成失败：${describeApiError(error)}`);
    }
  }

  async function handleReplace(planId: number, exerciseId: string, exerciseKey: string) {
    setActionBusyKey(exerciseKey);
    setPlanError(null);
    setPlanInfo(null);
    try {
      const response = await replacePlanExercise(planId, exerciseId);
      onPlanChange?.(response.plan);
      setPlanInfo("已换成替代动作。");
    } catch (error) {
      setPlanError(`替换动作失败：${describeApiError(error)}`);
    } finally {
      setActionBusyKey(null);
    }
  }

  async function handleRevert(planId: number, exerciseId: string, exerciseKey: string) {
    setActionBusyKey(exerciseKey);
    setPlanError(null);
    setPlanInfo(null);
    try {
      const response = await revertPlanExercise(planId, exerciseId);
      onPlanChange?.(response.plan);
      setPlanInfo("已撤回替换。");
    } catch (error) {
      setPlanError(`撤回替换失败：${describeApiError(error)}`);
    } finally {
      setActionBusyKey(null);
    }
  }
}

function getExerciseInstanceKey(
  planId: number,
  index: number,
  exercise: PlanResponsePlan["exercises"][number]
): string {
  return [planId, index, exercise.exerciseId, exercise.replacedFromId ?? "original"].join(":");
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

function formatVolume(exercise: PlanResponsePlan["exercises"][number]): string {
  if (typeof exercise.seconds === "number") {
    return `${exercise.sets} 组 × ${exercise.seconds} 秒`;
  }

  if (typeof exercise.reps === "number") {
    return `${exercise.sets} 组 × ${exercise.reps} 次`;
  }

  return `${exercise.sets} 组`;
}

function formatRest(seconds: number): string {
  if (seconds <= 0) {
    return "不需要固定休息";
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} 分钟`;
  }

  return `${seconds} 秒`;
}

function formatReplacement(replacementId?: string): string {
  if (!replacementId) {
    return "无";
  }

  return exerciseNameById.get(replacementId) ?? replacementId;
}
