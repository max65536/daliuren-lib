import { computeFullPan, calcGanShang } from "../src/index.js";

// 展示：天干寄宫推“干上”
console.log("甲日各局‘干上’（前四局）:");
for (let j = 1; j <= 4; j++) {
  console.log(j, calcGanShang("甲", j));
}

// 也可以直接根据“月将+时支”计算当前属于第几局以及该局的“干上”
const juInfo = calcGanShang("甲", { yueJiang: "未", shiZhi: "申" });
console.log("甲日(申时未将) 局与干上:", juInfo);

// 展示：以“月将加时”构盘 → 四课 → 判课（三传）
// 例：丙申日，申时，未将（来自 reference.md 元首课示例）
const result = computeFullPan({ dayGanzhi: "丙申", shiZhi: "申", yueJiang: "未" });
console.log("四课(一~四课):", result.siKePairs);
console.log("课型与三传:", result.siKeSanZhuan);
