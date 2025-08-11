import { DiZhi, DlError, TianGan } from "./types.js";
import {
  WuXing,
  WUXING_OF_GAN,
  WUXING_OF_ZHI,
  ke,
  wuXingOfSymbol,
  yinYangOfGan,
  compareYinYang,
  yiMaOf,
  xingOf,
  nextXing,
} from "./rules.js";

export type SymbolLike = DiZhi | TianGan; // 本引擎中“神”可以为地支或天干

export interface KePair {
  up: SymbolLike; // 上神
  down: SymbolLike; // 下神
}

export interface PlateResolver {
  // 返回某个神的“上神”（用于中/末传递推）。
  // 注意：日干取上神时，仍按干本身五行定“比/克”，但上神的取得依具体天盘实现。
  shangShen(sym: SymbolLike): SymbolLike;
}

export interface DeriveInput {
  dayGan: TianGan;
  dayZhi: DiZhi;
  siKe: [KePair, KePair, KePair, KePair];
  plate: PlateResolver;
  // 特殊格局，由构盘方根据“月将/时辰”判出后传入
  isFanYin?: boolean; // 反吟：月将与占时相冲
  isFuYin?: boolean; // 伏吟：月将与占时相同
  isIncomplete?: boolean; // 不全，仅三课
  isBaZhuan?: boolean; // 八专：干支同位，仅两课
}

export interface DeriveResult {
  kind:
    | "重审课"
    | "元首课"
    | "比用课"
    | "涉害课"
    | "蒿矢课"
    | "弹射课"
    | "昂星课"
    | "别责课"
    | "反吟课"
    | "伏吟课"
    | "八专课";
  chu: SymbolLike;
  zhong: SymbolLike;
  mo: SymbolLike;
  detail: string; // 简短说明依据
}

function relation(up: SymbolLike, down: SymbolLike): "上克下" | "下贼上" | "无克" {
  const wuUp = wuXingOfSymbol(up);
  const wuDown = wuXingOfSymbol(down);
  if (ke(wuUp, wuDown)) return "上克下";
  if (ke(wuDown, wuUp)) return "下贼上";
  return "无克";
}

function countRelations(siKe: KePair[]) {
  let shangKeXia = 0;
  let xiaZeShang = 0;
  const tags: Array<"上克下" | "下贼上" | "无克"> = [];
  for (const p of siKe) {
    const r = relation(p.up, p.down);
    tags.push(r);
    if (r === "上克下") shangKeXia++;
    else if (r === "下贼上") xiaZeShang++;
  }
  return { shangKeXia, xiaZeShang, tags };
}

function hasYaoKeWithDayGan(up: SymbolLike, dayGan: TianGan): "上神遥克日干" | "日干遥克上神" | "无" {
  const wuUp = wuXingOfSymbol(up);
  const wuGan = WUXING_OF_GAN[dayGan];
  if (ke(wuUp, wuGan)) return "上神遥克日干";
  if (ke(wuGan, wuUp)) return "日干遥克上神";
  return "无";
}

function nextByShang(resolver: PlateResolver, a: SymbolLike): SymbolLike {
  return resolver.shangShen(a);
}

function chooseFromYaoKe(siKe: KePair[], dayGan: TianGan): { kind: "蒿矢课" | "弹射课" | "昂星课"; chu: SymbolLike } {
  const ups = siKe.map((p) => p.up);
  const yaoTags = ups.map((u) => hasYaoKeWithDayGan(u, dayGan));
  const idxUp = yaoTags
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t === "上神遥克日干")
    .map((x) => x.i);
  if (idxUp.length > 0) {
    // 若多于1个，取与日干“比”（同阴阳）者
    const pick =
      idxUp.find((i) => compareYinYang(dayGan, ups[i])) ?? idxUp[0];
    return { kind: "蒿矢课", chu: ups[pick] };
  }
  const idxDown = yaoTags
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t === "日干遥克上神")
    .map((x) => x.i);
  if (idxDown.length > 0) {
    const pick =
      idxDown.find((i) => compareYinYang(dayGan, ups[i])) ?? idxDown[0];
    return { kind: "弹射课", chu: ups[pick] };
  }
  // 否则 -> 昂星
  return { kind: "昂星课", chu: ups[0] };
}

