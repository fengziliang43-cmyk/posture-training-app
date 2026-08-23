import type {
  Exercise,
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseRole,
  LoadLevel,
  PlanType
} from "./types";

const baseExerciseLibrary = [
  {
    id: "pull-up",
    name: "引体向上",
    category: "pull",
    defaultSets: 3,
    defaultReps: 5,
    restSeconds: 120,
    coachingNotes: ["肩胛先下沉再拉起", "保留 1-2 次余力", "不要用腰部后仰甩动"],
    replacementId: "band-lat-pulldown",
    stopCondition: "出现腰部代偿、肩痛或动作明显变形时停止。"
  },
  {
    id: "band-lat-pulldown",
    name: "弹力带下拉",
    category: "pull",
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 75,
    coachingNotes: ["向下拉到锁骨附近", "肘部走身体两侧", "保持胸廓安静不耸肩"],
    replacementId: "band-row",
    stopCondition: "肩颈紧张明显升高或手臂麻木时停止。"
  },
  {
    id: "band-row",
    name: "弹力带划船",
    category: "pull",
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 75,
    coachingNotes: ["肩胛向后下方收", "肋骨不要外翻", "拉到身体两侧后控制回放"],
    replacementId: "band-lat-pulldown",
    stopCondition: "腰酸升高 2 分以上或身体明显旋转时停止。"
  },
  {
    id: "band-face-pull",
    name: "弹力带面拉",
    category: "scapula",
    defaultSets: 3,
    defaultReps: 15,
    restSeconds: 60,
    coachingNotes: ["拉向眉眼高度", "肘部打开但不耸肩", "末端停 1 秒"],
    replacementId: "prone-ytw",
    stopCondition: "肩前侧刺痛或颈部紧张明显时停止。"
  },
  {
    id: "band-external-rotation",
    name: "弹力带外旋",
    category: "scapula",
    defaultSets: 2,
    defaultReps: 12,
    restSeconds: 45,
    coachingNotes: ["肘部贴近身体", "动作小而稳", "用肩后侧发力"],
    replacementId: "prone-ytw",
    stopCondition: "肩关节夹痛或动作失控时停止。"
  },
  {
    id: "prone-ytw",
    name: "俯身 Y-T-W",
    category: "scapula",
    defaultSets: 2,
    defaultReps: 8,
    restSeconds: 45,
    coachingNotes: ["动作慢", "肩胛后下收", "腰背保持中立"],
    replacementId: "band-face-pull",
    stopCondition: "下背为了抬高手臂开始反弓时停止。"
  },
  {
    id: "dead-bug",
    name: "死虫",
    category: "core",
    defaultSets: 3,
    defaultReps: 8,
    restSeconds: 45,
    coachingNotes: ["腰背轻贴地面", "呼气时伸腿伸手", "宁可少伸远也不要腰离地"],
    replacementId: "bird-dog",
    stopCondition: "腰背离地或腰酸明显上升时停止。"
  },
  {
    id: "bird-dog",
    name: "鸟狗",
    category: "core",
    defaultSets: 2,
    defaultReps: 8,
    restSeconds: 45,
    coachingNotes: ["骨盆保持水平", "手脚向远处伸", "每次末端停 1 秒"],
    replacementId: "dead-bug",
    stopCondition: "身体左右晃动失控或腰部塌陷时停止。"
  },
  {
    id: "side-plank",
    name: "侧桥",
    category: "core",
    defaultSets: 3,
    defaultSeconds: 20,
    restSeconds: 45,
    coachingNotes: ["肩、髋、膝成一条线", "下侧腰稳定发力", "先做短时间高质量"],
    replacementId: "front-plank",
    stopCondition: "肩痛、腰部顶不住或骨盆明显下沉时停止。"
  },
  {
    id: "front-plank",
    name: "平板支撑",
    category: "core",
    defaultSets: 3,
    defaultSeconds: 30,
    restSeconds: 45,
    coachingNotes: ["肋骨收住", "臀部微收紧", "不要追求撑到极限"],
    replacementId: "dead-bug",
    stopCondition: "腰部塌陷、屏气或腰酸升高时停止。"
  },
  {
    id: "pallof-press",
    name: "Pallof press 弹力带抗旋转",
    category: "core",
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 60,
    coachingNotes: ["身体正对前方", "推出时不被弹力带带偏", "左右都做"],
    replacementId: "dead-bug",
    stopCondition: "腰部扭转代偿或髋部顶不住时停止。"
  },
  {
    id: "glute-bridge",
    name: "臀桥",
    category: "hips",
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    coachingNotes: ["脚跟压地", "骨盆轻后倾", "顶峰感受臀部而不是腰部"],
    replacementId: "wall-sit",
    stopCondition: "腰部顶替臀部发力或腰酸升高时停止。"
  },
  {
    id: "single-leg-bridge-regressed",
    name: "单腿臀桥退阶版",
    category: "hips",
    defaultSets: 2,
    defaultReps: 8,
    restSeconds: 60,
    coachingNotes: ["先从一脚轻点地开始", "骨盆不要左右掉", "保持动作范围可控"],
    replacementId: "glute-bridge",
    stopCondition: "骨盆明显倾斜或腰部代偿时停止。"
  },
  {
    id: "split-squat",
    name: "分腿蹲",
    category: "hips",
    defaultSets: 3,
    defaultReps: 8,
    restSeconds: 90,
    coachingNotes: ["躯干保持长", "前脚踩稳", "膝盖跟脚尖方向一致"],
    replacementId: "step-up",
    stopCondition: "膝痛、髋痛或腰部侧弯代偿明显时停止。"
  },
  {
    id: "step-up",
    name: "台阶上步",
    category: "hips",
    defaultSets: 3,
    defaultReps: 10,
    restSeconds: 75,
    coachingNotes: ["用站上去那条腿发力", "骨盆保持水平", "慢下快上"],
    replacementId: "split-squat",
    stopCondition: "膝盖内扣、骨盆掉落或腰酸升高时停止。"
  },
  {
    id: "band-lateral-walk",
    name: "弹力带侧向走",
    category: "hips",
    defaultSets: 3,
    defaultReps: 12,
    restSeconds: 60,
    coachingNotes: ["脚尖基本朝前", "步幅小一点", "感受臀中肌发力"],
    replacementId: "glute-bridge",
    stopCondition: "髋外侧刺痛或腰部明显扭摆时停止。"
  },
  {
    id: "wall-sit",
    name: "靠墙静蹲",
    category: "hips",
    defaultSets: 2,
    defaultSeconds: 30,
    restSeconds: 75,
    coachingNotes: ["背部贴墙", "膝盖不过度内扣", "呼吸保持平稳"],
    replacementId: "glute-bridge",
    stopCondition: "膝痛、腿麻或腰部顶墙不舒服时停止。"
  },
  {
    id: "thoracic-extension",
    name: "胸椎伸展",
    category: "recovery",
    defaultSets: 2,
    defaultSeconds: 60,
    restSeconds: 20,
    coachingNotes: ["动作集中在上背", "不要用腰椎猛顶", "配合慢呼气"],
    replacementId: "ninety-ninety-breathing",
    stopCondition: "腰部挤压感明显或头晕时停止。"
  },
  {
    id: "hip-flexor-stretch",
    name: "髋屈肌拉伸",
    category: "recovery",
    defaultSets: 2,
    defaultSeconds: 45,
    restSeconds: 20,
    coachingNotes: ["骨盆轻后倾", "不要塌腰", "感受前侧髋部拉伸"],
    replacementId: "ninety-ninety-breathing",
    stopCondition: "前侧髋刺痛或腰部反弓时停止。"
  },
  {
    id: "child-pose-breathing",
    name: "儿童式呼吸",
    category: "recovery",
    defaultSets: 2,
    defaultSeconds: 60,
    restSeconds: 20,
    coachingNotes: ["慢吸慢呼", "把呼吸带到背侧", "保持放松不硬压"],
    replacementId: "ninety-ninety-breathing",
    stopCondition: "膝痛、头晕或呼吸不舒服时停止。"
  },
  {
    id: "ninety-ninety-breathing",
    name: "90/90 呼吸",
    category: "recovery",
    defaultSets: 2,
    defaultSeconds: 60,
    restSeconds: 20,
    coachingNotes: ["双脚放高", "呼气时肋骨回落", "腰背保持轻贴地面"],
    replacementId: "child-pose-breathing",
    stopCondition: "头晕、憋气或腰部不适时停止。"
  },
  {
    id: "brisk-walk",
    name: "快走",
    category: "recovery",
    defaultSets: 1,
    defaultSeconds: 900,
    restSeconds: 0,
    coachingNotes: ["速度到微喘但能说话", "保持自然摆臂", "腰酸升高就降速"],
    replacementId: "ninety-ninety-breathing",
    stopCondition: "腰腿疼痛、麻木、头晕或明显不适时停止。"
  }
] as const;

