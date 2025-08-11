import { DiZhi, TianGan } from "./types.js";

export type WuXing = "金" | "木" | "水" | "火" | "土";
export type YinYang = "阳" | "阴";

export const WUXING_OF_ZHI: Record<DiZhi, WuXing> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
};

export const WUXING_OF_GAN: Record<TianGan, WuXing> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

export const YINYANG_OF_GAN: Record<TianGan, YinYang> = {
  甲: "阳",
  乙: "阴",
  丙: "阳",
  丁: "阴",
  戊: "阳",
  己: "阴",
  庚: "阳",
  辛: "阴",
  壬: "阳",
  癸: "阴",
};

export function ke(a: WuXing, b: WuXing): boolean {
  return (
    (a === "木" && b === "土") ||
    (a === "土" && b === "水") ||
    (a === "水" && b === "火") ||
    (a === "火" && b === "金") ||
    (a === "金" && b === "木")
  );
}

export function oppositeZhi(z: DiZhi): DiZhi {
  const order: DiZhi[] = [
    "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
  ];
  const i = order.indexOf(z);
  return order[(i + 6) % 12];
}

export function yinYangOfGan(g: TianGan): YinYang {
  return YINYANG_OF_GAN[g];
}

export function wuXingOfSymbol(sym: DiZhi | TianGan): WuXing {
  // 若是天干，按干本身定五行，不以寄宫论
  if ((WUXING_OF_GAN as any)[sym]) return WUXING_OF_GAN[sym as TianGan];
  return WUXING_OF_ZHI[sym as DiZhi];
}

export function isZiXing(z: DiZhi): boolean {
  return z === "辰" || z === "午" || z === "酉" || z === "亥";
}

export function xingOf(z: DiZhi): DiZhi[] {
  // 返回与 z 构成“刑”的另一方（或自刑）
  if (z === "子") return ["卯"];
  if (z === "卯") return ["子"];
  if (z === "寅" || z === "巳" || z === "申") return ["巳", "申", "寅"].filter((x) => x !== z) as DiZhi[];
  if (z === "丑" || z === "戌" || z === "未") return ["丑", "戌", "未"].filter((x) => x !== z) as DiZhi[];
  // 自刑组：辰午酉亥
  if (z === "辰" || z === "午" || z === "酉" || z === "亥") return [z];
  return [];
}

export function yiMaOf(z: DiZhi): DiZhi {
  // 申子辰→寅；寅午戌→申；巳酉丑→亥；亥卯未→巳
  if (["申", "子", "辰"].includes(z)) return "寅";
  if (["寅", "午", "戌"].includes(z)) return "申";
  if (["巳", "酉", "丑"].includes(z)) return "亥";
  return "巳"; // 亥卯未
}

export function triadOf(z: DiZhi): DiZhi[] {
  if (["申", "子", "辰"].includes(z)) return ["申", "子", "辰"];
  if (["巳", "酉", "丑"].includes(z)) return ["巳", "酉", "丑"];
  if (["亥", "卯", "未"].includes(z)) return ["亥", "卯", "未"];
  return ["寅", "午", "戌"]; // 寅午戌
}

export function prevInTriadClockwise(z: DiZhi): DiZhi {
  // “前”=顺时针的下一位
  const t = triadOf(z);
  const i = t.indexOf(z);
  return t[(i + 1) % 3];
}

export function ganHePartner(g: TianGan): TianGan {
  // 天干五合：甲己、乙庚、丙辛、丁壬、戊癸
  const map: Record<TianGan, TianGan> = {
    甲: "己",
    乙: "庚",
    丙: "辛",
    丁: "壬",
    戊: "癸",
    己: "甲",
    庚: "乙",
    辛: "丙",
    壬: "丁",
    癸: "戊",
  } as const;
  return map[g];
}

export function compareYinYang(a: TianGan, b: DiZhi | TianGan): boolean {
  const ya = yinYangOfGan(a);
  const yb = (WUXING_OF_GAN as any)[b] ? yinYangOfGan(b as TianGan) : (// 地支按阴阳：子寅辰午申戌为阳；丑卯巳未酉亥为阴
    (["子", "寅", "辰", "午", "申", "戌"] as DiZhi[]).includes(b as DiZhi) ? "阳" : "阴"
  );
  return ya === yb;
}

