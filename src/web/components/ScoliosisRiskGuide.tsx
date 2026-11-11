import { useState } from "react";

type ObservationKey = "standing" | "bend" | "lean";

const observations: Array<{ key: ObservationKey; label: string }> = [
  { key: "standing", label: "自然站立时，双肩、肩胛、腰线或髋部持续不对称" },
  { key: "bend", label: "前屈时，一侧肋背或腰背明显高于另一侧" },
  { key: "lean", label: "身体经常偏向一侧，或衣服下摆总向一边歪" }
];

export function ScoliosisRiskGuide({ openByDefault = false }: { openByDefault?: boolean } = {}) {
  const [checked, setChecked] = useState<Record<ObservationKey, boolean>>({
    standing: false,
    bend: false,
    lean: false
  });
  const hasObservation = Object.values(checked).some(Boolean);

  return (
    <details className="scoliosis-guide card" open={openByDefault ? true : undefined}>
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
    <div className="standing-comparison" role="group" aria-label="自然站立时对称参考与需要评估的肩线、腰线不对称示意">
      <figure>
        <img
          src="/illustrations/scoliosis-standing-reference.jpg"
          alt="自然站立背面参考，双肩和两侧腰线大致对称"
          width="720"
          height="900"
          loading="lazy"
          decoding="async"
        />
        <figcaption><strong>对称参考</strong><span>肩线、腰线大致水平</span></figcaption>
      </figure>
      <figure>
        <img
          src="/illustrations/scoliosis-standing-asymmetry.jpg"
          alt="自然站立背面示意，可见肩线倾斜、两侧腰线不对称和躯干偏移"
          width="720"
          height="900"
          loading="lazy"
          decoding="async"
        />
        <figcaption><strong>需要评估</strong><span>肩线、腰线持续不对称</span></figcaption>
      </figure>
    </div>
  );
}

function ForwardBendIllustration() {
  return (
    <div className="bend-illustration">
      <img
        src="/illustrations/scoliosis-forward-bend-asymmetry.jpg"
        alt="Adam 前屈试验背面示意，画面右侧肋背隆起，左侧相邻区域较低"
        width="1200"
        height="675"
        loading="lazy"
        decoding="async"
      />
      <div>
        <strong>观察者从后方、接近背部水平看</strong>
        <span>比较两侧肋背和腰背高度，而不是用手机猜测脊柱角度。</span>
      </div>
    </div>
  );
}
