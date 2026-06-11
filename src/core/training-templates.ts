import type { TrainingTemplate } from "./types";

export const trainingTemplates = [
  {
    id: "upper-back-core",
    name: "上背 + 核心",
    type: "full",
    blocks: [
      { label: "热身", exerciseIds: ["thoracic-extension", "prone-ytw"] },
      { label: "主训练", exerciseIds: ["pull-up", "band-row"] },
      { label: "辅助", exerciseIds: ["band-face-pull"] },
      { label: "核心", exerciseIds: ["dead-bug"] },
      { label: "结束", exerciseIds: ["ninety-ninety-breathing"] }
    ]
  },
  {
    id: "glute-pelvis",
    name: "臀腿 + 骨盆稳定",
    type: "full",
    blocks: [
      { label: "热身", exerciseIds: ["hip-flexor-stretch", "glute-bridge"] },
      { label: "主训练", exerciseIds: ["split-squat", "glute-bridge"] },
      { label: "辅助", exerciseIds: ["band-lateral-walk"] },
      { label: "核心", exerciseIds: ["side-plank"] },
      { label: "结束", exerciseIds: ["brisk-walk"] }
    ]
  },
  {
    id: "full-body-light",
    name: "全身轻量",
    type: "reduced",
    blocks: [
      { label: "拉力", exerciseIds: ["pull-up", "band-row"] },
      { label: "下肢", exerciseIds: ["split-squat"] },
      { label: "核心", exerciseIds: ["dead-bug", "bird-dog"] }
    ]
  },
  {
    id: "recovery",
    name: "恢复日",
    type: "recovery",
    blocks: [
      { label: "低强度活动", exerciseIds: ["brisk-walk"] },
      {
        label: "呼吸和活动度",
        exerciseIds: [
          "ninety-ninety-breathing",
          "bird-dog",
          "child-pose-breathing",
          "thoracic-extension"
        ]
      }
    ]
  }
] satisfies TrainingTemplate[];
