import { computeFullPan, calcGanShang, listTianJiang, buildTianJiangMap, DIZHI_ORDER, GAN_JI_GONG } from "../src/index.js";

// 展示：天干寄宫推“干上”
console.log("甲日各局‘干上’（前四局）:");
for (let j = 1; j <= 4; j++) {
  console.log(j, calcGanShang("甲", j));
}

// 也可以直接根据“月将+时支”计算当前属于第几局以及该局的“干上”
const juInfo = calcGanShang("甲", { yueJiang: "未", shiZhi: "申" });
console.log("甲日(申时未将) 局与干上:", juInfo);

// 展示：以“月将加时”构盘 → 四课 → 判课（三传）+ 十二天将
// 例：丙申日，申时，未将（来自 reference.md 元首课示例）
const shiZhi = "申" as const;
const yueJiang = "未" as const;
const result = computeFullPan({ dayGanzhi: "丙申", shiZhi, yueJiang });
console.log("四课(一~四课):", result.siKePairs);
console.log("课型与三传:", result.siKeSanZhuan);

// 十二天将（昼夜起贵 + 下神定顺逆）
// ===== 美化输出：十二天将环形排布 =====
const ring = (() => {
  const pairs = listTianJiang({ shiZhi });
  const m: Record<string, string> = Object.fromEntries(pairs);
  const top = ["巳", "午", "未", "申"].map((z) => m[z]).join(" ");
  const topZ = ["巳", "午", "未", "申"].join(" ");
  const bottomZ = ["寅", "丑", "子", "亥"].join(" ");
  const bottom = ["寅", "丑", "子", "亥"].map((z) => m[z]).join(" ");
  const leftTop = m["辰"] + "辰";
  const leftBottom = m["卯"] + "卯";
  const rightTop = "酉" + m["酉"];
  const rightBottom = "戌" + m["戌"];
  const lineWidth = ("  " + top).length;
  const padBetween = (l: string, r: string) => {
    const spaces = Math.max(1, lineWidth - l.length - r.length);
    return l + " ".repeat(spaces) + r;
  };
  return [
    "  " + top,
    "  " + topZ,
    padBetween(leftTop, rightTop),
    padBetween(leftBottom, rightBottom),
    "  " + bottomZ,
    "  " + bottom,
  ];
})();
ring.forEach((l) => console.log(l));

console.log("");

// ===== 美化输出：四课（上将 / 上神 / 下神）=====
// 注意：一课→四课应从右到左展示（左起为四→三→二→一）
const siKeBlock = (() => {
  const abbrMap = buildTianJiangMap({ shiZhi });
  const ups = result.siKePairs.map((p) => p.up as any as "子"|"丑"|"寅"|"卯"|"辰"|"巳"|"午"|"未"|"申"|"酉"|"戌"|"亥");
  const downs = result.siKePairs.map((p) => String(p.down));
  const order = [3, 2, 1, 0]; // 显示顺序：四、三、二、一（右端为一课）
  const jiang = order.map((i) => abbrMap[ups[i]]);
  const row1 = "  " + jiang.join(" ");
  const row2 = "  " + order.map((i) => String(ups[i])).join(" ");
  const row3 = "  " + order.map((i) => String(downs[i])).join(" ");
  return [row1, row2, row3];
})();
siKeBlock.forEach((l) => console.log(l));

console.log("");

// ===== 美化输出：三传（干/支/将） =====
const sanZhuanBlock = (() => {
  const abbrMap = buildTianJiangMap({ shiZhi });
  type DZ = "子"|"丑"|"寅"|"卯"|"辰"|"巳"|"午"|"未"|"申"|"酉"|"戌"|"亥";
  const rows = result.siKeSanZhuan.sanZhuan.map((sym) => {
    const isZhi = (DIZHI_ORDER as string[]).includes(sym);
    const gan = isZhi ? "" : sym; // 若为干，则显示于第2列
    const palace = (isZhi ? sym : (GAN_JI_GONG as any)[sym]) as DZ;
    const jiang = abbrMap[palace];
    // 形如："  丙 寅 蛇"（第1列预留六亲位，暂空）
    return "  " + ["", gan || palace, palace, jiang]
      .filter((_, i) => i !== 1 || gan) // 若无干，则让第二列留空，第三列为地支
      .join(" ")
      .replace(/^\s+/, "  ");
  });
  return rows;
})();
sanZhuanBlock.forEach((l) => console.log(l));
