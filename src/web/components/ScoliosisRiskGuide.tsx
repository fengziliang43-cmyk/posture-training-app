import { useState } from "react";

type ObservationKey = "standing" | "bend" | "lean";

const observations: Array<{ key: ObservationKey; label: string }> = [
  { key: "standing", label: "自然站立时，双肩、肩胛、腰线或髋部持续不对称" },
  { key: "bend", label: "前屈时，一侧肋背或腰背明显高于另一侧" },
  { key: "lean", label: "身体经常偏向一侧，或衣服下摆总向一边歪" }
];

export function ScoliosisRiskGuide() {
  const [checked, setChecked] = useState<Record<ObservationKey, boolean>>({
    standing: false,
    bend: false,
    lean: false
  });
  const hasObservation = Object.values(checked).some(Boolean);

  return (
    <details className="scoliosis-guide card">
      <summary>
        <span className="guide-summary-icon" aria-hidden="true">S</span>
        <span>
          <strong>侧弯风险自查</strong>
          <small>看懂体表信号，不代替诊断</small>
        </span>
        <span className="guide-summary-action">3 分钟</span>
      </summary>

      <div className="scoliosis-guide-body">
        <div className="guide-boundary" role="note">
          <strong>先说清边界</strong>
          <p>这只能帮助发现体表不对称，不能排除或确诊脊柱侧弯，也不能判断 Cobb 角和曲线是否进展。</p>
        </div>

        <section className="guide-section" aria-labelledby="standing-check-title">
          <div className="guide-section-head">
            <span>01</span>
            <div>
              <h3 id="standing-check-title">自然站立，从背后观察</h3>
              <p>穿贴身衣物、放松站直，不要故意挺胸或把肩膀摆平。请家人比较肩线、肩胛、腰线和髋部。</p>
            </div>
          </div>
          <StandingComparison />
          <p className="guide-caption">左图是对称参考；右图只表示“需要进一步评估的体表信号”，并不等于已经确诊。</p>
        </section>

        <section className="guide-section" aria-labelledby="bend-check-title">
          <div className="guide-section-head">
            <span>02</span>
            <div>
              <h3 id="bend-check-title">做 Adam 前屈试验</h3>
              <p>双脚并拢、膝盖伸直，双臂自然下垂或掌心相对，从腰部缓慢前屈。观察者从后方比较两侧肋背和腰背高度。</p>
            </div>
          </div>
          <ForwardBendIllustration />
          <div className="guide-step-note">
            <strong>重点不是“脊柱看起来直不直”</strong>
            <p>更应注意一侧肋背或腰背是否形成持续、明显的隆起。轻微不对称很常见，单次观察不能下结论。</p>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="observation-title">
          <div className="guide-section-head">
            <span>03</span>
            <div>
              <h3 id="observation-title">记录你看到的现象</h3>
              <p>勾选只是整理观察，不会生成“正常/异常分数”。</p>
            </div>
          </div>
          <fieldset className="guide-checklist">
            <legend className="sr-only">侧弯风险体表观察</legend>
            {observations.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={checked[item.key]}
                  onChange={(event) => setChecked((current) => ({
                    ...current,
                    [item.key]: event.target.checked
                  }))}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <div className={hasObservation ? "guide-result needs-review" : "guide-result"} aria-live="polite">
            <strong>{hasObservation ? "记录到了需要评估的体表信号" : "没有勾选体表信号"}</strong>
            <p>
              {hasObservation
                ? "这不代表已经确诊。建议预约骨科、脊柱外科或康复医学科，由专业人员检查；是否需要站立位全脊柱 X 线由医生决定。"
                : "这仍不能排除侧弯。如果你已经发现外观改变、处于生长突增期，或对结果不放心，仍应请专业人员评估。"}
            </p>
          </div>
        </section>

        <div className="guide-medical-note">
          <strong>确诊看什么</strong>
          <p>脊柱侧弯通常需要站立位脊柱影像确认，并由专业人员测量 Cobb 角；体表照片、前屈试验和手机 App 都不能替代它。</p>
        </div>

        <div className="guide-urgent-note" role="alert">
          <strong>出现这些情况，不要继续自查或训练</strong>
          <p>腿麻或放射痛、明显无力、大小便异常、突然剧烈疼痛，或症状快速加重时，应停止训练并及时就医。</p>
        </div>

        <div className="guide-sources">
          <span>医学依据</span>
          <a href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/adolescent-idiopathic-scoliosis-screening" target="_blank" rel="noreferrer">USPSTF 筛查说明</a>
          <a href="https://www.nhs.uk/conditions/scoliosis/" target="_blank" rel="noreferrer">NHS 脊柱侧弯指南</a>
        </div>
      </div>
    </details>
  );
}

function StandingComparison() {
  return (
    <div className="standing-comparison" role="img" aria-label="自然站立时对称参考与需要评估的肩线、腰线不对称示意">
      <figure>
        <svg viewBox="0 0 150 190" aria-hidden="true">
          <circle cx="75" cy="27" r="17" />
          <path className="body-shape" d="M51 51c8-7 40-7 48 0 7 22 12 51 9 79-2 20-9 34-15 46H57c-6-12-13-26-15-46-3-28 2-57 9-79Z" />
          <path className="spine-line" d="M75 48v119" />
          <path className="guide-line good" d="M37 65h76M45 118h60" />
          <circle className="guide-dot good" cx="48" cy="65" r="4" />
          <circle className="guide-dot good" cx="102" cy="65" r="4" />
        </svg>
        <figcaption><strong>对称参考</strong><span>肩线、腰线大致水平</span></figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 150 190" aria-hidden="true">
          <circle cx="78" cy="27" r="17" />
          <path className="body-shape" d="M51 48c10-7 39-3 49 6 5 23 10 53 6 79-3 20-9 32-15 43H58c-7-13-15-30-16-51-2-27 3-55 9-77Z" />
          <path className="spine-line alert" d="M77 47c-19 27 21 47 1 73-14 19-5 34 10 47" />
          <path className="guide-line alert" d="M37 61l77 11M45 120l61-8" />
          <circle className="guide-dot alert" cx="48" cy="63" r="4" />
          <circle className="guide-dot alert" cx="102" cy="70" r="4" />
        </svg>
        <figcaption><strong>需要评估</strong><span>肩线、腰线持续不对称</span></figcaption>
      </figure>
    </div>
  );
}

function ForwardBendIllustration() {
  return (
    <div className="bend-illustration" role="img" aria-label="Adam 前屈试验动作和一侧肋背隆起示意">
      <svg viewBox="0 0 340 190" aria-hidden="true">
        <defs>
          <linearGradient id="bendBody" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#b9b4ff" />
            <stop offset="1" stopColor="#9bdcf2" />
          </linearGradient>
        </defs>
        <circle cx="63" cy="50" r="18" />
        <path className="bend-person" d="M78 58c40 12 70 29 100 54 18 15 31 19 52 17l39-4 6 24-53 12c-25 6-51-1-71-18-32-27-57-39-91-49L39 84l12-26 27 0Z" />
        <path className="bend-arm" d="M125 86 94 145M146 98l-23 57" />
        <path className="bend-leg" d="M57 85 41 166M78 91l15 75" />
        <path className="bend-back-line" d="M79 67c41 10 67 24 97 50 18 15 36 17 56 13" />
        <ellipse className="rib-rise" cx="183" cy="115" rx="28" ry="13" />
        <path className="look-arrow" d="M307 78c-24 2-41 13-53 31m52-31-13-9m13 9-8 14" />
      </svg>
      <div>
        <strong>观察者从后方、接近背部水平看</strong>
        <span>比较两侧肋背和腰背高度，而不是用手机猜测脊柱角度。</span>
      </div>
    </div>
  );
}
