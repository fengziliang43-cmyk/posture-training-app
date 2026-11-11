import { useEffect, useState } from "react";
import type {
  ExerciseCompletionStatus,
  ExerciseFeedback,
  ExerciseResult
} from "../../core/types";
import { exerciseLibrary } from "../../core/exercise-library";
import {
  describeApiError,
  generateDailyExplanation,
  replacePlanExercise,
  revertPlanExercise,
  type DailyCheckinInput,
  type PlanResponsePlan
} from "../api";

const exerciseById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise]));
const exerciseNameById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise.name]));
const feedbackLabels: Record<ExerciseFeedback, string> = {
  none: "无特殊反馈",
  time: "时间不足",
  fatigue: "疲劳明显",
  pain: "出现不适",
  technique: "动作控制困难"
};

interface TodayPlanProps {
  plan: PlanResponsePlan | null;
  latestStatus?: DailyCheckinInput | null;
  finishing: boolean;
  onBack?: () => void;
  onFinishWorkout: (lowBackPainAfter: number, exerciseResults: ExerciseResult[]) => Promise<void> | void;
  onPlanChange?: (plan: PlanResponsePlan) => void;
}

type LocalExerciseResult = ExerciseResult | null;

export function TodayPlan({ plan, latestStatus, finishing, onBack, onFinishWorkout, onPlanChange }: TodayPlanProps) {
  const preWorkoutPain = latestStatus?.lowBackPain ?? 2;
  const [exerciseResults, setExerciseResults] = useState<LocalExerciseResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [lowBackPainAfter, setLowBackPainAfter] = useState<number>(preWorkoutPain);
  const [painConfirmed, setPainConfirmed] = useState(false);
  const exerciseSignature = plan?.exercises
    .map((exercise) =>
      [exercise.exerciseId, exercise.sets, exercise.reps ?? "", exercise.seconds ?? "", exercise.restSeconds].join(":")
    )
    .join("|") ?? "";

  useEffect(() => {
    setAiExplanation(null);
    setPlanInfo(null);
    setPlanError(null);
    setLowBackPainAfter(preWorkoutPain);
    setPainConfirmed(false);
    if (!plan) {
      setExerciseResults([]);
      return;
    }

    const saved = readSavedExerciseResults(plan.id, exerciseSignature);
    setExerciseResults(
      plan.exercises.map((exercise, index) =>
        saved.find(
          (result) => result.exerciseIndex === index && result.exerciseId === exercise.exerciseId
        ) ?? null
      )
    );
  }, [plan?.id, exerciseSignature]);

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

  const activePlan = plan;

  const resolvedCount = exerciseResults.filter(Boolean).length;
  const completedCount = exerciseResults.filter(
    (result) => result?.completionStatus === "completed"
  ).length;
  const allResolved = plan.exercises.length > 0 && resolvedCount === plan.exercises.length;

  return (
    <section className="plan-card card">
      <div className="plan-topline">
        {onBack && (
          <button type="button" className="text-button" onClick={onBack}>
            返回今日
          </button>
        )}
        <span className="date-pill">自适应计划</span>
      </div>
      <div className="plan-head">
        <div>
          <p className="eyebrow">今日 / 任务详情</p>
          <h2>{describePlanFocus(plan)}</h2>
        </div>
        <div className="plan-head-pills">
          <span className="date-pill">{describeTimeVersion(plan.timeVersion)}</span>
          <span className="date-pill">
            {plan.algorithmVersion === "legacy-v1" ? "历史计划" : `约 ${plan.estimatedMinutes} 分钟`}
          </span>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: "rgba(253, 240, 217, 0.95)",
          borderLeft: "4px solid #e0932c",
          padding: "10px 14px",
          margin: "12px 0 6px"
        }}
        role="alert"
      >
        <strong style={{ color: "#754700", fontSize: "14px", display: "block" }}>停止规则（全过程有效）</strong>
        <p style={{ margin: "3px 0 0", color: "#754700", fontSize: "13px", lineHeight: "1.5" }}>
          出现麻木、放射痛，动作严重变形，或腰背不适比练前上升 2 分以上：<b>立即停训</b>。
        </p>
      </div>

      <p className="reason-text">{plan.reason}</p>

      <section className="decision-summary-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">为什么是这套</p>
            <h3>{plan.decision.focusLabel}</h3>
          </div>
          <span className="readiness-badge">
            {plan.algorithmVersion === "legacy-v1" ? "历史" : `${plan.decision.readinessScore}/100`}
          </span>
        </div>
        <ul className="decision-reason-list">
          {plan.decision.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        {plan.decision.avoidedReasons.length > 0 && (
          <p className="muted small">已主动避开：{plan.decision.avoidedReasons.join("；")}</p>
        )}
      </section>

      <section className="explanation-card task-brief-card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">计划解释</p>
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

      {plan.exercises.length === 0 ? (
        <section className="safety-stop-card compact-safety-card" role="alert">
          <p className="eyebrow">当前没有可执行动作</p>
          <h3>今天先停训</h3>
          <p>{plan.safetyMessage ?? "先处理安全信号，再决定是否训练。"}</p>
        </section>
      ) : (
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
              const result = exerciseResults[index];
              const status = result?.completionStatus;

              return (
                <article className={status ? `exercise-card ${status}` : "exercise-card"} key={exerciseKey}>
                  <div className="exercise-row">
                    <span className="exercise-index">{index + 1}</span>
                    <div className="exercise-copy">
                      <h3>{exercise.name}</h3>
                      <p className="muted">
                        {formatVolume(exercise)} · 休息 {formatRest(exercise.restSeconds)}
                      </p>
                      <span className="exercise-status-label">{statusLabel(status)}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => updateExerciseResult(index, status === "completed" ? null : "completed")}
                    >
                      {status === "completed" ? "撤销" : "完成"}
                    </button>
                  </div>

                  <p className="exercise-selection-reason">
                    <span>选择原因</span>{exercise.selectionReason ?? "按当天训练槽位和安全条件选择"}
                  </p>

                  <details className="exercise-details">
                    <summary>动作要点与反馈</summary>
                    <a
                      className="exercise-video-link"
                      href={exercise.videoUrl ?? exerciseById.get(exercise.exerciseId)?.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看动作视频
                    </a>
                    <p className="muted small video-boundary-note">
                      视频只用于理解动作；组数、次数和停止条件以姿序当天任务为准。
                    </p>
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

                    <label className="exercise-feedback-field">
                      <span>完成情况</span>
                      <select
                        value={status ?? ""}
                        onChange={(event) =>
                          updateExerciseResult(
                            index,
                            event.target.value as ExerciseCompletionStatus | ""
                          )
                        }
                      >
                        <option value="">请选择</option>
                        <option value="completed">完整完成</option>
                        <option value="partial">部分完成</option>
                        <option value="skipped">跳过</option>
                      </select>
                    </label>
                    {result && (
                      <label className="exercise-feedback-field">
                        <span>反馈原因</span>
                        <select
                          value={result.feedback}
                          onChange={(event) =>
                            updateExerciseFeedback(index, event.target.value as ExerciseFeedback)
                          }
                        >
                          {Object.entries(feedbackLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    )}

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
      )}

      {plan.exercises.length > 0 && (
        <section className={allResolved ? "finish-card ready" : "finish-card"}>
          <div className="mini-head">
            <div>
              <p className="eyebrow">训练后反馈</p>
              <h3>记录现在的腰酸</h3>
            </div>
            <span className="date-pill">练前 {preWorkoutPain} / 10 → 练后 {lowBackPainAfter} / 10</span>
          </div>
          <label className="slider-field">
            <span className="slider-label"><span>无不适</span><span>明显疼痛</span></span>
            <input
              type="range"
              min="0"
              max="10"
              value={lowBackPainAfter}
              onChange={(event) => {
                setLowBackPainAfter(Number(event.target.value));
                setPainConfirmed(true);
              }}
            />
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "6px 0 10px" }}>
            <button
              type="button"
              className={painConfirmed && lowBackPainAfter === preWorkoutPain ? "secondary-button active-chip" : "secondary-button"}
              onClick={() => {
                setLowBackPainAfter(preWorkoutPain);
                setPainConfirmed(true);
              }}
            >
              和练前一样（{preWorkoutPain}）
            </button>
            <button
              type="button"
              className={painConfirmed && lowBackPainAfter < preWorkoutPain ? "secondary-button active-chip" : "secondary-button"}
              onClick={() => {
                setLowBackPainAfter(Math.max(0, preWorkoutPain - 1));
                setPainConfirmed(true);
              }}
            >
              感觉有所减轻（{Math.max(0, preWorkoutPain - 1)}）
            </button>
            <button
              type="button"
              className={painConfirmed && lowBackPainAfter > preWorkoutPain ? "secondary-button active-chip" : "secondary-button"}
              onClick={() => {
                setLowBackPainAfter(Math.min(10, preWorkoutPain + 1));
                setPainConfirmed(true);
              }}
            >
              略有加重（{Math.min(10, preWorkoutPain + 1)}）
            </button>
          </div>
          <p className="muted small">
            {allResolved
              ? painConfirmed
                ? "腰背感受已确认，可以保存本次训练。"
                : "请滑动或点击上方选项确认练后感受，比练前高 2 分以上下次会自动降一档。"
              : `还剩 ${plan.exercises.length - resolvedCount} 个动作需要记录；完成、部分或跳过都可以。`}
          </p>
          <button
            type="button"
            disabled={finishing || !allResolved || !painConfirmed}
            onClick={() => void onFinishWorkout(lowBackPainAfter, exerciseResults as ExerciseResult[])}
          >
            {finishing
              ? "保存中"
              : !painConfirmed
                ? "请确认练后腰酸再保存"
                : "保存本次训练反馈"}
          </button>
        </section>
      )}
    </section>
  );

  function updateExerciseResult(
    index: number,
    completionStatus: ExerciseCompletionStatus | "" | null
  ) {
    setExerciseResults((current) => {
      const next = [...current];
      if (!completionStatus) {
        next[index] = null;
      } else {
        next[index] = {
          exerciseId: activePlan.exercises[index].exerciseId,
          exerciseIndex: index,
          completionStatus,
          feedback: current[index]?.feedback ?? "none"
        };
      }
      saveExerciseResults(activePlan.id, exerciseSignature, next);
      return next;
    });
  }

  function updateExerciseFeedback(index: number, feedback: ExerciseFeedback) {
    setExerciseResults((current) => {
      const existing = current[index];
      if (!existing) return current;
      const next = [...current];
      next[index] = { ...existing, feedback };
      saveExerciseResults(activePlan.id, exerciseSignature, next);
      return next;
    });
  }

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
      setPlanInfo("已换成当天安全范围内的替代动作。");
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

function readSavedExerciseResults(planId: number, signature: string): ExerciseResult[] {
  try {
    const raw = localStorage.getItem(exerciseStorageKey(planId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as
      | ExerciseResult[]
      | { signature?: string; results?: ExerciseResult[] };
    if (Array.isArray(parsed)) return parsed;
    return parsed.signature === signature && Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

function saveExerciseResults(
  planId: number,
  signature: string,
  results: LocalExerciseResult[]
): void {
  localStorage.setItem(
    exerciseStorageKey(planId),
    JSON.stringify({
      signature,
      results: results.filter((result): result is ExerciseResult => result !== null)
    })
  );
}

function exerciseStorageKey(planId: number): string {
  return `posture-training.exercise-feedback.${planId}`;
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
  return plan.decision.focusLabel || (plan.type === "recovery" ? "恢复 + 稳定" : "自适应训练");
}

function formatVolume(exercise: PlanResponsePlan["exercises"][number]): string {
  if (typeof exercise.seconds === "number") {
    if (exercise.seconds >= 60 && exercise.seconds % 60 === 0) {
      return `${exercise.sets} 组 × ${exercise.seconds / 60} 分钟`;
    }
    if (exercise.seconds >= 120) {
      return `${exercise.sets} 组 × 约 ${Math.round(exercise.seconds / 60)} 分钟`;
    }
    return `${exercise.sets} 组 × ${exercise.seconds} 秒`;
  }

  if (typeof exercise.reps === "number") {
    return `${exercise.sets} 组 × ${exercise.reps} 次`;
  }

  return `${exercise.sets} 组`;
}

function formatRest(seconds: number): string {
  if (seconds <= 0) return "不需要固定休息";
  if (seconds % 60 === 0) return `${seconds / 60} 分钟`;
  return `${seconds} 秒`;
}

function formatReplacement(replacementId?: string): string {
  if (!replacementId) return "无";
  return exerciseNameById.get(replacementId) ?? replacementId;
}

function statusLabel(status?: ExerciseCompletionStatus): string {
  if (status === "completed") return "已完成";
  if (status === "partial") return "部分完成";
  if (status === "skipped") return "已跳过";
  return "待记录";
}
