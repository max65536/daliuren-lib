## daliuren-lib

一个前端可直接调用的大六壬排盘轻量库（TypeScript）。

当前已实现：
- 天干寄宫映射
- 从寄宫起第一局，按地支逆序推移求第 n 局的「干上」

### 安装与构建

该仓库为本地库，直接 `tsc` 构建：

```
npm run build
```

产物输出至 `dist/`。

### 使用示例

```ts
import { computeFullPan, calcGanShang } from "daliuren-lib";

// 例：甲日第1/2/3局的「干上」
console.log(calcGanShang("甲", 1)); // 寅
console.log(calcGanShang("甲", 2)); // 丑
console.log(calcGanShang("甲", 3)); // 子

// 端到端：月将+时支构盘→四课→三传
const pan = computeFullPan({ dayGanzhi: "丙申", shiZhi: "申", yueJiang: "未" });
console.log(pan.siKePairs);
console.log(pan.siKeSanZhuan);
```

### API

- `calcGanShang(gan: TianGan, ju: number): DiZhi`
  - 逻辑：
    - 第1局为“天干寄宫”；
    - 第n局从寄宫起，按地支序逆行 n-1 位（寅→丑→子→亥→...）。

- `parseDayGanzhi(dayGanzhi)`：解析首两个汉字为干支并校验。

### 新增：四课三传推导引擎

- `deriveSiKeSanZhuan(input: DeriveInput): DeriveResult`
  - 依据 flowchart.md（按 reference.md）实现了反吟/伏吟/别责/八专/贼克/比用/涉害/遥克/昂星 的判课与三传推导流程。
  - 需要你提供“天盘取上神”的方法（`PlateResolver`），以及四课（`siKe`）本身。
  - 这是为解耦“构盘”和“判课”而设计：当你在上层构出天地盘与四课后，可将其喂给该引擎得到三传。

示例使用（伪盘，仅演示接口）：

```ts
import { deriveSiKeSanZhuan } from "daliuren-lib";

const plate = {
  shangShen(sym: string) {
    // 示例：简单把地支顺序后移一位；天干先寄宫到地支再后移一位
    const D = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
    const GAN_JI_GONG: Record<string,string> = {甲:"寅",乙:"辰",丙:"午",丁:"未",戊:"辰",己:"未",庚:"申",辛:"戌",壬:"亥",癸:"丑"};
    const asZhi = D.includes(sym) ? sym : GAN_JI_GONG[sym];
    const i = D.indexOf(asZhi);
    return D[(i+1)%12];
  },
};

const result = deriveSiKeSanZhuan({
  dayGan: "甲",
  dayZhi: "子",
  // 四课：上神/下神对，示例仅演示结构
  siKe: [
    { up: "丑", down: "子" },
    { up: "卯", down: "甲" },
    { up: "酉", down: "申" },
    { up: "申", down: "丁" },
  ],
  plate,
  // 根据构盘结果判定以下标志位（若有）：
  isFanYin: false,
  isFuYin: false,
});
console.log(result);
```

### 端到端：月将+时支构盘→四课→三传

- `buildPlate({ yueJiang, shiZhi })`：以“月将加时”布天盘，月将在占时宫位之上，天/地盘地支均顺行。
- `computeFullPan({ dayGanzhi, shiZhi, yueJiang })`：依你提供的规则生成四课并判课：
  - 一课下=日干，上=其寄宫所在宫的上神
  - 二课下=一课上；四课下=三课上
  - 三课下=日支，上=其宫位上神
  - 四课上神均取对应宫位的天盘上神
  - 自动判定反吟/伏吟（yueJiang 与 shiZhi 冲/同位）、不全课（四上神出现重复）、八专（干支同位：日干寄宫=日支）

示例：

```ts
import { computeFullPan } from "daliuren-lib";

const pan = computeFullPan({ dayGanzhi: "甲寅", shiZhi: "辰", yueJiang: "丑" });
console.log(pan.siKePairs);        // 四课上/下神对（按一~四课）
console.log(pan.siKeSanZhuan);     // 课型与三传
```

### 天干寄宫

按你提供的规则：
- 甲寄寅，乙寄辰，丙寄巳，丁寄未，戊寄巳，
- 己寄未，庚寄申，辛寄戌，壬寄亥，癸寄丑。

### 需要你提供（以便实现四课三传）

大六壬不同流派在“四课三传”有细节差异。请确认：
- 起课法：是否采用“入式法/涉害法/分贵法/三传多寡取用”等哪一套？
- 三传取法：如系“用神取传/发用取传/支辰涉害”具体规则与优先级？
- 是否需要纳甲/地盘天盘/贵神、八门、神煞等一并给出，或仅要四课三传结果？
- 输入是否还应包含时辰（多见以日时起课），当前只输入“日干支”。

提供上述细则后，我会在此库内补全 `siKeSanZhuan` 的完整计算流程与类型定义。

### 流程图

基于 reference.md 的判课/取传流程图见 `flowchart.md`（Mermaid）。
