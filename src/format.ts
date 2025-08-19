import { DiZhi, TianGan } from "./types.js";
import { DIZHI_ORDER, GAN_JI_GONG } from "./core.js";
import { buildTianJiangMap, TianJiang } from "./tianjiang.js";

export interface BuildBlocksParams {
  dayGan: TianGan;
  shiZhi: DiZhi;
}

/**
 * 构造“十二天将环形排布”的 6 行字符串块（与 examples 中展示一致）。
 * 返回 6 行：
 *   1)  右上四宫天将简称
 *   2)  右上四宫地支
 *   3)  左/右上边（地支+天将）
 *   4)  左/右下边（地支+天将）
 *   5)  右下四宫地支
 *   6)  右下四宫天将简称
 */
export function buildTianDiPanBlock({ dayGan, shiZhi }: BuildBlocksParams): string[] {
  const jiangMap = buildTianJiangMap({ dayGan, shiZhi });
  const m = jiangMap as Record<DiZhi, TianJiang>;
  const topZ = ["巳", "午", "未", "申"] as DiZhi[];
  const bottomZ = ["寅", "丑", "子", "亥"] as DiZhi[];
  const top = topZ.map((z) => m[z]).join(" ");
  const topLineZ = topZ.join(" ");
  const bottomLineZ = bottomZ.join(" ");
  const bottom = bottomZ.map((z) => m[z]).join(" ");
  const leftTop = `${m["辰"]}辰`;
  const leftBottom = `${m["卯"]}卯`;
  const rightTop = `酉${m["酉"]}`;
  const rightBottom = `戌${m["戌"]}`;
  const lineWidth = ("  " + top).length;
  const padBetween = (l: string, r: string) => {
    const spaces = Math.max(1, lineWidth - l.length);
    return l + " ".repeat(spaces) + r;
  };
  return [
    "  " + top,
    "  " + topLineZ,
    padBetween(leftTop, rightTop),
    padBetween(leftBottom, rightBottom),
    "  " + bottomLineZ,
    "  " + bottom,
  ];
}

export interface KePairLike { up: DiZhi | TianGan; down: DiZhi | TianGan; }

/**
 * 四课美化输出（三行：上将/上神/下神）。
 * - 显示顺序为书面“右→左”（四、三、二、一）。
 * - jiangMap 可复用外部构建的映射，未提供则内部按 dayGan/shiZhi 生成。
 */
export function buildSiKeBlock(
  siKePairs: KePairLike[],
  { dayGan, shiZhi, jiangMap }: BuildBlocksParams & { jiangMap?: Record<DiZhi, TianJiang> }
): string[] {
  const m = jiangMap || buildTianJiangMap({ dayGan, shiZhi });
  const ups = siKePairs.map((p) => p.up as DiZhi);
  const downs = siKePairs.map((p) => String(p.down));
  const order = [3, 2, 1, 0];
  const jiang = order.map((i) => m[ups[i] as DiZhi]);
  const row1 = "  " + jiang.join(" ");
  const row2 = "  " + order.map((i) => String(ups[i])).join(" ");
  const row3 = "  " + order.map((i) => String(downs[i])).join(" ");
  return [row1, row2, row3];
}

/**
 * 三传美化输出（三行：预留六亲/干(若为干)/支/将）。
 * - 若为地支：第二列留空，第三列为地支；
 * - 若为天干：第二列显示天干，第三列为寄宫支；
 */
export function buildSanZhuanBlock(
  sanZhuan: Array<DiZhi | TianGan>,
  { dayGan, shiZhi, jiangMap }: BuildBlocksParams & { jiangMap?: Record<DiZhi, TianJiang> }
): string[] {
  const m = jiangMap || buildTianJiangMap({ dayGan, shiZhi });
  const rows = sanZhuan.map((sym) => {
    const isZhi = (DIZHI_ORDER as string[]).includes(sym as string);
    const gan = isZhi ? "" : (sym as TianGan);
    const palace = (isZhi ? sym : (GAN_JI_GONG as any)[sym]) as DiZhi;
    const jiang = m[palace];
    return (
      "  " +
      ["", gan || (palace as string), palace, jiang]
        .filter((_, i) => i !== 1 || gan)
        .join(" ")
        .replace(/^\s+/, "  ")
    );
  });
  return rows;
}