type ExerciseProfile = Pick<
  Exercise,
  "roles" | "equipment" | "allowedPlanTypes" | "difficulty" | "load" | "goals" | "progression"
>;

const defaultLoad: ExerciseProfile["load"] = {
  lowBack: 1,
  shoulder: 1,
  knee: 1,
  balance: 1,
  impact: 0
};

const defaultGoals: ExerciseProfile["goals"] = {
  posture: 1,
  strength: 1,
  fatLoss: 0,
  conditioning: 0
};

const defaultProgression: ExerciseProfile["progression"] = {
  maxSets: 4,
  minSets: 1
};

function profile(input: {
  roles: ExerciseRole[];
  equipment: ExerciseEquipment[];
  allowedPlanTypes: PlanType[];
  difficulty: ExerciseDifficulty;
  load?: Partial<ExerciseProfile["load"]>;
  goals?: Partial<ExerciseProfile["goals"]>;
  progression?: Partial<ExerciseProfile["progression"]>;
}): ExerciseProfile {
  return {
    roles: input.roles,
    equipment: input.equipment,
    allowedPlanTypes: input.allowedPlanTypes,
    difficulty: input.difficulty,
    load: { ...defaultLoad, ...input.load },
    goals: { ...defaultGoals, ...input.goals },
    progression: { ...defaultProgression, ...input.progression }
  };
}