function deriveRegular(input: DeriveInput): DeriveResult {
  const { siKe, dayGan, plate, dayZhi } = input;
  const { shangKeXia, xiaZeShang, tags } = countRelations(siKe);

  // 若仅有一处“下贼上”，按重审课处理（示例：可同时存在一处上克下）
  if (xiaZeShang === 1) {
    const idx = tags.findIndex((t) => t === "下贼上");
    const chu = siKe[idx].up; // 受克之神（上神）
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind: "重审课", chu, zhong, mo, detail: "存在下贼上：取受克之神为初传" };
  }

  if (shangKeXia + xiaZeShang === 0) {
    // 无贼克 -> 遥克/昂星
    const { kind, chu } = chooseFromYaoKe(siKe, dayGan);
    if (kind === "昂星课") {
      // 昂星课分阳/阴日两套
      const yang = yinYangOfGan(dayGan) === "阳";
      let chuA: SymbolLike;
      if (yang) {
        // 阳：取地盘酉宫上神（等价于宫位“酉”的上神）
        chuA = plate.shangShen("酉");
      } else {
        // 阴：取天盘“酉”之下神 => 在天盘映射中，值为“酉”的宫位。
        const tian = (plate as any).tianpan as Record<DiZhi, DiZhi> | undefined;
        if (tian) {
          const entry = Object.entries(tian).find(([, up]) => up === "酉");
          chuA = (entry ? (entry[0] as DiZhi) : (plate.shangShen("酉") as DiZhi));
        } else {
          chuA = plate.shangShen("酉");
        }
      }
      const zhong = yang ? plate.shangShen(dayZhi) : plate.shangShen(dayGan);
      const mo = yang ? plate.shangShen(dayGan) : plate.shangShen(dayZhi);
      return { kind: "昂星课", chu: chuA, zhong, mo, detail: "无贼克且无遥克，按昂星课取传（阳/阴日分流）" };
    }
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind, chu, zhong, mo, detail: kind === "蒿矢课" ? "四课无贼克，取上神遥克日干者发用" : "四课无贼克，取日干遥克之上神发用" };
  }

  if (shangKeXia === 1 && xiaZeShang === 0) {
    // 无下贼上且仅一处上克下 => 元首课
    const idx = tags.findIndex((t) => t === "上克下");
    const chu = siKe[idx].up;
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind: "元首课", chu, zhong, mo, detail: "仅一处上克下：取其为初传" };
  }

  // ≥2处贼克 -> 比用/涉害
  // 比用：取与日干阴阳相同者为初传；若俱比或俱不比，转涉害
  const indices: number[] = [];
  const candidates: SymbolLike[] = [];
  siKe.forEach((p, i) => {
    if (tags[i] !== "无克") {
      candidates.push(p.up);
      indices.push(i);
    }
  });
  const sameYY = candidates.filter((c) => compareYinYang(dayGan, c));
  const diffYY = candidates.filter((c) => !compareYinYang(dayGan, c));
  if (sameYY.length > 0 && diffYY.length > 0) {
    const chu = sameYY[0];
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind: "比用课", chu, zhong, mo, detail: "多处贼克，取与日干同阴阳者发用" };
  }
  // 涉害（孟仲季法）：按“候选上神所对应地盘(下神)”的 孟→仲→季 类别取其上神
  const groupOf = (z: DiZhi): 0 | 1 | 2 | 3 => {
    if (["寅", "申", "巳", "亥"].includes(z)) return 0; // 孟
    if (["子", "午", "卯", "酉"].includes(z)) return 1; // 仲
    if (["辰", "戌", "丑", "未"].includes(z)) return 2; // 季
    return 3;
  };
  // 查 plate 的天盘映射以求“某上神对应的地盘（下神）”
  const tian = (plate as any).tianpan as Record<DiZhi, DiZhi> | undefined;
  const palaceOfUp = (u: SymbolLike): DiZhi | undefined => {
    if (!tian) return undefined;
    const ent = Object.entries(tian).find(([, up]) => up === u);
    return ent ? (ent[0] as DiZhi) : undefined;
    };
  const candWithGroup: Array<{ up: SymbolLike; grp: number }> = candidates.map((u, idx) => {
    const palace = palaceOfUp(u);
    const grp = palace ? groupOf(palace) : 99;
    return { up: u, grp };
  });
  candWithGroup.sort((a, b) => a.grp - b.grp);
  const chuFromPool = (candWithGroup[0]?.up) ?? candidates[0];
  const zhong = nextByShang(plate, chuFromPool);
  const mo = nextByShang(plate, zhong);
  return { kind: "涉害课", chu: chuFromPool, zhong, mo, detail: "多处贼克且比用无法区分，按孟→仲→季取发用" };
}

