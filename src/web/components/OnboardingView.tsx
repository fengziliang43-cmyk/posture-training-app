import { useState } from "react";
import type {
  AgeRange,
  ExerciseEquipment,
  FitnessLevel,
  FunctionalLimitation,
  TrainingProfile,
  TrainingGoal
} from "../../core/types";
import { getEquipmentCompatibleExercises } from "../../core/exercise-library";
import { describeApiError, saveProfile } from "../api";

const goalOptions: Array<{ value: TrainingGoal; label: string }> = [
  { value: "safe-movement", label: "安全地恢复运动习惯" },
  { value: "posture", label: "姿势与动作控制" },
  { value: "fat-loss", label: "减脂" },
  { value: "strength", label: "增肌与力量" },
  { value: "conditioning", label: "心肺与体能" }
];

const equipmentOptions: Array<{ value: ExerciseEquipment; label: string }> = [
  { value: "bodyweight", label: "徒手" },
  { value: "floor", label: "瑜伽垫或可躺地面" },
  { value: "wall", label: "墙面" },
  { value: "walking-space", label: "可快走空间" },
  { value: "resistance-band", label: "弹力带" },
  { value: "pull-up-bar", label: "单杠" },
  { value: "step", label: "稳固台阶" }
];

const limitationOptions: Array<{ value: FunctionalLimitation; label: string }> = [
  { value: "low-back", label: "腰背容易不适" },
  { value: "shoulder", label: "肩颈或肩关节容易不适" },
  { value: "knee", label: "膝部容易不适" },
  { value: "balance", label: "平衡能力较弱" }
];

interface OnboardingFormState {
  ageRange: AgeRange;
  heightCm: string;
  weightKg: string;
  fitnessLevel: FitnessLevel;
  goals: TrainingGoal[];
  equipment: ExerciseEquipment[];
  weeklyTrainingDays: number;
  defaultSessionMinutes: number;
  canWalk20Minutes: boolean;
  canChairStand: boolean;
  canHoldSupport20Seconds: boolean;
  limitations: FunctionalLimitation[];
  baselineLowBackPain: string;
  baselineNeckShoulderPain: string;
  healthConsent: boolean;
}

const initialForm: OnboardingFormState = {
  ageRange: "18-29",
  heightCm: "",
  weightKg: "",
  fitnessLevel: "beginner",
  goals: ["safe-movement"],
  equipment: ["bodyweight", "floor", "wall", "walking-space"],
  weeklyTrainingDays: 3,
  defaultSessionMinutes: 30,
  canWalk20Minutes: true,
  canChairStand: true,
  canHoldSupport20Seconds: true,
  limitations: [],
  baselineLowBackPain: "",
  baselineNeckShoulderPain: "",
  healthConsent: false
};

