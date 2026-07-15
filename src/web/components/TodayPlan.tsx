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
  onBack?: () => void;
  onFinishWorkout: () => Promise<void> | void;
  onPlanChange?: (plan: PlanResponsePlan) => void;
}

export function TodayPlan({ plan, finishing, onBack, onFinishWorkout, onPlanChange }: TodayPlanProps) {
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
        <div className="plan-topline">
          {onBack && (
            <button type="button" className="text-button" onClick={onBack}>
              返回今日
            </button>
          )}
          <span className="date-pill">任务详情</span>
        </div>
        <p className="eyebrow">今日 / 任务详情</p>
        <h2>还没有生成任务</h2>
        <p>先填状态，再点“生成今天任务”。</p>
      </section>
    );
  }

  return (
    <section className="plan-card card">
      <div className="plan-topline">
        {onBack && (
          <button type="button" className="text-button" onClick={onBack}>
            返回今日
          </button>
        )}
        <span className="date-pill">今日内页</span>
      </div>
      <div className="plan-head">
        <div>
          <p className="eyebrow">今日 / 任务详情</p>
          <h2>{describePlanFocus(plan)}</h2>
        </div>
        <span className="date-pill">{describeTimeVersion(plan.timeVersion)}</span>
      </div>

      <p className="reason-text">{plan.reason}</p>

      <section className="explanation-card task-brief-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">计划类型</p>
            <h3>{plan.explanation?.title ?? `${describePlanType(plan.type)}，守住执行`}</h3>
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

      <section className="action-list-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">动作顺序</p>
            <h3>{plan.exercises.length} 个动作</h3>
          </div>
          <span className="date-pill">已完成 {completedCount}/{plan.exercises.length}</span>
        </div>

        <div className="exercise-stack">
          {plan.exercises.map((exercise, index) => {
            const exerciseKey = getExerciseInstanceKey(plan.id, index, exercise);
            const done = completedExerciseKeys.includes(exerciseKey);

            return (
              <article className={done ? "exercise-card done" : "exercise-card"} key={exerciseKey}>
                <div className="exercise-row">
                  <span className="exercise-index">{index + 1}</span>
                  <div className="exercise-copy">
                    <h3>{exercise.name}</h3>
                    <p className="muted">{formatVolume(exercise)} · 休息 {formatRest(exercise.restSeconds)}</p>
                    {exercise.replacedFromId && (
                      <p className="muted small">已从 {formatReplacement(exercise.replacedFromId)} 替换</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() =>
                      setCompletedExerciseKeys((current) =>
                        current.includes(exerciseKey)
                          ? current.filter((key) => key !== exerciseKey)
                          : [...current, exerciseKey]
                      )
                    }
                  >
                    {done ? "已完" : "完成"}
                  </button>
                </div>

                <details className="exercise-details">
                  <summary>动作要点</summary>
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
                      <span className="detail-label">停止条件</span>
                      <p>{exercise.stopCondition}</p>
                    </div>
                  </div>

                  <div className="button-row">
                    {exercise.replacedFromId ? (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        disabled={actionBusyKey === exerciseKey}
                        onClick={() => void handleRevert(plan.id, exercise.exerciseId, exerciseKey)}
                      >
                        撤回替换
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        disabled={!exercise.replacementId || actionBusyKey === exerciseKey}
                        onClick={() => void handleReplace(plan.id, exercise.exerciseId, exerciseKey)}
                      >
                        换成替代动作
                      </button>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

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

function describePlanFocus(plan: PlanResponsePlan): string {
  if (plan.type === "recovery") return "恢复 + 稳定";
  if (plan.type === "reduced") return "轻量激活 + 核心";
  return "上背 + 核心";
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
