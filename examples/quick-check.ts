import { calcGanShang, computePan } from "../src/index.js";

console.log("甲子日各局干上（前四局）:");
for (let j = 1; j <= 4; j++) {
  console.log(j, calcGanShang("甲", j));
}

console.log("完整接口:", computePan("甲子", 3));