export function OnboardingView({
  username,
  initialProfile,
  onCancel,
  onComplete
}: {
  username: string;
  initialProfile?: TrainingProfile;
  onCancel?: () => void;
  onComplete: (profile: TrainingProfile) => void;
}) {
  const editing = Boolean(initialProfile);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(() =>
    initialProfile ? profileToForm(initialProfile) : initialForm
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function goNext() {
    setError(null);
    if (step === 1 && (form.goals.length === 0 || form.equipment.length === 0)) {
      setError("请至少选择 1 个目标和 1 种可用条件。");
      return;
    }
    setStep((current) => Math.min(2, current + 1));
  }

  async function submitProfile() {
    if (!form.healthConsent) {
      setError("请阅读健康信息说明，并勾选单独同意后继续。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await saveProfile({
        adultConfirmed: true,
        healthConsent: true,
        ageRange: form.ageRange,
        heightCm: optionalNumber(form.heightCm),
        weightKg: optionalNumber(form.weightKg),
        fitnessLevel: form.fitnessLevel,
        goals: form.goals,
        equipment: form.equipment,
        weeklyTrainingDays: form.weeklyTrainingDays,
        defaultSessionMinutes: form.defaultSessionMinutes,
        canWalk20Minutes: form.canWalk20Minutes,
        canChairStand: form.canChairStand,
        canHoldSupport20Seconds: form.canHoldSupport20Seconds,
        limitations: form.limitations,
        baselineLowBackPain: optionalNumber(form.baselineLowBackPain) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | undefined,
        baselineNeckShoulderPain: optionalNumber(form.baselineNeckShoulderPain) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | undefined
      });
      if (!response.profile) {
        throw new Error("profile missing after save");
      }
      onComplete(response.profile);
    } catch (error) {
      setError(`${editing ? "档案" : "建档"}保存失败：${describeApiError(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={editing ? "profile-edit-flow" : "onboarding-screen"}>
      <div className={editing ? "profile-edit-shell" : "onboarding-shell"}>
        <header className="onboarding-progress">
          <div>
            <p className="eyebrow">{editing ? "修改训练档案" : `欢迎，${username}`}</p>
            <strong>{editing ? "档案设置" : "首次建档"} · {step + 1}/3</strong>
          </div>
          <div className="onboarding-progress-track" aria-label={`${editing ? "档案设置" : "建档"}进度 ${step + 1}/3`}>
            <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
        </header>

        <div
          className={editing ? "card setting-panel profile-edit-card" : "auth-card onboarding-card"}
          role={editing ? undefined : "main"}
        >
          {step === 0 && (
            <section className="onboarding-step">
              <div>
                <p className="eyebrow">基础情况</p>
                <h1>{editing ? "更新你的训练起点" : "先找到合适的起点"}</h1>
                <p className="muted">只收集会影响动作筛选和训练量的信息。身高、体重可不填。</p>
              </div>
              <div className="field-grid two-columns">
                <label>
                  年龄段
                  <select
                    value={form.ageRange}
                    onChange={(event) => setForm({ ...form, ageRange: event.target.value as AgeRange })}
                  >
                    <option value="18-29">18–29 岁</option>
                    <option value="30-44">30–44 岁</option>
                    <option value="45-59">45–59 岁</option>
                    <option value="60+">60 岁及以上</option>
                  </select>
                </label>
                <label>
                  运动基础
                  <select
                    value={form.fitnessLevel}
                    onChange={(event) => setForm({ ...form, fitnessLevel: event.target.value as FitnessLevel })}
                  >
                    <option value="beginner">刚开始 / 停练较久</option>
                    <option value="regular">每周规律运动</option>
                    <option value="experienced">有系统训练经验</option>
                  </select>
                </label>
                <label>
                  身高 cm（可选）
                  <input
                    inputMode="decimal"
                    min="120"
                    max="230"
                    type="number"
                    value={form.heightCm}
                    onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
                  />
                </label>
                <label>
                  体重 kg（可选）
                  <input
                    inputMode="decimal"
                    min="30"
                    max="300"
                    step="0.1"
                    type="number"
                    value={form.weightKg}
                    onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
                  />
                </label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="onboarding-step">
              <div>
                <p className="eyebrow">目标与条件</p>
                <h1>{editing ? "调整你的候选运动库" : "建立你的候选运动库"}</h1>
                <p className="muted">先按目标、体能和器械筛选，每天再按状态决定当日动作和训练量。</p>
              </div>
              <fieldset className="choice-group">
                <legend>主要目标（最多 2 项）</legend>
                <div className="choice-grid">
                  {goalOptions.map((option) => (
                    <Choice
                      key={option.value}
                      checked={form.goals.includes(option.value)}
                      label={option.label}
                      onChange={(checked) => {
                        if (checked && form.goals.length >= 2) return;
                        setForm({
                          ...form,
                          goals: toggleValue(form.goals, option.value, checked)
                        });
                      }}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="choice-group">
                <legend>当前可用条件</legend>
                <div className="choice-grid">
                  {equipmentOptions.map((option) => (
                    <Choice
                      key={option.value}
                      checked={form.equipment.includes(option.value)}
                      label={option.label}
                      onChange={(checked) => setForm({
                        ...form,
                        equipment: toggleValue(form.equipment, option.value, checked)
                      })}
                    />
                  ))}
                </div>
              </fieldset>
              <ExerciseLibraryPreview equipment={form.equipment} />
              <div className="field-grid two-columns">
                <div className="info-block" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#44544f", marginBottom: "4px" }}>每周训练频率</span>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64746f", lineHeight: "1.4" }}>
                    每周最多安排 <b>3 次主训练</b>，其余为主动恢复
                  </p>
                </div>
                <label>
                  默认单次时长
                  <select
                    value={form.defaultSessionMinutes}
                    onChange={(event) => setForm({ ...form, defaultSessionMinutes: Number(event.target.value) })}
                  >
                    {[10, 15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} 分钟</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-step">
              <div>
                <p className="eyebrow">安全边界</p>
                <h1>把不合适的动作先排除</h1>
                <p className="muted">这些信息用于保守降阶与动作排除，不用于诊断或治疗。</p>
              </div>
              <div className="field-grid">
                <BooleanSelect
                  label="能否连续走 20 分钟"
                  value={form.canWalk20Minutes}
                  onChange={(value) => setForm({ ...form, canWalk20Minutes: value })}
                />
                <BooleanSelect
                  label="能否不扶手从椅子站起"
                  value={form.canChairStand}
                  onChange={(value) => setForm({ ...form, canChairStand: value })}
                />
                <BooleanSelect
                  label="能否稳定支撑 20 秒"
                  value={form.canHoldSupport20Seconds}
                  onChange={(value) => setForm({ ...form, canHoldSupport20Seconds: value })}
                />
              </div>

              <div className="medical-notice" role="note">
                <strong>做过脊柱手术、正在戴支具，或医生限制过你的运动？</strong>
                <p>请先按医生或康复治疗师的方案来。姿序不会根据这些情况调整动作，它的动作只供参考，也不能替代专业评估。</p>
              </div>
              <fieldset className="choice-group">
                <legend>平时容易不适或需要更保守的部位（可不选）</legend>
                <div className="choice-grid">
                  {limitationOptions.map((option) => (
                    <Choice
                      key={option.value}
                      checked={form.limitations.includes(option.value)}
                      label={option.label}
                      onChange={(checked) => setForm({
                        ...form,
                        limitations: toggleValue(form.limitations, option.value, checked)
                      })}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="field-grid two-columns">
                <PainSelect
                  label="平时腰背不适（可选）"
                  value={form.baselineLowBackPain}
                  onChange={(value) => setForm({ ...form, baselineLowBackPain: value })}
                />
                <PainSelect
                  label="平时肩颈不适（可选）"
                  value={form.baselineNeckShoulderPain}
                  onChange={(value) => setForm({ ...form, baselineNeckShoulderPain: value })}
                />
              </div>
              <div className="safety-notice">
                <strong>使用边界</strong>
                <p>姿序只做运动风险教育和状态匹配，不替代医疗评估。出现麻木、放射痛、明显无力、大小便异常或突发剧痛时，应停止训练并及时就医。</p>
                <p>动作示范会打开哔哩哔哩第三方页面；视频仅用来看动作，训练量和停止条件以姿序当日任务为准。</p>
              </div>
              {editing ? (
                <p className="muted small profile-consent-note">保存后继续按你已同意的范围，将这些信息用于个人动作筛选和当日计划匹配。</p>
              ) : (
                <>
                  {/* Shown once, when the profile is first created; bump HEALTH_CONSENT_VERSION on the server when this text changes. */}
                  <div className="safety-notice health-consent-notice">
                    <strong>健康信息说明（需要你单独同意）</strong>
                    <dl>
                      <dt>哪些信息</dt>
                      <dd>建档里的年龄段、身高体重（可选）、体能、需要保守的部位和平时不适；之后每天记的腰背和肩颈不适、精神、睡眠、步数、饮食、体重和危险信号；训练和练后记录；你自己上传的体态照片（可选）。</dd>
                      <dt>用来做什么</dt>
                      <dd>筛选动作、生成当天训练、出现危险信号当天停训、按练后不适调整下次训练量、做记录和照片对比。只用于这些功能。</dd>
                      <dt>存在哪</dt>
                      <dd>按账号保存在姿序服务器，只有登录这个账号才能看到。照片上传前会在你的设备上重新压缩，一般会去掉拍摄时间、地点这类信息。</dd>
                      <dt>会不会给别人</dt>
                      <dd>不给第三方。只有你自己打开 AI 解读并填了自己的 DeepSeek Key 时，才会把当天计划的说明（含由当天状态推出的原因）或一周的汇总数字（如记录天数、平均腰酸）发给 DeepSeek；账号、照片和备注不发。</dd>
                      <dt>保存多久、怎么删</dt>
                      <dd>账号在就一直保存。照片可以单张删除；注销账号会删除全部档案、记录和照片，注销前可以先导出备份。</dd>
                      <dt>为什么必须同意</dt>
                      <dd>没有这些信息，姿序没法筛选动作、判断当天能不能练，所以不同意就不能完成建档。健康信息一旦泄露，别人可能知道你的身体状况，所以姿序按账号隔离保存，不公开展示。</dd>
                    </dl>
                  </div>
                  <label className="check-row consent-row">
                    <input
                      type="checkbox"
                      checked={form.healthConsent}
                      onChange={(event) => setForm({ ...form, healthConsent: event.target.checked })}
                    />
                    <span>我已阅读上面的健康信息说明，单独同意姿序按说明处理这些信息。</span>
                  </label>
                </>
              )}
            </section>
          )}

          {error && <p className="error-text">{error}</p>}
          <div className="button-row onboarding-actions">
            {editing && step === 0 && onCancel && (
              <button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>
                取消
              </button>
            )}
            {step > 0 && (
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setStep(step - 1)}>
                上一步
              </button>
            )}
            {step < 2 ? (
              <button type="button" onClick={goNext}>下一步</button>
            ) : (
              <button type="button" disabled={saving} onClick={() => void submitProfile()}>
                {saving ? "正在保存" : editing ? "保存训练档案" : "建立我的运动库"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExerciseLibraryPreview({ equipment }: { equipment: ExerciseEquipment[] }) {
  const compatibleExercises = getEquipmentCompatibleExercises(equipment);
  return (
    <div className="profile-library-preview" aria-live="polite">
      <div className="profile-library-preview-head">
        <strong>器械匹配运动库</strong>
        <span>{compatibleExercises.length} 个动作</span>
      </div>
      <p>勾选或移除器械会立即改变这里；保存后，新计划与动作替换会按新运动库筛选。</p>
      <details>
        <summary>查看当前动作</summary>
        <div className="profile-library-tags">
          {compatibleExercises.map((exercise) => <span key={exercise.id}>{exercise.name}</span>)}
        </div>
      </details>
    </div>
  );
}

function Choice({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`choice-card${checked ? " selected" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function BooleanSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label>
      {label}
      <select value={String(value)} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">可以</option>
        <option value="false">目前不能 / 不确定</option>
      </select>
    </label>
  );
}

function PainSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">暂不填写</option>
        {Array.from({ length: 11 }, (_, score) => (
          <option key={score} value={score}>{score} / 10</option>
        ))}
      </select>
    </label>
  );
}

function toggleValue<T>(values: T[], value: T, checked: boolean): T[] {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function profileToForm(profile: TrainingProfile): OnboardingFormState {
  return {
    ageRange: profile.ageRange,
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    fitnessLevel: profile.fitnessLevel,
    goals: [...profile.goals],
    equipment: [...profile.equipment],
    weeklyTrainingDays: profile.weeklyTrainingDays,
    defaultSessionMinutes: profile.defaultSessionMinutes,
    canWalk20Minutes: profile.canWalk20Minutes,
    canChairStand: profile.canChairStand,
    canHoldSupport20Seconds: profile.canHoldSupport20Seconds,
    limitations: [...profile.limitations],
    baselineLowBackPain: profile.baselineLowBackPain?.toString() ?? "",
    baselineNeckShoulderPain: profile.baselineNeckShoulderPain?.toString() ?? "",
    healthConsent: true
  };
}
