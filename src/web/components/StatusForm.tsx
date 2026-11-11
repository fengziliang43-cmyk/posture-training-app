import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DailyCheckinInput } from "../api";
import { ENERGY_LABELS } from "../format";
import { describePainLevel } from "../pain-feedback";
import { Icon, PainScale, Segmented } from "./ui";

interface StatusFormProps {
  date: string;
  loading: boolean;
  initialStatus?: DailyCheckinInput | null;
  /** Minutes offered first when nothing is recorded yet (from the training profile). */
  defaultMinutes?: number;
  /** Heading of the update form. The first record of the day has none: the page greets instead. */
  title?: string;
  submitLabel?: string;
  onSubmit: (status: DailyCheckinInput) => unknown;
  onCancel?: () => void;
}

const ENERGY_OPTIONS = ENERGY_LABELS.map((label, index) => ({ value: index + 1, label }));
const MINUTE_CHOICES = [10, 20, 30, 45, 60];
const FLAG_OPTIONS = [
  { value: false, label: "没有" },
  { value: true, label: "有" }
] as const;

export function StatusForm({
  date,
  loading,
  initialStatus,
  defaultMinutes,
  title,
  submitLabel = "生成今天的训练",
  onSubmit,
  onCancel
}: StatusFormProps) {
  // Pain and energy have no default: an answer nobody gave must not be saved as if it were theirs.
  const [lowBackPain, setLowBackPain] = useState<number | null>(initialStatus?.lowBackPain ?? null);
  const [energy, setEnergy] = useState<number | null>(initialStatus?.energy ?? null);
  const [availableMinutes, setAvailableMinutes] = useState<number>(
    initialStatus?.availableMinutes ?? defaultMinutes ?? 30
  );
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
  const hasFlags = redFlagCount > 0 || showRedFlagsDetail;
  // "有" was chosen but no specific signal ticked: do not generate a normal workout from an unfinished answer.
  const redFlagsNeedChoice = showRedFlagsDetail && redFlagCount === 0;
  const minuteOptions = useMemo(
    () =>
      [...new Set([...MINUTE_CHOICES, availableMinutes])]
        .sort((a, b) => a - b)
        .map((minutes) => ({ value: minutes, label: String(minutes) })),
    [availableMinutes]
  );
  const missingAnswer = lowBackPain === null || energy === null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lowBackPain === null || energy === null) return;

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

  function chooseFlags(has: boolean) {
    if (has) {
      setShowRedFlagsDetail(true);
      return;
    }
    setRedFlags({
      legNumbness: false,
      radiatingPain: false,
      weakness: false,
      bowelBladderChange: false,
      sharpSuddenPain: false
    });
    setShowRedFlagsDetail(false);
  }

  return (
    <form className="status-form card-solid" onSubmit={handleSubmit}>
      {title && (
        <div className="form-title">
          <h2>{title}</h2>
          {onCancel && (
            <button type="button" className="text-button" onClick={onCancel}>
              取消
            </button>
          )}
        </div>
      )}

      <section className="field-block">
        <div className="field-head">
          <span>腰背不适</span>
          <b>{lowBackPain === null ? "请选择" : `${lowBackPain} · ${describePainLevel(lowBackPain)}`}</b>
        </div>
        <PainScale label="今天的腰背不适，0 到 10" value={lowBackPain} onChange={setLowBackPain} />
      </section>

      <section className="field-block">
        <div className="field-head">
          <span>精神</span>
          <b>{energy === null ? "请选择" : ENERGY_LABELS[energy - 1]}</b>
        </div>
        <Segmented label="今天的精神状态" options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
      </section>

      <section className="field-block">
        <div className="field-head">
          <span>今天能练多久</span>
          <b>{availableMinutes} 分钟</b>
        </div>
        <Segmented
          label="今天能练多久，单位分钟"
          options={minuteOptions}
          value={availableMinutes}
          onChange={setAvailableMinutes}
        />
      </section>

      <section className="flag-row">
        <div className="flag-row-head">
          <Icon name="shield" size={24} />
          <div>
            <b>今天有没有这些情况？</b>
            <p>腿麻、放射痛、明显无力、大小便异常、突发锐痛</p>
          </div>
          <Segmented label="今天有没有危险信号" options={FLAG_OPTIONS} value={hasFlags} onChange={chooseFlags} />
        </div>

        {hasFlags && (
          <fieldset className="flag-group">
            <legend>勾选出现的情况：任意一项都会让今天停训</legend>
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
            <p className="error-text small" role={redFlagsNeedChoice ? "alert" : undefined}>
              {redFlagsNeedChoice
                ? "请勾选具体是哪一项；如果其实没有，请点上面的“没有”。"
                : `已勾选 ${redFlagCount} 项。今天会停训，并给出就医建议。`}
            </p>
          </fieldset>
        )}
      </section>

      <details className="optional-fields">
        <summary>
          <Icon name="plus" size={16} />
          睡眠、步数、体重（选填，不填就不记）
        </summary>
        <div className="field-stack">
          <label className="slider-field">
            <span className="slider-label">
              肩颈酸
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
            睡眠时长（小时）
            <input
              type="number"
              inputMode="decimal"
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
              睡眠质量
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
            步数
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
              placeholder="未记录"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
            />
          </label>

          <label>
            饮食状态
            <select
              value={eatingStatus}
              onChange={(event) => setEatingStatus(event.target.value as "poor" | "normal" | "good" | "")}
            >
              <option value="">未记录</option>
              <option value="poor">差</option>
              <option value="normal">一般</option>
              <option value="good">好</option>
            </select>
          </label>

          <label>
            体重（kg）
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              placeholder="未记录"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
            />
          </label>
        </div>
      </details>

      <button type="submit" className="wide" disabled={loading || missingAnswer || redFlagsNeedChoice}>
        {loading
          ? "生成中"
          : missingAnswer
            ? "先选腰背不适和精神"
            : redFlagsNeedChoice
              ? "请先勾选危险信号，或选“没有”"
              : submitLabel}
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
