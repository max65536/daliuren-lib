import { computeFullPan } from "../src/full.js";

type Case = {
  name: string;
  dayGanzhi: string;
  shiZhi: string;    // 占时
  yueJiang: string;  // 月将（例子里写“某将”）
  expectSanZhuan: [string, string, string];
};

const cases: Case[] = [
  {
    name: "重审课",
    dayGanzhi: "丁亥",
    shiZhi: "辰",
    yueJiang: "巳",
    expectSanZhuan: ["申", "酉", "戌"],
  },
  {
    name: "元首课",
    dayGanzhi: "丙申",
    shiZhi: "申",
    yueJiang: "未",
    expectSanZhuan: ["卯", "寅", "丑"],
  },
  {
    name: "比用课1",
    dayGanzhi: "壬辰",
    shiZhi: "巳",
    yueJiang: "辰",
    expectSanZhuan: ["戌", "酉", "申"],
  },
  {
    name: "涉害课1(孟仲季)",
    dayGanzhi: "丁卯",
    shiZhi: "丑",
    yueJiang: "亥",
    expectSanZhuan: ["丑", "亥", "酉"],
  },
  {
    name: "遥克·蒿矢",
    dayGanzhi: "壬辰",
    shiZhi: "寅",
    yueJiang: "巳",
    expectSanZhuan: ["戌", "丑", "辰"],
  },
  {
    name: "昂星课(阳)",
    dayGanzhi: "戊寅",
    shiZhi: "子",
    yueJiang: "辰",
    expectSanZhuan: ["丑", "午", "酉"],
  },
  {
    name: "别责课(阳)",
    dayGanzhi: "丙辰",
    shiZhi: "卯",
    yueJiang: "辰",
    expectSanZhuan: ["亥", "午", "午"],
  },
  {
    name: "反吟课(无克)",
    dayGanzhi: "辛丑",
    shiZhi: "巳",
    yueJiang: "亥",
    expectSanZhuan: ["亥", "未", "辰"],
  },
  {
    name: "伏吟课(有克)",
    dayGanzhi: "癸丑",
    shiZhi: "午",
    yueJiang: "午",
    expectSanZhuan: ["丑", "戌", "未"],
  },
  {
    name: "八专课(阳)",
    dayGanzhi: "甲寅",
    shiZhi: "辰",
    yueJiang: "丑",
    expectSanZhuan: ["丑", "亥", "亥"],
  },
  {
    name: "比用课2",
    dayGanzhi: "甲寅",
    shiZhi: "酉",
    yueJiang: "寅",
    expectSanZhuan: ["子", "巳", "戌"],
  },
  {
    name: "比用课3",
    dayGanzhi: "庚子",
    shiZhi: "巳",
    yueJiang: "午",
    expectSanZhuan: ["戌", "巳", "子"],
  },
  {
    name: "涉害课2(孟仲季)",
    dayGanzhi: "庚子",
    shiZhi: "戌",
    yueJiang: "申",
    expectSanZhuan: ["午", "辰", "寅"],
  },
  {
    name: "遥克·弹射",
    dayGanzhi: "壬申",
    shiZhi: "申",
    yueJiang: "亥",
    expectSanZhuan: ["巳", "申", "亥"],
  },
  {
    name: "昂星课(阴)",
    dayGanzhi: "丁亥",
    shiZhi: "寅",
    yueJiang: "巳",
    expectSanZhuan: ["午", "戌", "寅"],
  },
  {
    name: "别责课(阴)",
    dayGanzhi: "辛酉",
    shiZhi: "丑",
    yueJiang: "子",
    expectSanZhuan: ["丑", "酉", "酉"],
  },
  {
    name: "反吟课(有克)",
    dayGanzhi: "庚戌",
    shiZhi: "申",
    yueJiang: "寅",
    expectSanZhuan: ["寅", "申", "寅"],
  },
  {
    name: "伏吟课(阴例3)",
    dayGanzhi: "丁丑",
    shiZhi: "未",
    yueJiang: "未",
    expectSanZhuan: ["丑", "戌", "未"],
  },
  {
    name: "伏吟课(阳例4)",
    dayGanzhi: "壬辰",
    shiZhi: "酉",
    yueJiang: "酉",
    expectSanZhuan: ["亥", "辰", "戌"],
  },
  {
    name: "八专课(阴)",
    dayGanzhi: "丁未",
    shiZhi: "丑",
    yueJiang: "辰",
    expectSanZhuan: ["亥", "戌", "戌"],
  },
];

describe("reference.md examples -> 月将加时构盘", () => {
  for (const c of cases) {
    test(c.name, () => {
      const pan = computeFullPan({ dayGanzhi: c.dayGanzhi, shiZhi: c.shiZhi as any, yueJiang: c.yueJiang as any });
      // 验证三传
      expect(pan.siKeSanZhuan.sanZhuan).toEqual(c.expectSanZhuan);
    });
  }
});
