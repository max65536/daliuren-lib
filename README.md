## daliuren-lib

一个前端可直接调用的大六壬排盘轻量库（TypeScript）。

当前已实现：
- 天干寄宫映射
- 从寄宫起第一局，按地支逆序推移求第 n 局的「干上」

四课三传：
- 暂为占位，需你确认所用起课/传课规则后补全（见下文“需要你提供”）。

### 安装与构建

该仓库为本地库，直接 `tsc` 构建：

```
npm run build
```

产物输出至 `dist/`。

### 使用示例

```ts
import { computePan, calcGanShang } from "daliuren-lib";

// 例：甲子日第1/2/3局的「干上」应为 寅/丑/子
console.log(calcGanShang("甲", 1)); // 寅
console.log(calcGanShang("甲", 2)); // 丑
console.log(calcGanShang("甲", 3)); // 子

// 完整接口：输入日干支与第几局
const r = computePan("甲子", 3);
// r => { gan: '甲', zhi: '子', ju: 3, ganShang: '子', siKeSanZhuan: {...} }
```

### API

- `computePan(dayGanzhi: string, ju: number): PanResult`
  - 输入：日干支（如 `"甲子"`）与第几局（1–12）
  - 返回：日干、日支、局号、以及计算出的「干上」；`siKeSanZhuan` 目前为占位。

- `calcGanShang(gan: TianGan, ju: number): DiZhi`
  - 逻辑：
    - 第1局为“天干寄宫”；
    - 第n局从寄宫起，按地支序逆行 n-1 位（寅→丑→子→亥→...）。

- `parseDayGanzhi(dayGanzhi)`：解析首两个汉字为干支并校验。

### 天干寄宫

按你提供的规则：
- 甲寄寅，乙寄辰，丙寄午，丁寄未，戊寄辰，
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
