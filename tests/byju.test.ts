import { computeFullPan } from "../src/full.js";
import { calcGanShang, parseDayGanzhi } from "../src/core.js";
import type { DiZhi } from "../src/types.js";

describe("computePanByJu consistency with computeFullPan via ju inferred from (yueJiang, shiZhi)", () => {
  const cases = [
    { dayGanzhi: "丙申", shiZhi: "申" as DiZhi, yueJiang: "未" as DiZhi }, // 元首课例
    { dayGanzhi: "丁卯", shiZhi: "丑" as DiZhi, yueJiang: "亥" as DiZhi }, // 涉害例1
    { dayGanzhi: "戊寅", shiZhi: "子" as DiZhi, yueJiang: "辰" as DiZhi }, // 昂星阳例
  ];

  for (const c of cases) {
    test(`${c.dayGanzhi} | ${c.shiZhi}时 ${c.yueJiang}将`, () => {
      const { gan } = parseDayGanzhi(c.dayGanzhi);
      const juInfo = calcGanShang(gan, { yueJiang: c.yueJiang, shiZhi: c.shiZhi });
      const pan1 = computeFullPan({ dayGanzhi: c.dayGanzhi, shiZhi: c.shiZhi, yueJiang: c.yueJiang });
      // 用推得的 ju 走 computePanByJu，应与 computeFullPan 的三传一致
      const { computePanByJu } = require("../src/full.js");
      const pan2 = computePanByJu(c.dayGanzhi, juInfo.ju);
      expect(pan2.ju).toBe(juInfo.ju);
      expect(pan2.siKeSanZhuan.sanZhuan).toEqual(pan1.siKeSanZhuan.sanZhuan);
    });
  }
});

