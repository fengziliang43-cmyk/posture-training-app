import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScoliosisRiskGuide } from "../../src/web/components/ScoliosisRiskGuide";

describe("ScoliosisRiskGuide", () => {
  it("teaches observation without presenting a diagnosis", () => {
    const markup = renderToStaticMarkup(createElement(ScoliosisRiskGuide));

    expect(markup).toContain("侧弯风险自查");
    expect(markup).toContain("Adam 前屈试验");
    expect(markup).toContain("不能排除或确诊脊柱侧弯");
    expect(markup).toContain("站立位脊柱影像");
    expect(markup).toContain("大小便异常");
    expect(markup).toContain("/illustrations/scoliosis-standing-reference.jpg");
    expect(markup).toContain("/illustrations/scoliosis-standing-asymmetry.jpg");
    expect(markup).toContain("/illustrations/scoliosis-forward-bend-asymmetry.jpg");
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain("AI 诊断");
  });
});
