import { useMemo, useState, type FormEvent } from "react";
import type { DailyCheckinInput } from "../api";

interface StatusFormProps {
  date: string;
  loading: boolean;
  onSubmit: (status: DailyCheckinInput) => Promise<void> | void;
}

const defaultRedFlags = {
  legNumbness: false,
  radiatingPain: false,
  weakness: false,
  bowelBladderChange: false,
  sharpSuddenPain: false
};

export function StatusForm({ date, loading, onSubmit }: StatusFormProps) {
  const [lowBackPain, setLowBackPain] = useState(2);
  const [energy, setEnergy] = useState(4);
  const [availableMinutes, setAvailableMinutes] = useState(45);
  const [neckShoulderPain, setNeckShoulderPain] = useState(2);
  const [sleepHours, setSleepHours] = useState("7");
  const [sleepQuality, setSleepQuality] = useState(4);
  const [steps, setSteps] = useState("3000");
  const [eatingStatus, setEatingStatus] = useState<"poor" | "normal" | "good">("normal");
  const [weightKg, setWeightKg] = useState("");
  const [redFlags, setRedFlags] = useState(defaultRedFlags);

  const redFlagCount = useMemo(() => Object.values(redFlags).filter(Boolean).length, [redFlags]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: DailyCheckinInput = {
      date,
      lowBackPain: lowBackPain as DailyCheckinInput["lowBackPain"],
      energy: energy as DailyCheckinInput["energy"],
      availableMinutes,
      neckShoulderPain: neckShoulderPain as DailyCheckinInput["neckShoulderPain"],
      sleepHours: sleepHours ? Number(sleepHours) : undefined,
      sleepQuality: sleepQuality as DailyCheckinInput["sleepQuality"],
      steps: steps ? Number(steps) : undefined,
      eatingStatus,
      weightKg: weightKg ? Number(weightKg) : undefined,
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

      <details className="advanced-panel">
        <summary>高级状态</summary>
        <div className="field-stack">
          <SliderField
            label="肩颈酸"
            value={neckShoulderPain}
            min={0}
            max={10}
            onChange={setNeckShoulderPain}
            suffix="/10"
          />

          <label>
            睡眠时长
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={sleepHours}
              onChange={(event) => setSleepHours(event.target.value)}
            />
          </label>

          <SliderField
            label="睡眠质量"
            value={sleepQuality}
            min={1}
            max={5}
            onChange={setSleepQuality}
            suffix="/5"
          />

          <label>
            步数
            <input
              type="number"
              min="0"
              step="100"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>

          <label>
            饮食状态
            <select
              value={eatingStatus}
              onChange={(event) =>
                setEatingStatus(event.target.value as "poor" | "normal" | "good")
              }
            >
              <option value="poor">差</option>
              <option value="normal">一般</option>
              <option value="good">好</option>
            </select>
          </label>

          <label>
            体重（可选）
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
            />
          </label>

          <fieldset className="flag-group">
            <legend>红旗症状</legend>
            <div className="flag-grid">
              {Object.entries({
                legNumbness: "腿麻",
                radiatingPain: "放射痛",
                weakness: "明显无力",
                bowelBladderChange: "大小便异常",
                sharpSuddenPain: "突发锐痛"
              }).map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={redFlags[key as keyof typeof redFlags]}
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
            <p className="muted small">
              已选 {redFlagCount} 项，选择后今天会自动停训并进入恢复建议。
            </p>
          </fieldset>
        </div>
      </details>

      <button type="submit" disabled={loading}>
        {loading ? "生成中" : "生成今天任务"}
      </button>
    </form>
  );
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
