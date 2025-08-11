import { deriveSiKeSanZhuan, pairsFromRows, PlateResolver } from "../src/engine.js";
import { createChainPlateResolver, createCircularPlateResolver } from "../src/plate.js";

type Case = {
  name: string;
  dayGan: string;
  dayZhi: string;
  up: string;
  down: string;
  flags?: Partial<{ isFanYin: boolean; isFuYin: boolean; isIncomplete: boolean; isBaZhuan: boolean }>;
  expect: { kind?: string; sanZhuan: [string, string, string] };
  plate?: PlateResolver; // 若未提供，使用基于期望三传的链式 plate
};

const forward = createCircularPlateResolver("forward");
const backward = createCircularPlateResolver("backward");

const cases: Case[] = [
  {
    name: "重审课",
    dayGan: "丁",
    dayZhi: "亥",
    up: "丑子酉申",
    down: "子亥申丁",
    expect: { sanZhuan: ["申", "酉", "戌"] },
    plate: createChainPlateResolver({ chu: "申", zhong: "酉", mo: "戌" }, forward),
  },
  {
    name: "元首课",
    dayGan: "丙",
    dayZhi: "申",
    up: "午未卯辰",
    down: "未申辰丙",
    expect: { sanZhuan: ["卯", "寅", "丑"] },
    plate: createChainPlateResolver({ chu: "卯", zhong: "寅", mo: "丑" }, backward),
  },
  {
    name: "比用课1",
    dayGan: "壬",
    dayZhi: "辰",
    up: "寅卯酉戌",
    down: "卯辰戌壬",
    expect: { sanZhuan: ["戌", "酉", "申"] },
    plate: createChainPlateResolver({ chu: "戌", zhong: "酉", mo: "申" }, backward),
  },
  {
    name: "涉害课1(孟仲季)",
    dayGan: "丁",
    dayZhi: "卯",
    up: "亥丑卯巳",
    down: "丑卯巳丁",
    expect: { sanZhuan: ["丑", "亥", "酉"] },
    plate: createChainPlateResolver({ chu: "丑", zhong: "亥", mo: "酉" }, backward),
  },
  {
    name: "遥克·蒿矢",
    dayGan: "壬",
    dayZhi: "辰",
    up: "戌未巳寅",
    down: "未辰寅壬",
    expect: { sanZhuan: ["戌", "丑", "辰"] },
    plate: createChainPlateResolver({ chu: "戌", zhong: "丑", mo: "辰" }, forward),
  },
  {
    name: "昂星课(阳)",
    dayGan: "戊",
    dayZhi: "寅",
    up: "戌午丑酉",
    down: "午寅酉戊",
    expect: { sanZhuan: ["丑", "午", "酉"] },
    plate: {
      shangShen(sym) {
        if (sym === "酉") return "丑"; // 地盘酉宫上神
        if (sym === "寅") return "午"; // 支上
        if (sym === "戊") return "酉"; // 干上
        return forward.shangShen(sym);
      },
    },
  },
  {
    name: "别责课(阳)",
    dayGan: "丙",
    dayZhi: "辰",
    up: "午巳未午",
    down: "巳辰午丙",
    flags: { isIncomplete: true },
    expect: { sanZhuan: ["亥", "午", "午"] },
    plate: createChainPlateResolver({ chu: "亥", zhong: "午", mo: "午" }, forward),
  },
  {
    name: "反吟课(无克)",
    dayGan: "辛",
    dayZhi: "丑",
    up: "丑未戌辰",
    down: "未丑辰辛",
    flags: { isFanYin: true },
    expect: { sanZhuan: ["亥", "未", "辰"] },
    plate: {
      shangShen(sym) {
        if (sym === "丑") return "未"; // 支上
        if (sym === "辛") return "辰"; // 干上
        return forward.shangShen(sym);
      },
    },
  },
  {
    name: "伏吟课(有克)",
    dayGan: "癸",
    dayZhi: "丑",
    up: "丑丑丑丑",
    down: "丑丑丑癸",
    flags: { isFuYin: true },
    expect: { sanZhuan: ["丑", "戌", "未"] },
    plate: {
      shangShen(sym) {
        // 此例由相刑推进决定中末传，此处保持默认
        return forward.shangShen(sym);
      },
    },
  },
  {
    name: "八专课(阳)",
    dayGan: "甲",
    dayZhi: "寅",
    up: "申亥申亥",
    down: "亥寅亥甲",
    flags: { isBaZhuan: true },
    expect: { sanZhuan: ["丑", "亥", "亥"] },
    plate: {
      shangShen(sym) {
        // 干上=亥；从亥顺两位到丑
        if (sym === "甲") return "亥"; // 干上
        if (sym === "亥") return "子"; // 顺一步
        if (sym === "子") return "丑"; // 顺第二步 -> 初传
        return forward.shangShen(sym);
      },
    },
  },
];

function run() {
  let pass = 0;
  for (const c of cases) {
    const plate = c.plate ?? createChainPlateResolver({ chu: c.expect.sanZhuan[0] as any, zhong: c.expect.sanZhuan[1] as any, mo: c.expect.sanZhuan[2] as any }, forward);
    const r = deriveSiKeSanZhuan({
      dayGan: c.dayGan as any,
      dayZhi: c.dayZhi as any,
      siKe: pairsFromRows(c.up, c.down),
      plate,
      ...(c.flags || {}),
    });
    const got: [string, string, string] = [String(r.chu), String(r.zhong), String(r.mo)];
    const ok = JSON.stringify(got) === JSON.stringify(c.expect.sanZhuan);
    if (ok) pass++;
    console.log(`${ok ? "✅" : "❌"} ${c.name} -> ${got.join("、")} ${ok ? "" : `!= ${c.expect.sanZhuan.join("、")}`}`);
  }
  console.log(`\nPassed ${pass}/${cases.length}`);
}

run();
