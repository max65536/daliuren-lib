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
  if (yaoTags.includes("上神遥克日干")) {
    const idx = yaoTags.findIndex((t) => t === "上神遥克日干");
    return { kind: "蒿矢课", chu: ups[idx] };
  }
  if (yaoTags.includes("日干遥克上神")) {
    const idx = yaoTags.findIndex((t) => t === "日干遥克上神");
    return { kind: "弹射课", chu: ups[idx] };
  }
  // 若有多候选或都无，交由昂星课
  return { kind: "昂星课", chu: ups[0] };
}

function deriveRegular(input: DeriveInput): DeriveResult {
  const { siKe, dayGan, plate, dayZhi } = input;
  const { shangKeXia, xiaZeShang, tags } = countRelations(siKe);

  if (shangKeXia + xiaZeShang === 0) {
    // 无贼克 -> 遥克/昂星
    const { kind, chu } = chooseFromYaoKe(siKe, dayGan);
    if (kind === "昂星课") {
      // 昂星课分阳/阴日两套
      const yang = yinYangOfGan(dayGan) === "阳";
      const chuA = yang ? plate.shangShen("酉") : plate.shangShen("酉"); // 阳取地盘酉宫上神；阴取天盘酉下神（此处需由 plate 决定实现）
      // 暂按 plate.shangShen("酉") 作为抽象：实际由 plate 层区分天/地盘
      const zhong = yang ? plate.shangShen(dayZhi) : plate.shangShen(dayGan);
      const mo = yang ? plate.shangShen(dayGan) : plate.shangShen(dayZhi);
      return { kind: "昂星课", chu: chuA, zhong, mo, detail: "无贼克且无遥克，按昂星课取传（阳/阴日分流）" };
    }
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind, chu, zhong, mo, detail: kind === "蒿矢课" ? "四课无贼克，取上神遥克日干者发用" : "四课无贼克，取日干遥克之上神发用" };
  }

  if (shangKeXia + xiaZeShang === 1) {
    // 贼克课：区分重审/元首
    const idx = tags.findIndex((t) => t !== "无克");
    const tag = tags[idx];
    if (tag === "下贼上") {
      const chu = siKe[idx].up; // 以受克之神为初传 => 上神受克
      const zhong = nextByShang(plate, chu);
      const mo = nextByShang(plate, zhong);
      return { kind: "重审课", chu, zhong, mo, detail: "四课有一处下贼上，取受克之神为初传" };
    } else {
      const chu = siKe[idx].up; // 上克下者为初传
      const zhong = nextByShang(plate, chu);
      const mo = nextByShang(plate, zhong);
      return { kind: "元首课", chu, zhong, mo, detail: "四课仅一处上克下，取上克下者为初传" };
    }
  }

  // ≥2处贼克 -> 比用/涉害
  // 比用：取与日干阴阳相同者为初传；若俱比或俱不比，转涉害
  const candidates: SymbolLike[] = [];
  siKe.forEach((p, i) => {
    if (tags[i] !== "无克") candidates.push(p.up);
  });
  const sameYY = candidates.filter((c) => compareYinYang(dayGan, c));
  const diffYY = candidates.filter((c) => !compareYinYang(dayGan, c));
  if (sameYY.length > 0 && diffYY.length > 0) {
    const chu = sameYY[0];
    const zhong = nextByShang(plate, chu);
    const mo = nextByShang(plate, zhong);
    return { kind: "比用课", chu, zhong, mo, detail: "多处贼克，取与日干同阴阳者发用" };
  }
  // 涉害（孟仲季法）——此处依赖外部传入或 plate 的分类；本实现用近似：优先取四孟，再四仲，再四季。
  const seq: DiZhi[] = ["寅", "申", "巳", "亥", "子", "午", "卯", "酉", "辰", "戌", "丑", "未"]; // 孟→仲→季顺序
  const pool = candidates.filter((c) => (WUXING_OF_ZHI as any)[c]);
  const chuFromPool = pool.sort((a, b) => seq.indexOf(a as DiZhi) - seq.indexOf(b as DiZhi))[0] ?? candidates[0];
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
      const chu = base.chu as DiZhi; // 刑以地支为主，若为天干，需外部映射其所在地支
      const x1 = (typeof chu === "string" ? xingOf(chu as DiZhi) : []) as DiZhi[];
      let zhong: SymbolLike = x1[0] ?? plate.shangShen(chu);
      // 初传自刑时，中取支上
      if (x1.length === 1 && x1[0] === chu) {
        zhong = plate.shangShen(dayZhi);
      }
      const x2 = xingOf(zhong as DiZhi);
      let mo: SymbolLike = x2[0] ?? plate.shangShen(zhong);
      // 中传又自刑，末取中冲
      if (x2.length === 1 && x2[0] === (zhong as DiZhi)) {
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
    const xs = xingOf(first as DiZhi);
    const zhong = xs[0] ?? plate.shangShen(first);
    const xs2 = xingOf(zhong as DiZhi);
    const mo = xs2[0] ?? plate.shangShen(zhong);
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
        const zhong = plate.shangShen(partnerUp);
        const mo = plate.shangShen(zhong);
        return { kind: "别责课", chu: partnerUp, zhong, mo, detail: "别责：阳日取干合上神为初传" };
      } else {
        // 阴：取支前三合为初传（按顺时针下一位）
        const triPrev = ((z: DiZhi) => {
          const t = [["申", "子", "辰"], ["亥", "卯", "未"], ["寅", "午", "戌"], ["巳", "酉", "丑"]] as DiZhi[][];
          const g = t.find((g) => g.includes(z))!;
          const i = g.indexOf(z);
          return g[(i + 1) % 3] as DiZhi;
        })(dayZhi);
        const chu = plate.shangShen(triPrev);
        const zhong = plate.shangShen(chu);
        const mo = plate.shangShen(zhong);
        return { kind: "别责课", chu, zhong, mo, detail: "别责：阴日取支前三合为初传" };
      }
    }
  }

  // 八专：由外部判定或根据输入特征判定；此处按标志位
  if (input.isBaZhuan) {
    if (yinYangOfGan(dayGan) === "阳") {
      // 阳：干上神在天盘顺数三位为初传（plate 层实现）
      const base = plate.shangShen(dayGan);
      const step1 = plate.shangShen(base);
      const step2 = plate.shangShen(step1);
      const chu = step2;
      const zhong = plate.shangShen(dayGan);
      const mo = plate.shangShen(dayGan);
      return { kind: "八专课", chu, zhong, mo, detail: "八专：阳日干上顺数三位为初传" };
    } else {
      // 阴：以第四课上神逆数三神为初传；中末取干上
      const fourthUp = siKe[3].up;
      // 逆数三神：此处用三次“逆上神”，需由 plate 提供逆映射；退而求其次用三次上神替代，调用方按需实现
      const step1 = plate.shangShen(fourthUp);
      const step2 = plate.shangShen(step1);
      const step3 = plate.shangShen(step2);
      const chu = step3;
      const zhong = plate.shangShen(dayGan);
      const mo = plate.shangShen(dayGan);
      return { kind: "八专课", chu, zhong, mo, detail: "八专：阴日以第四课上神逆数三神为初传" };
    }
  }

  // 常规
  return deriveRegular(input);
}

