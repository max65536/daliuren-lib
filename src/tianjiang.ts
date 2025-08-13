import { DiZhi, TianGan } from "./types.js";
import { DIZHI_ORDER } from "./core.js";

// 十二天将固定次序（仅用简称）。
// 全称对照（注释，仅供参考）：
// 贵(贵人) 蛇(螣蛇) 朱(朱雀) 合(六合) 勾(勾陈) 龙(青龙)
// 空(天空) 虎(白虎) 常(太常) 玄(玄武) 阴(太阴) 后(天后)
export const TIAN_JIANG_ORDER = [
  "贵", "蛇", "朱", "合", "勾", "龙", "空", "虎", "常", "玄", "阴", "后",
] as const;

export type TianJiang = typeof TIAN_JIANG_ORDER[number]; // 简称类型

/** 卯~申为昼，酉~寅为夜 */
export function isDaytime(shiZhi: DiZhi): boolean {
  return ("卯辰巳午未申" as string).includes(shiZhi);
}

/**
 * 日干 + 昼夜 起贵所附之支（起宫）
 * 你提供的规则表：
 * | 日干   | 昼贵（卯-申时） | 夜贵（酉-寅时） |
 * |--------|------------------|------------------|
 * | 甲戊庚 | 丑               | 未               |
 * | 乙己   | 子               | 申               |
 * | 丙丁   | 亥               | 酉               |
 * | 壬癸   | 巳               | 卯               |
 * | 辛     | 午               | 寅               |
 */
export function startPalaceByGanAndDayNight(dayGan: TianGan, shiZhi: DiZhi): DiZhi {
  const DAY_START_BY_GAN: Record<TianGan, DiZhi> = {
    "甲": "丑", "乙": "子", "丙": "亥", "丁": "亥", "戊": "丑",
    "己": "子", "庚": "丑", "辛": "午", "壬": "巳", "癸": "巳",
  };
  const NIGHT_START_BY_GAN: Record<TianGan, DiZhi> = {
    "甲": "未", "乙": "申", "丙": "酉", "丁": "酉", "戊": "未",
    "己": "申", "庚": "未", "辛": "寅", "壬": "卯", "癸": "卯",
  };
  const daytime = isDaytime(shiZhi);
  return (daytime ? DAY_START_BY_GAN : NIGHT_START_BY_GAN)[dayGan];
}

/**
 * 顺逆规则：看“贵人所附之支”的下神（即该宫位地支）
 * - 若在 亥→辰（亥、子、丑、寅、卯、辰）之内：顺排
 * - 若在 巳→戌（巳、午、未、申、酉、戌）之内：逆排
 */
export function directionByLowerSpirit(palace: DiZhi): "forward" | "backward" {
  const forwardHalf: DiZhi[] = ["亥", "子", "丑", "寅", "卯", "辰"];
  return forwardHalf.includes(palace) ? "forward" : "backward";
}

export interface BuildTianJiangParams {
  dayGan: TianGan; // 日干（新增）
  shiZhi: DiZhi;   // 占时地支（用于昼夜)
}

/**
 * 按“日干+昼夜起贵 + 下神定顺逆”将十二天将铺入十二支。
 * 返回 Record<地支, 天将>
 */
export function buildTianJiangMap({ dayGan, shiZhi }: BuildTianJiangParams): Record<DiZhi, TianJiang> {
  const startPalace = startPalaceByGanAndDayNight(dayGan, shiZhi);
  const dir = directionByLowerSpirit(startPalace);
  const step = dir === "forward" ? 1 : -1;

  const startIdx = DIZHI_ORDER.indexOf(startPalace);
  const map: Record<DiZhi, TianJiang> = {} as any;
  for (let i = 0; i < 12; i++) {
    const palace = DIZHI_ORDER[(startIdx + i * step + 12 * 12) % 12];
    map[palace] = TIAN_JIANG_ORDER[i];
  }
  return map;
}

/** 便捷：返回按子→亥顺序的 [地支, 天将] 列表，便于展示 */
export function listTianJiang(params: BuildTianJiangParams): Array<[DiZhi, TianJiang]> {
  const m = buildTianJiangMap(params);
  return DIZHI_ORDER.map((z) => [z, m[z]] as [DiZhi, TianJiang]);
}

// 兼容性别名：当前即为简称，保持 API 不变
// 过去的 *Abbr* API 已合并到上述函数中：现在默认即返回简称。
