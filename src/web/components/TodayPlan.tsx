import { useEffect, useRef, useState } from "react";
import type {
  ExerciseCompletionStatus,
  ExerciseFeedback,
  ExerciseResult
} from "../../core/types";
import { exerciseLibrary } from "../../core/exercise-library";
import { shortReason } from "../format";
import { describePainChange } from "../pain-feedback";
import {
  describeApiError,
  generateDailyExplanation,
  replacePlanExercise,
  revertPlanExercise,
  type DailyCheckinInput,
  type PlanResponsePlan
} from "../api";
import { exerciseFeedbackKey, getOfflineAccount } from "../offline";
import { Icon, PainScale, Segmented } from "./ui";

const exerciseById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise]));
const exerciseNameById = new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise.name]));
const feedbackLabels: Record<ExerciseFeedback, string> = {
  none: "无特殊反馈",
  time: "时间不足",
  fatigue: "疲劳明显",
  pain: "出现不适",
  technique: "动作控制困难"
};
const STATUS_OPTIONS: ReadonlyArray<{ value: ExerciseCompletionStatus; label: string }> = [
  { value: "completed", label: "完整完成" },
  { value: "partial", label: "部分完成" },
  { value: "skipped", label: "跳过" }
];

interface TodayPlanProps {
  plan: PlanResponsePlan | null;
  latestStatus?: DailyCheckinInput | null;
  finishing: boolean;
  /** Shown above the save button: that is where the person is when saving fails. */
  finishError?: string | null;
  onBack?: () => void;
  onFinishWorkout: (lowBackPainAfter: number, exerciseResults: ExerciseResult[]) => Promise<void> | void;
  onPlanChange?: (plan: PlanResponsePlan) => void;
}

type LocalExerciseResult = ExerciseResult | null;

const DEFAULT_STOP_RULE = "训练中腰酸升高 2 分、动作变形、出现麻木或放射痛时立即停止。";

