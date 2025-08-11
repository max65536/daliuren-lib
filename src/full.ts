import { DiZhi, PanResult, TianGan } from "./types.js";
import { parseDayGanzhi, GAN_JI_GONG, DIZHI_ORDER } from "./core.js";
import { PlateResolver, KePair, deriveSiKeSanZhuan } from "./engine.js";
import { oppositeZhi, ke, wuXingOfSymbol } from "./rules.js";

export interface Plate extends PlateResolver {
  /** 天盘：每个地支宫位上的上神（地支）*/
  tianpan: Record<DiZhi, DiZhi>;
}

export interface BuildPlateParams {
  yueJiang: DiZhi; // 月将（以地支标识）
  shiZhi: DiZhi; // 占时（地支）
}

export function buildPlate({ yueJiang, shiZhi }: BuildPlateParams): Plate {
  const idxShi = DIZHI_ORDER.indexOf(shiZhi);
  const idxYJ = DIZHI_ORDER.indexOf(yueJiang);
  // 令天盘在“占时”宫位的上神为“月将”，其余按顺行填布
  const tianpan: Record<DiZhi, DiZhi> = {} as any;
  for (let i = 0; i < 12; i++) {
    const palace = DIZHI_ORDER[i];
    const offset = (i - idxShi + 12) % 12; // 从“占时”起，顺行 offset 位
    const up = DIZHI_ORDER[(idxYJ + offset) % 12];
    tianpan[palace] = up;
  }
  const plate: Plate = {
    tianpan,
    shangShen(sym) {
      // 地支：直接取该宫位的上神；天干：以寄宫落座后取该宫位的上神
      const palace: DiZhi = (DIZHI_ORDER as unknown as string[]).includes(sym as string)
        ? (sym as DiZhi)
        : GAN_JI_GONG[sym as TianGan];
      return tianpan[palace];
    },
  };
  return plate;
}

export interface BuildSiKeParams {
  dayGanzhi: string; // 日干支（如 甲子）
  shiZhi: DiZhi; // 占时
  yueJiang: DiZhi; // 月将
}

export interface FullPanResult extends PanResult {
  /** 四课（按一、二、三、四课顺序）*/
  siKePairs: [KePair, KePair, KePair, KePair];
}

export function computeFullPan({ dayGanzhi, shiZhi, yueJiang }: BuildSiKeParams): FullPanResult {
  const { gan, zhi } = parseDayGanzhi(dayGanzhi);
  const plate = buildPlate({ yueJiang, shiZhi });

  // 一课：下=日干，上=其寄宫所在宫的上神
  const k1_down = gan;
  const k1_up = plate.shangShen(k1_down) as DiZhi;
  // 二课：下=一课上，上=该宫位上神
  const k2_down = k1_up;
  const k2_up = plate.shangShen(k2_down) as DiZhi;
  // 三课：下=日支，上=该宫位上神
  const k3_down = zhi;
  const k3_up = plate.shangShen(k3_down) as DiZhi;
  // 四课：下=三课上，上=该宫位上神
  const k4_down = k3_up;
  const k4_up = plate.shangShen(k4_down) as DiZhi;

  const siKePairs: [KePair, KePair, KePair, KePair] = [
    { up: k1_up, down: k1_down },
    { up: k2_up, down: k2_down },
    { up: k3_up, down: k3_down },
    { up: k4_up, down: k4_down },
  ];

  // 反吟/伏吟
  const isFanYin = oppositeZhi(shiZhi) === yueJiang;
  const isFuYin = shiZhi === yueJiang;

  // 不全课：四个上神中有重复则为不全
  const ups = [k1_up, k2_up, k3_up, k4_up];
  const isIncomplete = new Set(ups).size < 4;

  // 八专：干支同位 + 仅两课 + 上下无克
  const isGanZhiSame = GAN_JI_GONG[gan] === zhi;
  const pairKey = (p: KePair) => `${p.up}-${p.down}`;
  const uniquePairs = new Set(siKePairs.map(pairKey));
  const noKe = siKePairs.every((p) => {
    const upX = wuXingOfSymbol(p.up);
    const downX = wuXingOfSymbol(p.down);
    return !ke(upX, downX) && !ke(downX, upX);
  });
  const isBaZhuan = isGanZhiSame && noKe;

  const derived = deriveSiKeSanZhuan({
    dayGan: gan,
    dayZhi: zhi,
    siKe: siKePairs,
    plate,
    isFanYin,
    isFuYin,
    isIncomplete,
    isBaZhuan,
  });

  return {
    gan,
    zhi,
    ju: 1, // 与旧接口兼容字段（此处不涉及“局”，暂置 1）
    ganShang: plate.shangShen(gan) as DiZhi,
    siKeSanZhuan: {
      kind: derived.kind,
      sanZhuan: [String(derived.chu), String(derived.zhong), String(derived.mo)] as [string, string, string],
      note: derived.detail,
    },
    siKePairs,
  };
}