export function deriveSiKeSanZhuan(input: DeriveInput): DeriveResult {
  const { siKe, dayGan, dayZhi, plate } = input;

  // 反吟
  if (input.isFanYin) {
    const { shangKeXia, xiaZeShang } = countRelations(siKe);
    if (shangKeXia + xiaZeShang > 0) {
      return deriveRegular(input);
    }
    const chu = yiMaOf(dayZhi);
    const zhong = plate.shangShen(dayZhi); // 支上
    const mo = plate.shangShen(dayGan); // 干上
    return { kind: "反吟课", chu, zhong, mo, detail: "反吟且四课无克，取驿马→支上→干上" };
  }

  // 伏吟
  if (input.isFuYin) {
    const { shangKeXia, xiaZeShang } = countRelations(siKe);
    if (shangKeXia + xiaZeShang > 0) {
      // 有克：初依克取；中取初刑，末取中刑（含自刑/中冲回退）
      const base = deriveRegular(input);
      const chu = base.chu as DiZhi; // 假定为地支
      let zhong: SymbolLike = nextXing(chu) ?? plate.shangShen(chu);
      // 初传自刑时，中取支上
      if (zhong === chu) {
        zhong = plate.shangShen(dayZhi);
      }
      let mo: SymbolLike = nextXing(zhong as DiZhi) ?? plate.shangShen(zhong);
      // 中传又自刑，末取中冲
      if (mo === (zhong as DiZhi)) {
        // 中冲：取与中传相冲
        const ORDER: DiZhi[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
        const idx = ORDER.indexOf(zhong as DiZhi);
        mo = ORDER[(idx + 6) % 12];
      }
      return { kind: "伏吟课", chu: base.chu, zhong, mo, detail: "伏吟有克：初依克取，中取初刑，末取中刑" };
    }
    // 无克：不取遥克。阳：干上→初刑→中刑；阴：支上→初刑→中刑
    const yang = yinYangOfGan(dayGan) === "阳";
    const first = yang ? plate.shangShen(dayGan) : plate.shangShen(dayZhi);
    let zhong: SymbolLike = nextXing(first as DiZhi) ?? plate.shangShen(first);
    // 如初传自刑，取支上神为中传
    if (zhong === first) {
      zhong = plate.shangShen(dayZhi);
    }
    let mo: SymbolLike = nextXing(zhong as DiZhi) ?? plate.shangShen(zhong);
    // 若中传又自刑，取中冲为末传
    if (mo === (zhong as DiZhi)) {
      const ORDER: DiZhi[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
      const idx = ORDER.indexOf(zhong as DiZhi);
      mo = ORDER[(idx + 6) % 12];
    }
    return { kind: "伏吟课", chu: first, zhong, mo, detail: "伏吟无克：不取遥克，阳干上/阴支上为初传" };
  }

  // 别责（不全三课且无上下克又无遥克）
  if (input.isIncomplete) {
    const { shangKeXia, xiaZeShang } = countRelations(siKe);
    const ups = siKe.map((p) => p.up);
    const yao = ups.some((u) => hasYaoKeWithDayGan(u, dayGan) !== "无");
    if (shangKeXia + xiaZeShang === 0 && !yao) {
      if (yinYangOfGan(dayGan) === "阳") {
        // 阳：取干合上神为初传
        // 合干的寄宫上神由 plate 决定，调用者需在 plate 层提供
        const partnerUp = plate.shangShen((({ 甲: "己", 乙: "庚", 丙: "辛", 丁: "壬", 戊: "癸", 己: "甲", 庚: "乙", 辛: "丙", 壬: "丁", 癸: "戊" } as any)[dayGan]) as TianGan);
        const ganUp = plate.shangShen(dayGan);
        const zhong = ganUp;
        const mo = ganUp;
        return { kind: "别责课", chu: partnerUp, zhong, mo, detail: "别责：阳日取干合上神为初传，中末取干上神" };
      } else {
        // 阴：取支前三合为初传（按顺时针下一位），初传取该宫“下神”（地支）
        const triPrev = ((z: DiZhi) => {
          const t = [["申", "子", "辰"], ["亥", "卯", "未"], ["寅", "午", "戌"], ["巳", "酉", "丑"]] as DiZhi[][];
          const g = t.find((g) => g.includes(z))!;
          const i = g.indexOf(z);
          return g[(i + 1) % 3] as DiZhi;
        })(dayZhi);
        const chu = triPrev;
        const ganUp = plate.shangShen(dayGan);
        const zhong = ganUp;
        const mo = ganUp;
        return { kind: "别责课", chu, zhong, mo, detail: "别责：阴日取支前三合为初传，中末取干上神" };
      }
    }
  }

  // 八专：由外部判定或根据输入特征判定；此处按标志位
  if (input.isBaZhuan) {
    if (yinYangOfGan(dayGan) === "阳") {
      // 阳：干上神在天盘顺数三位为初传（plate 层实现）
      const ORDER: DiZhi[] = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
      const ganShang = plate.shangShen(dayGan) as DiZhi;
      const idx = ORDER.indexOf(ganShang);
      // 从干上开始“顺数三位”（含起点）=> 向前移动2位
      const chu = ORDER[(idx + 2) % 12];
      const zhong = ganShang; // 中末传俱用干上神
      const mo = ganShang;
      return { kind: "八专课", chu, zhong, mo, detail: "八专：阳日干上顺数三位为初传" };
    } else {
      // 阴：以第四课上神逆数三神为初传；中末取干上
      const fourthUp = siKe[3].up;
      const ORDER: DiZhi[] = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
      const idx = ORDER.indexOf(fourthUp as DiZhi);
      // 逆数三神（含起点）=> 向后移动2位
      const chu = ORDER[(idx - 2 + 12) % 12];
      const ganShang = plate.shangShen(dayGan);
      const zhong = ganShang;
      const mo = ganShang;
      return { kind: "八专课", chu, zhong, mo, detail: "八专：阴日以第四课上神逆数三神为初传" };
    }
  }

  // 常规
  return deriveRegular(input);
}

// 行含义（按你确认）：
// - 第1行：四课上神、三课上神、二课上神、一课上神（从左到右）
// - 第2行：四课下神、三课下神、二课下神、一课下神（从左到右）
// 且：三课下神=日支，一课下神=日干。
// 本库内部按 [一课, 二课, 三课, 四课] 的顺序存储。
export function pairsFromRows(row1: string, row2: string): [KePair, KePair, KePair, KePair] {
  const upLR = Array.from(row1.trim());   // [K4.up, K3.up, K2.up, K1.up]
  const downLR = Array.from(row2.trim()); // [K4.down, K3.down, K2.down, K1.down]
  if (upLR.length !== 4 || downLR.length !== 4) {
    throw new DlError("四课行需各4个字符，形如：上行'丑子酉申' 下行'子亥申丁'");
  }
  const rev = [0, 1, 2, 3].map((i) => ({ up: upLR[i] as any, down: downLR[i] as any })); // [K4, K3, K2, K1]
  const ordered = rev.reverse() as [KePair, KePair, KePair, KePair]; // -> [K1, K2, K3, K4]
  return ordered;
}
