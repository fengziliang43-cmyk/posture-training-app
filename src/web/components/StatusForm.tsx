import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DailyCheckinInput } from "../api";

interface StatusFormProps {
  date: string;
  loading: boolean;
  initialStatus?: DailyCheckinInput | null;
  submitLabel?: string;
  onSubmit: (status: DailyCheckinInput) => Promise<void> | void;
}

export function StatusForm({ date, loading, initialStatus, submitLabel = "生成今天任务", onSubmit }: StatusFormProps) {
  const [lowBackPain, setLowBackPain] = useState<number>(initialStatus?.lowBackPain ?? 2);
  const [energy, setEnergy] = useState<number>(initialStatus?.energy ?? 4);
  const [availableMinutes, setAvailableMinutes] = useState(initialStatus?.availableMinutes ?? 45);
  const [neckShoulderPain, setNeckShoulderPain] = useState<number | null>(initialStatus?.neckShoulderPain ?? null);
  const [sleepHours, setSleepHours] = useState(initialStatus?.sleepHours !== undefined ? String(initialStatus.sleepHours) : "");
  const [sleepQuality, setSleepQuality] = useState<number | null>(initialStatus?.sleepQuality ?? null);
  const [steps, setSteps] = useState(initialStatus?.steps !== undefined ? String(initialStatus.steps) : "");
  const [eatingStatus, setEatingStatus] = useState<"poor" | "normal" | "good" | "">(initialStatus?.eatingStatus ?? "");
  const [weightKg, setWeightKg] = useState(initialStatus?.weightKg !== undefined ? String(initialStatus.weightKg) : "");
  const [redFlags, setRedFlags] = useState(normalizeRedFlags(initialStatus));
  const [showRedFlagsDetail, setShowRedFlagsDetail] = useState(false);

  useEffect(() => {
    if (!initialStatus) return;
    setLowBackPain(initialStatus.lowBackPain);
    setEnergy(initialStatus.energy);
    setAvailableMinutes(initialStatus.availableMinutes);
    setNeckShoulderPain(initialStatus.neckShoulderPain ?? null);
    setSleepHours(initialStatus.sleepHours !== undefined ? String(initialStatus.sleepHours) : "");
    setSleepQuality(initialStatus.sleepQuality ?? null);
    setSteps(initialStatus.steps !== undefined ? String(initialStatus.steps) : "");
    setEatingStatus(initialStatus.eatingStatus ?? "");
    setWeightKg(initialStatus.weightKg !== undefined ? String(initialStatus.weightKg) : "");
    setRedFlags(normalizeRedFlags(initialStatus));
  }, [initialStatus]);

  const redFlagCount = useMemo(() => Object.values(redFlags).filter(Boolean).length, [redFlags]);
  // "有" was chosen but no specific signal ticked: do not generate a normal workout from an unfinished answer.
  const redFlagsNeedChoice = showRedFlagsDetail && redFlagCount === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: DailyCheckinInput = {
      date,
      lowBackPain: lowBackPain as DailyCheckinInput["lowBackPain"],
      energy: energy as DailyCheckinInput["energy"],
      availableMinutes,
      ...(neckShoulderPain !== null ? { neckShoulderPain: neckShoulderPain as DailyCheckinInput["neckShoulderPain"] } : {}),
      ...(sleepHours.trim() ? { sleepHours: Number(sleepHours) } : {}),
      ...(sleepQuality !== null ? { sleepQuality: sleepQuality as DailyCheckinInput["sleepQuality"] } : {}),
      ...(steps.trim() ? { steps: Number(steps) } : {}),
      ...(eatingStatus ? { eatingStatus: eatingStatus as DailyCheckinInput["eatingStatus"] } : {}),
      ...(weightKg.trim() ? { weightKg: Number(weightKg) } : {}),
      redFlags
    };

    await onSubmit(payload);
  }

  return (
    <form className="status-form card" onSubmit={handleSubmit}>
      <div className="form-head">
        <div>
          <p className="eyebrow">今日状态</p>
          <h2>先记录再生成任务</h2>
        </div>
        <span className="date-pill">{date}</span>
      </div>

      <div className="field-stack">
        <SliderField
          label="腰酸"
          value={lowBackPain}
          min={0}
          max={10}
          onChange={setLowBackPain}
          suffix="/10"
        />
        <SliderField
          label="精神"
          value={energy}
          min={1}
          max={5}
          onChange={setEnergy}
          suffix="/5"
        />
        <SliderField
          label="可训练时间"
          value={availableMinutes}
          min={10}
          max={60}
          step={5}
          onChange={setAvailableMinutes}
          suffix="分钟"
        />
      </div>

      <div className="card" style={{ padding: "12px 14px", margin: "12px 0 6px", background: "rgba(255, 255, 255, 0.45)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div>
            <strong style={{ fontSize: "14px", display: "block" }}>今天是否有以下危险信号？</strong>
            <p className="muted small" style={{ margin: "2px 0 0" }}>腿麻、放射痛、明显无力、大小便异常、突发锐痛</p>
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              className={redFlagCount === 0 && !showRedFlagsDetail ? "secondary-button active-chip" : "secondary-button"}
              onClick={() => {
                setRedFlags({
                  legNumbness: false,
                  radiatingPain: false,
                  weakness: false,
                  bowelBladderChange: false,
                  sharpSuddenPain: false
                });
                setShowRedFlagsDetail(false);
              }}
            >
              无
            </button>
            <button
              type="button"
              className={redFlagCount > 0 || showRedFlagsDetail ? "secondary-button active-chip" : "secondary-button"}
              onClick={() => setShowRedFlagsDetail(true)}
            >
              有
            </button>
          </div>
        </div>

        {(redFlagCount > 0 || showRedFlagsDetail) && (
          <fieldset className="flag-group" style={{ marginTop: "12px" }}>
            <legend>危险信号勾选（任意一项勾选将阻断今日训练）</legend>
            <div className="flag-grid">
              {Object.entries({
                legNumbness: "腿麻或持续刺痛",
                radiatingPain: "放射痛",
                weakness: "明显无力",
                bowelBladderChange: "大小便异常",
                sharpSuddenPain: "突发锐痛"
              }).map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(redFlags[key as keyof typeof redFlags])}
                    onChange={(event) =>
                      setRedFlags((current) => ({
                        ...current,
                        [key]: event.target.checked
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="error-text small" style={{ margin: "6px 0 0" }} role={redFlagsNeedChoice ? "alert" : undefined}>
              {redFlagsNeedChoice
                ? "请勾选具体是哪一项；如果其实没有，请点上面的“无”。"
                : `已勾选 ${redFlagCount} 项。选择后今天会自动停训并给出安全就医建议。`}
            </p>
          </fieldset>
        )}
      </div>

      <details className="advanced-panel">
        <summary>选填信息（不填不存，避免污染统计）</summary>
        <div className="field-stack">
          <label className="slider-field">
            <span className="slider-label">
              肩颈酸（选填）
              <strong>{neckShoulderPain !== null ? `${neckShoulderPain}/10` : "未记"}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              value={neckShoulderPain ?? 0}
              onChange={(event) => setNeckShoulderPain(Number(event.target.value))}
            />
          </label>

          <label>
            睡眠时长（小时，选填）
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              placeholder="未记录"
              value={sleepHours}
              onChange={(event) => setSleepHours(event.target.value)}
            />
          </label>

          <label className="slider-field">
            <span className="slider-label">
              睡眠质量（选填）
              <strong>{sleepQuality !== null ? `${sleepQuality}/5` : "未记"}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={sleepQuality ?? 3}
              onChange={(event) => setSleepQuality(Number(event.target.value))}
            />
          </label>

          <label>
            步数（选填）
            <input
              type="number"
              min="0"
              step="100"
              placeholder="未记录"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>

          <label>
            饮食状态（选填）
            <select
              value={eatingStatus}
              onChange={(event) =>
                setEatingStatus(event.target.value as "poor" | "normal" | "good" | "")
              }
            >
              <option value="">未记录</option>
              <option value="poor">差</option>
              <option value="normal">一般</option>
              <option value="good">好</option>
            </select>
          </label>

          <label>
            体重（kg，选填）
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="未记录"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
            />
          </label>
        </div>
      </details>

      <button type="submit" disabled={loading || redFlagsNeedChoice}>
        {loading ? "生成中" : redFlagsNeedChoice ? "请先勾选危险信号，或选“无”" : submitLabel}
      </button>
    </form>
  );
}

function normalizeRedFlags(status?: DailyCheckinInput | null) {
  return {
    legNumbness: Boolean(status?.redFlags?.legNumbness),
    radiatingPain: Boolean(status?.redFlags?.radiatingPain),
    weakness: Boolean(status?.redFlags?.weakness),
    bowelBladderChange: Boolean(status?.redFlags?.bowelBladderChange),
    sharpSuddenPain: Boolean(status?.redFlags?.sharpSuddenPain)
  };
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step = 1, suffix, onChange }: SliderFieldProps) {
  return (
    <label className="slider-field">
      <span className="slider-label">
        {label}
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