const exerciseProfiles: Record<string, ExerciseProfile> = {
  "pull-up": profile({
    roles: ["upper-pull"],
    equipment: ["pull-up-bar", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 3,
    load: { lowBack: 2, shoulder: 2, balance: 1 },
    goals: { posture: 2, strength: 3, fatLoss: 1 },
    progression: { repsStep: 1, maxReps: 8, maxSets: 4 }
  }),
  "band-lat-pulldown": profile({
    roles: ["upper-pull"],
    equipment: ["resistance-band"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 1, shoulder: 1 },
    goals: { posture: 2, strength: 2, fatLoss: 1 },
    progression: { repsStep: 2, maxReps: 18, maxSets: 4 }
  }),
  "band-row": profile({
    roles: ["upper-pull", "scapular-control"],
    equipment: ["resistance-band"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 1, shoulder: 1 },
    goals: { posture: 3, strength: 2, fatLoss: 1 },
    progression: { repsStep: 2, maxReps: 18, maxSets: 4 }
  }),
  "band-face-pull": profile({
    roles: ["scapular-control"],
    equipment: ["resistance-band"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 0, shoulder: 1 },
    goals: { posture: 3, strength: 1 },
    progression: { repsStep: 2, maxReps: 20, maxSets: 4 }
  }),
  "band-external-rotation": profile({
    roles: ["scapular-control"],
    equipment: ["resistance-band"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 0, shoulder: 1 },
    goals: { posture: 3, strength: 1 },
    progression: { repsStep: 2, maxReps: 18, maxSets: 3 }
  }),
  "prone-ytw": profile({
    roles: ["scapular-control"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 1, shoulder: 1, balance: 1 },
    goals: { posture: 3, strength: 1 },
    progression: { repsStep: 1, maxReps: 12, maxSets: 3 }
  }),
  "dead-bug": profile({
    roles: ["core-anti-extension"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 1, balance: 1 },
    goals: { posture: 3, strength: 2 },
    progression: { repsStep: 1, maxReps: 12, maxSets: 4 }
  }),
  "bird-dog": profile({
    roles: ["core-anti-extension", "core-anti-rotation"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 1, balance: 2 },
    goals: { posture: 3, strength: 1 },
    progression: { repsStep: 1, maxReps: 12, maxSets: 3 }
  }),
  "side-plank": profile({
    roles: ["core-anti-rotation"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 2, shoulder: 2, balance: 2 },
    goals: { posture: 3, strength: 2 },
    progression: { secondsStep: 5, maxSeconds: 40, maxSets: 4 }
  }),
  "front-plank": profile({
    roles: ["core-anti-extension"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 2, shoulder: 1 },
    goals: { posture: 2, strength: 2 },
    progression: { secondsStep: 5, maxSeconds: 45, maxSets: 4 }
  }),
  "pallof-press": profile({
    roles: ["core-anti-rotation"],
    equipment: ["resistance-band"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 1, balance: 1 },
    goals: { posture: 3, strength: 2 },
    progression: { repsStep: 1, maxReps: 14, maxSets: 4 }
  }),
  "glute-bridge": profile({
    roles: ["hip-stability", "lower-body"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 1, balance: 0 },
    goals: { posture: 3, strength: 2 },
    progression: { repsStep: 2, maxReps: 18, maxSets: 4 }
  }),
  "single-leg-bridge-regressed": profile({
    roles: ["hip-stability", "lower-body"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 1, balance: 2 },
    goals: { posture: 3, strength: 2 },
    progression: { repsStep: 1, maxReps: 12, maxSets: 3 }
  }),
  "split-squat": profile({
    roles: ["lower-body", "hip-stability"],
    equipment: ["bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 2, knee: 2, balance: 2 },
    goals: { posture: 2, strength: 3, fatLoss: 1 },
    progression: { repsStep: 1, maxReps: 12, maxSets: 4 }
  }),
  "step-up": profile({
    roles: ["lower-body", "hip-stability"],
    equipment: ["step", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 2,
    load: { lowBack: 1, knee: 2, balance: 2 },
    goals: { posture: 2, strength: 3, fatLoss: 2 },
    progression: { repsStep: 1, maxReps: 14, maxSets: 4 }
  }),
  "band-lateral-walk": profile({
    roles: ["hip-stability"],
    equipment: ["resistance-band", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 1, knee: 1, balance: 1 },
    goals: { posture: 3, strength: 1 },
    progression: { repsStep: 2, maxReps: 18, maxSets: 4 }
  }),
  "wall-sit": profile({
    roles: ["lower-body"],
    equipment: ["wall", "bodyweight"],
    allowedPlanTypes: ["full", "reduced"],
    difficulty: 1,
    load: { lowBack: 1, knee: 2, balance: 0 },
    goals: { strength: 2, fatLoss: 1 },
    progression: { secondsStep: 5, maxSeconds: 45, maxSets: 3 }
  }),
  "thoracic-extension": profile({
    roles: ["reset", "mobility"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 1 },
    goals: { posture: 3 },
    progression: { secondsStep: 10, maxSeconds: 90, maxSets: 3 }
  }),
  "hip-flexor-stretch": profile({
    roles: ["mobility", "reset"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 1 },
    goals: { posture: 2 },
    progression: { secondsStep: 5, maxSeconds: 60, maxSets: 3 }
  }),
  "child-pose-breathing": profile({
    roles: ["reset", "mobility", "cooldown"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 0, knee: 1 },
    goals: { posture: 2 },
    progression: { secondsStep: 10, maxSeconds: 90, maxSets: 3 }
  }),
  "ninety-ninety-breathing": profile({
    roles: ["reset", "cooldown"],
    equipment: ["floor", "bodyweight"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 0 },
    goals: { posture: 2 },
    progression: { secondsStep: 10, maxSeconds: 90, maxSets: 3 }
  }),
  "brisk-walk": profile({
    roles: ["conditioning", "cooldown"],
    equipment: ["walking-space"],
    allowedPlanTypes: ["full", "reduced", "recovery"],
    difficulty: 1,
    load: { lowBack: 1, impact: 1 },
    goals: { fatLoss: 3, conditioning: 3 },
    progression: { secondsStep: 60, maxSeconds: 1800, maxSets: 1 }
  })
};

// Direct, public demonstration pages checked on 2026-08-09. The app's own
// volume, stop conditions and safety prompts take precedence over third-party copy.
const exerciseVideoUrls: Record<string, string> = {
  "pull-up": "https://www.bilibili.com/video/BV1RX8bzeEjp/",
  "band-lat-pulldown": "https://www.bilibili.com/video/BV1KG1MBjErA/?t=180",
  "band-row": "https://www.bilibili.com/video/BV1KG1MBjErA/?t=330",
  "band-face-pull": "https://www.bilibili.com/video/BV12z4y1x7m6/",
  "band-external-rotation": "https://www.bilibili.com/video/BV19VtSesEYV/",
  "prone-ytw": "https://www.bilibili.com/video/BV1qf4y1H7yk/",
  "dead-bug": "https://www.bilibili.com/video/BV1zYL8zTEcV/",
  "bird-dog": "https://www.bilibili.com/video/BV1bKKVzEEHP/",
  "side-plank": "https://www.bilibili.com/video/BV1oP4y1Z7ee/",
  "front-plank": "https://www.bilibili.com/video/BV14w411V7Yj/",
  "pallof-press": "https://www.bilibili.com/video/BV1XK4y157wo/",
  "glute-bridge": "https://www.bilibili.com/video/BV17m4y1r7mW/",
  "single-leg-bridge-regressed": "https://www.bilibili.com/video/BV1ys421T7gZ/",
  "split-squat": "https://www.bilibili.com/video/BV1fs4y1k7BP/",
  "step-up": "https://www.bilibili.com/video/BV1xL4y1p7Pb/",
  "band-lateral-walk": "https://www.bilibili.com/video/BV1XR4y1J7nB/",
  "wall-sit": "https://www.bilibili.com/video/BV1JV411b7Ws/",
  "thoracic-extension": "https://www.bilibili.com/video/BV1Ft4y117mq/",
  "hip-flexor-stretch": "https://www.bilibili.com/video/BV1y8411Y71E/",
  "child-pose-breathing": "https://www.bilibili.com/video/BV1g3411b71S/",
  "ninety-ninety-breathing": "https://www.bilibili.com/video/BV1FY4y1p78s/",
  "brisk-walk": "https://www.bilibili.com/video/BV1dU4y1X7om/"
};

export const exerciseLibrary: Exercise[] = baseExerciseLibrary.map((exercise) => {
  const metadata = exerciseProfiles[exercise.id];
  const videoUrl = exerciseVideoUrls[exercise.id];
  if (!metadata) {
    throw new Error(`Missing exercise profile: ${exercise.id}`);
  }
  if (!videoUrl) {
    throw new Error(`Missing exercise video: ${exercise.id}`);
  }
  return {
    ...exercise,
    coachingNotes: [...exercise.coachingNotes],
    videoUrl,
    videoSource: "哔哩哔哩第三方动作示范",
    ...metadata
  };
});

export function getEquipmentCompatibleExercises(
  equipment: readonly ExerciseEquipment[]
): Exercise[] {
  const availableEquipment = new Set(equipment);
  return exerciseLibrary.filter((exercise) =>
    exercise.equipment.every((item) => availableEquipment.has(item))
  );
}