export function TodayPlan({ plan, latestStatus, finishing, finishError, onBack, onFinishWorkout, onPlanChange }: TodayPlanProps) {
  // Before the workout; unknown when today's check-in has not been loaded.
  const preWorkoutPain = typeof latestStatus?.lowBackPain === "number" ? latestStatus.lowBackPain : null;
  const [exerciseResults, setExerciseResults] = useState<LocalExerciseResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  // null until the person picks a number: there is no default that could be saved by accident.
  const [lowBackPainAfter, setLowBackPainAfter] = useState<number | null>(null);
  // Which exercise is open: null follows the first one still to do, "none" folds them all, a number is the person's pick.
  const [expanded, setExpanded] = useState<number | "none" | null>(null);
  const exerciseSignature = plan?.exercises
    .map((exercise) =>
      [exercise.exerciseId, exercise.sets, exercise.reps ?? "", exercise.seconds ?? "", exercise.restSeconds].join(":")
    )
    .join("|") ?? "";
  // The exercise being worked on is the first one with no result yet (done, partial and skipped all count as recorded).
  const currentActiveIndex = plan ? plan.exercises.findIndex((_, i) => !exerciseResults[i]) : -1;

  useEffect(() => {
    setAiExplanation(null);
    setAiNote(null);
    setAiError(null);
    setPlanError(null);
    setExpanded(null);
    if (!plan) {
      setLowBackPainAfter(null);
      setExerciseResults([]);
      return;
    }

    // A saved workout on the server wins over whatever this browser remembers (another device, cleared data).
    const savedWorkout = plan.workout ?? null;
    setLowBackPainAfter(typeof savedWorkout?.lowBackPainAfter === "number" ? savedWorkout.lowBackPainAfter : null);
    const saved = savedWorkout?.exerciseResults?.length
      ? savedWorkout.exerciseResults
      : readSavedExerciseResults(plan.id, exerciseSignature);
    setExerciseResults(
      plan.exercises.map((exercise, index) =>
        saved.find(
          (result) => result.exerciseIndex === index && result.exerciseId === exercise.exerciseId
        ) ?? null
      )
    );
  }, [plan?.id, exerciseSignature]);

  // When the next exercise opens, bring it to the top. Opening the page itself stays where it is.
  const lastCurrent = useRef<string | null>(null);
  useEffect(() => {
    if (!plan || currentActiveIndex < 0) return;
    const key = `${plan.id}:${currentActiveIndex}`;
    const isFirst = lastCurrent.current === null;
    lastCurrent.current = key;
    if (isFirst) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`exercise-${currentActiveIndex}`)
      ?.scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [plan?.id, currentActiveIndex]);

  if (!plan) {
    return (
      <section className="card-solid">
        {onBack && <BackButton onBack={onBack} />}
        <h2>还没有生成训练</h2>
        <p className="muted">先在“今日”记录状态，再生成今天的训练。</p>
      </section>
    );
  }

  const activePlan = plan;
  const total = plan.exercises.length;
  const resolvedCount = exerciseResults.filter(Boolean).length;
  const allResolved = total > 0 && resolvedCount === total;
  const openIndex = expanded === null ? currentActiveIndex : expanded === "none" ? -1 : expanded;
  const minutesLabel = plan.algorithmVersion === "legacy-v1" ? "历史计划" : `约 ${plan.estimatedMinutes} 分钟`;

  return (
    <div className="stack train-view">
      {onBack && <BackButton onBack={onBack} />}

      <section className="card-solid train-brief">
        <div>
          <h2>{describePlanFocus(plan)}</h2>
          <p className="meta">{[describeTimeVersion(plan.timeVersion), minutesLabel, `${total} 个动作`].join(" · ")}</p>
        </div>

        {total > 0 && (
          <>
            <div className="progress-line">
              <div
                className="progress-bar"
                role="progressbar"
                aria-label="已记录的动作"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={resolvedCount}
              >
                <span style={{ width: `${(resolvedCount / total) * 100}%` }} />
              </div>
              <b>
                已记录 {resolvedCount}/{total}
              </b>
            </div>

            {/* The rule comes from the plan itself so the screen can never say something looser than the plan. */}
            <p className="stop-rule" role="note">
              <Icon name="alert" size={20} />
              <span>{plan.safetyMessage ?? DEFAULT_STOP_RULE}</span>
            </p>
          </>
        )}

        <details className="why-panel">
          <summary>为什么这样安排</summary>
          <p className="why-lead">{shortReason(plan.explanation?.summary ?? plan.reason)}</p>
          <ul>
            {plan.decision.reasons.slice(0, 4).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {plan.decision.avoidedReasons.length > 0 && (
            <p className="muted small">已主动避开：{plan.decision.avoidedReasons.join("；")}</p>
          )}
          <div className="why-ai">
            {aiExplanation && <p className="ai-copy">{aiExplanation}</p>}
            {aiNote && <p className="muted small">{aiNote}</p>}
            {aiError && <p className="error-text small">{aiError}</p>}
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={aiLoading}
              onClick={() => void handleAiExplanation(plan.id)}
            >
              {aiLoading ? "生成中" : aiExplanation ? "重新讲一次" : "让 AI 讲讲"}
            </button>
          </div>
        </details>
      </section>

      {planError && <p className="error-text" role="alert">{planError}</p>}

      {total === 0 ? (
        <section className="safety-stop-card compact-safety-card" role="alert">
          <p className="eyebrow">当前没有可执行动作</p>
          <h3>今天先停训</h3>
          <p>{plan.safetyMessage ?? "先处理安全信号，再决定是否训练。"}</p>
        </section>
      ) : (
        <div className="ex-list">
          {plan.exercises.map((exercise, index) => {
            const exerciseKey = getExerciseInstanceKey(plan.id, index, exercise);
            const result = exerciseResults[index];
            const status = result?.completionStatus;
            const isCurrent = index === currentActiveIndex;
            const isOpen = index === openIndex;
            const cardClasses = ["ex-card", status ?? "", isCurrent ? "current" : "", isOpen ? "open" : ""]
              .filter(Boolean)
              .join(" ");

            return (
              <article className={cardClasses} key={exerciseKey} id={`exercise-${index}`}>
                <button
                  type="button"
                  className="ex-head"
                  aria-expanded={isOpen}
                  aria-controls={`exercise-body-${index}`}
                  onClick={() => setExpanded(isOpen ? "none" : index)}
                >
                  <span className="ex-index" aria-hidden="true">
                    {status === "completed" ? (
                      <Icon name="check" size={16} />
                    ) : status === "skipped" ? (
                      <Icon name="close" size={14} />
                    ) : status === "partial" ? (
                      "–"
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="ex-title">
                    <b>{exercise.name}</b>
                    <small>
                      {formatVolume(exercise)} · 休息 {formatRest(exercise.restSeconds)}
                    </small>
                  </span>
                  <span className="ex-state">
                    {status ? statusLabel(status) : isCurrent ? "进行中" : ""}
                    <Icon name="right" size={16} />
                  </span>
                </button>

                {isOpen && (
                  <div className="ex-body" id={`exercise-body-${index}`}>
                    {exercise.notes.length > 0 && (
                      <ul className="ex-notes">
                        {exercise.notes.map((note, noteIndex) => (
                          <li key={`${exerciseKey}-note-${noteIndex}`}>{note}</li>
                        ))}
                      </ul>
                    )}

                    <div className="ex-facts">
                      <div>
                        <span>停止条件</span>
                        <p>{exercise.stopCondition}</p>
                      </div>
                      <div>
                        <span>替代动作</span>
                        <p>{formatReplacement(exercise.replacementId)}</p>
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
                      <div>
                        <span>为什么选它</span>
                        <p>{exercise.selectionReason ?? "按当天训练槽位和安全条件选择"}</p>
                      </div>
                    </div>

                    <a
                      className="ex-video"
                      href={exercise.videoUrl ?? exerciseById.get(exercise.exerciseId)?.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="play" size={16} />
                      查看动作视频
                    </a>
                    <p className="muted small">视频只用于理解动作；组数、次数和停止条件以姿序当天任务为准。</p>

                    {status ? (
                      <div className="ex-actions">
                        <Segmented
                          label="这个动作的完成情况"
                          options={STATUS_OPTIONS}
                          value={status}
                          onChange={(value) => updateExerciseResult(index, value)}
                        />
                        <label className="ex-feedback">
                          反馈原因
                          <select
                            value={result?.feedback ?? "none"}
                            onChange={(event) => updateExerciseFeedback(index, event.target.value as ExerciseFeedback)}
                          >
                            {Object.entries(feedbackLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="text-button" onClick={() => updateExerciseResult(index, null)}>
                          撤销这条记录
                        </button>
                      </div>
                    ) : (
                      <div className="ex-actions">
                        <button type="button" className="wide" onClick={() => updateExerciseResult(index, "completed")}>
                          完成这个动作
                        </button>
                        <div className="ex-actions-row">
                          <button type="button" className="secondary-button" onClick={() => updateExerciseResult(index, "partial")}>
                            只做了一部分
                          </button>
                          <button type="button" className="secondary-button" onClick={() => updateExerciseResult(index, "skipped")}>
                            跳过
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <section className={allResolved ? "card-solid train-finish ready" : "card-solid train-finish"}>
          <h3>练后记录</h3>
          <div className="field-head">
            <span>现在的腰背不适</span>
            <b>
              练前 {preWorkoutPain ?? "未记"} → 练后 {lowBackPainAfter ?? "待选"}
            </b>
          </div>
          <PainScale
            label="练后腰背不适，0 到 10"
            value={lowBackPainAfter}
            onChange={setLowBackPainAfter}
            before={preWorkoutPain}
          />
          <p className="muted small">
            {!allResolved
              ? `还剩 ${total - resolvedCount} 个动作需要记录；完成、部分或跳过都可以。`
              : lowBackPainAfter === null
                ? `选一个数${preWorkoutPain !== null ? `（紫圈是你练前选的 ${preWorkoutPain}）` : ""}。比练前高 2 分以上，会影响下一次的训练安排。`
                : preWorkoutPain !== null
                  ? describePainChange(preWorkoutPain, lowBackPainAfter)
                  : `已选 ${lowBackPainAfter}。`}
          </p>
          {finishError && <p className="error-text" role="alert">{finishError}</p>}
          <button
            type="button"
            className="wide"
            disabled={finishing || !allResolved || lowBackPainAfter === null}
            onClick={() =>
              lowBackPainAfter !== null &&
              void onFinishWorkout(lowBackPainAfter, exerciseResults as ExerciseResult[])
            }
          >
            {finishing
              ? "保存中"
              : !allResolved
                ? "先记录完所有动作"
                : lowBackPainAfter === null
                  ? "请选练后腰背不适再保存"
                  : "保存本次训练"}
          </button>
        </section>
      )}
    </div>
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
    // Back to following the first exercise still to do, so the next one opens by itself.
    setExpanded(null);
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
    setAiLoading(true);
    setAiError(null);
    setAiNote(null);
    try {
      const result = await generateDailyExplanation(planId);
      setAiExplanation(result.explanation ?? "");
      setAiNote(result.source === "deepseek" ? "来自 DeepSeek。" : "当前使用本地规则解释。");
    } catch (error) {
      setAiError(`AI 解释生成失败：${describeApiError(error)}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleReplace(planId: number, exerciseId: string, exerciseKey: string) {
    setActionBusyKey(exerciseKey);
    setPlanError(null);
    try {
      // The swapped exercise shows up in its place, so there is no extra banner.
      const response = await replacePlanExercise(planId, exerciseId);
      onPlanChange?.(response.plan);
    } catch (error) {
      setPlanError(`替换动作失败：${describeApiError(error)}`);
    } finally {
      setActionBusyKey(null);
    }
  }

  async function handleRevert(planId: number, exerciseId: string, exerciseKey: string) {
    setActionBusyKey(exerciseKey);
    setPlanError(null);
    try {
      const response = await revertPlanExercise(planId, exerciseId);
      onPlanChange?.(response.plan);
    } catch (error) {
      setPlanError(`撤回替换失败：${describeApiError(error)}`);
    } finally {
      setActionBusyKey(null);
    }
  }
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="text-button train-back" onClick={onBack}>
      <Icon name="left" size={16} />
      返回今日
    </button>
  );
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
    const key = exerciseStorageKey(planId);
    if (!key) return [];
    const raw = localStorage.getItem(key);
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
  const key = exerciseStorageKey(planId);
  if (!key) return;
  localStorage.setItem(
    key,
    JSON.stringify({
      signature,
      results: results.filter((result): result is ExerciseResult => result !== null)
    })
  );
}

/** Kept per account and cleared on sign-out, so the next person on this device never sees these notes. */
function exerciseStorageKey(planId: number): string | null {
  const account = getOfflineAccount();
  return account === null ? null : exerciseFeedbackKey(account, planId);
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
