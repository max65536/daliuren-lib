import {
  computeFullPan,
  calcGanShang,
  buildTianJiangMap,
  buildTianDiPanBlock,
  buildSiKeBlock,
  buildSanZhuanBlock,
  DIZHI_ORDER,
  GAN_JI_GONG,
  TianGan,
  DiZhi,
} from "../src/index.js";

// 展示：天干寄宫推“干上”
console.log("甲日各局‘干上’（前四局）:");
for (let j = 1; j <= 4; j++) {
  console.log(j, calcGanShang("甲", j));
}

// 也可以直接根据“月将+时支”计算当前属于第几局以及该局的“干上”
const juInfo = calcGanShang("甲", { yueJiang: "未", shiZhi: "申" });
console.log("甲日(申时未将) 局与干上:", juInfo);

// 示例：丙申日，申时，未将
const shiZhi = "申" as const;
const yueJiang = "未" as const;
const dayGanzhi = "丙申" as const;
const dayGan = dayGanzhi[0] as TianGan;

const result = computeFullPan({ dayGanzhi, shiZhi, yueJiang });
console.log("四课(一~四课):", result.siKePairs);
console.log("课型与三传:", result.siKeSanZhuan);

// 仅构建一次天将映射，后续复用
const jiangMap = buildTianJiangMap({ dayGan, shiZhi });

// ===== 美化输出：十二天将环形排布（库 API） =====
const tianDiPanBlock = buildTianDiPanBlock({ dayGan, shiZhi });
tianDiPanBlock.forEach((l) => console.log(l));

console.log("");

// ===== 美化输出：四课（库 API）=====
const siKeBlock = buildSiKeBlock(result.siKePairs as any, { dayGan, shiZhi, jiangMap });
siKeBlock.forEach((l) => console.log(l));

console.log("");

// ===== 美化输出：三传（库 API） =====
const sanZhuanBlock = buildSanZhuanBlock(result.siKeSanZhuan.sanZhuan as any, { dayGan, shiZhi, jiangMap });
sanZhuanBlock.forEach((l) => console.log(l));
