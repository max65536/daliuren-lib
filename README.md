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

#### 新增：十二天将按“昼夜起贵 + 下神定顺逆”铺入十二支

```ts
import { buildTianJiangMap, listTianJiang, buildTianJiangAbbrMap, listTianJiangAbbr } from "daliuren-lib";

// 例如：午时（属昼）→ 起贵于丑，丑属亥~辰半圈 → 顺排
const map = buildTianJiangMap({ shiZhi: "午" });
// map["丑"] === "贵人"，map["寅"] === "螣蛇"，...，依次顺行

// 例如：子时（属夜）→ 起贵于未，未属巳~戌半圈 → 逆排
const pairs = listTianJiang({ shiZhi: "子" });
// 返回子→亥顺序的 [地支, 天将] 列表，便于展示

// 简称：贵蛇朱合勾龙空虎常玄阴后
const abbrMap = buildTianJiangAbbrMap({ shiZhi: "午" });
const abbrPairs = listTianJiangAbbr({ shiZhi: "子" });
```

### API

- `calcGanShang(gan: TianGan, ju: number): DiZhi`
  - 逻辑：
    - 第1局为“天干寄宫”；
    - 第n局从寄宫起，按地支序逆行 n-1 位（寅→丑→子→亥→...）。

- `calcGanShang(gan: TianGan, { yueJiang, shiZhi })`
  - 用途：根据“月将加时”的天/地盘相对位置，直接求出“当前干上”与“属于第几局”。
  - 返回：`{ ju, ganShang }`

- `parseDayGanzhi(dayGanzhi)`：解析首两个汉字为干支并校验。

### 新增：四课三传推导引擎

- `deriveSiKeSanZhuan(input: DeriveInput): DeriveResult`
  - 依据 flowchart.md（按 reference.md）实现了反吟/伏吟/别责/八专/贼克/比用/涉害/遥克/昂星 的判课与三传推导流程（定义对齐：别责=仅三课，八专=仅两课）。
  - 需要你提供“天盘取上神”的方法（`PlateResolver`），以及四课（`siKe`）本身。
  - 这是为解耦“构盘”和“判课”而设计：当你在上层构出天地盘与四课后，可将其喂给该引擎得到三传。
  - 细节调整（与书例对齐）：
    - 反吟：若四课有任一克（上克下/下贼上），直接按常规规则取传；无克时为“驿马→支上→干上”。
    - 常规（多处贼克）：候选按“下贼上”优先于“上克下”；对同类候选先去重；比用优先“同阴阳”，若“同阴阳”多于一位，交由“涉害（孟/仲/季）”裁决。
    - 伏吟无克：避免末传重复；若末传等于初传，取中冲。

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
  - 自动判定反吟/伏吟（yueJiang 与 shiZhi 冲/同位）、不全课（仅三课→别责）、八专（仅两课；多见由干支同位导致）

示例：

```ts
import { computeFullPan } from "daliuren-lib";

const pan = computeFullPan({ dayGanzhi: "甲寅", shiZhi: "辰", yueJiang: "丑" });
console.log(pan.siKePairs);        // 四课上/下神对（按一~四课）
console.log(pan.siKeSanZhuan);     // 课型与三传
```

### 仅凭“日干支 + 局数”起四课三传

- `computePanByJu(dayGanzhi: string, ju: number)`：
  - 用“局”确定天/地盘的相对偏移（固定顺行偏移），从而构造四课并判课。
  - 不依赖月将/时支。
  - 简化映射：`ju=1` 视为伏吟，`ju=7` 视为反吟（用于对齐本书例示）。

示例：

```ts
import { computePanByJu } from "daliuren-lib";
const r = computePanByJu("丙申", 3);
console.log(r.siKePairs);
console.log(r.siKeSanZhuan);
```

### 天干寄宫

- 甲寄寅，乙寄辰，丙寄巳，丁寄未，戊寄巳，
- 己寄未，庚寄申，辛寄戌，壬寄亥，癸寄丑。

### 流程图

基于 reference.md 的判课/取传流程图见 `flowchart.md`（Mermaid）。

### 新增：美化输出 API（展示用）

- `buildTianDiPanBlock({ dayGan, shiZhi }): string[]`
  - 返回 6 行字符串，按“昼夜起贵 + 下神定顺逆”将十二天将环形铺入十二支的展示块。

- `buildSiKeBlock(siKePairs, { dayGan, shiZhi, jiangMap? }): string[]`
  - 返回三行字符串：上将简称行、四课上神行、四课下神行；显示顺序为书面“右→左”（四、三、二、一）。
  - 可传入已构建的 `jiangMap` 以避免重复计算。

- `buildSanZhuanBlock(sanZhuan, { dayGan, shiZhi, jiangMap? }): string[]`
  - 返回三行字符串：预留六亲、干(若为干)/支、地支、上将简称。若为地支则第二列留空。
  - 可传入已构建的 `jiangMap` 以避免重复计算。

示例：

```ts
import { computeFullPan, buildTianJiangMap, buildTianDiPanBlock, buildSiKeBlock, buildSanZhuanBlock } from 'daliuren-lib';

const dayGanzhi = '丙申';
const shiZhi = '申';
const yueJiang = '未';
const dayGan = dayGanzhi[0] as any;

const pan = computeFullPan({ dayGanzhi, shiZhi, yueJiang });
const jiangMap = buildTianJiangMap({ dayGan, shiZhi }); // 构建一次，复用

buildTianDiPanBlock({ dayGan, shiZhi }).forEach(l => console.log(l));
console.log('');
buildSiKeBlock(pan.siKePairs, { dayGan, shiZhi, jiangMap }).forEach(l => console.log(l));
console.log('');
buildSanZhuanBlock(pan.siKeSanZhuan.sanZhuan, { dayGan, shiZhi, jiangMap }).forEach(l => console.log(l));
```
