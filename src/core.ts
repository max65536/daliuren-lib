import { DiZhi, DlError, PanResult, SiKeSanZhuan, TianGan } from "./types.js";

export const DIZHI_ORDER: DiZhi[] = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
];

const GAN_SET = new Set<string>([
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸",
]);
const ZHI_SET = new Set<string>([
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
]);

/** 天干寄宫映射 */
export const GAN_JI_GONG: Record<TianGan, DiZhi> = {
  // 甲寄寅，乙寄辰，丙寄午，丁寄未，戊寄辰，己寄未，庚寄申，辛寄戌，壬寄亥，癸寄丑
  "甲": "寅",
  "乙": "辰",
  "丙": "巳",
  "丁": "未",
  "戊": "巳",
  "己": "未",
  "庚": "申",
  "辛": "戌",
  "壬": "亥",
  "癸": "丑",
};

function normGanzhi(input: string): string {
  return input.trim();
}

/** 解析日干支（前两字为干支） */
export function parseDayGanzhi(dayGanzhi: string): { gan: TianGan; zhi: DiZhi } {
  const s = normGanzhi(dayGanzhi);
  if (s.length < 2) throw new DlError("日干支需至少包含两个汉字，例如：甲子");
  const gan = s[0];
  const zhi = s[1];
  if (!GAN_SET.has(gan)) throw new DlError(`无法识别日干：${gan}`);
  if (!ZHI_SET.has(zhi)) throw new DlError(`无法识别日支：${zhi}`);
  return { gan: gan as TianGan, zhi: zhi as DiZhi };
}

/**
 * 计算“干上”的地支：
 * - 第1局为：天干寄宫
 * - 第n局为：在地支序中自寄宫向逆序推移 n-1 位
 */
export function calcGanShang(gan: TianGan, ju: number): DiZhi {
  if (!Number.isInteger(ju) || ju < 1 || ju > 12) {
    throw new DlError("第几局需为 1-12 的整数");
  }
  const start = GAN_JI_GONG[gan];
  const startIdx = DIZHI_ORDER.indexOf(start);
  const idx = (startIdx - (ju - 1) + 12) % 12;
  return DIZHI_ORDER[idx];
}

/** 四课三传占位实现：待提供具体流派规则后补充 */
export function buildSiKeSanZhuan(): SiKeSanZhuan {
  return {
    kind: "昂星课",
    sanZhuan: ["TODO", "TODO", "TODO"],
    note:
      "占位：请使用 deriveSiKeSanZhuan(新API) 基于四课和天盘计算三传。",
  };
}

export function computePan(dayGanzhi: string, ju: number): PanResult {
  const { gan, zhi } = parseDayGanzhi(dayGanzhi);
  const ganShang = calcGanShang(gan, ju);
  const siKeSanZhuan = buildSiKeSanZhuan();
  return { gan, zhi, ju, ganShang, siKeSanZhuan };
}
