export type TianGan =
  | "甲" | "乙" | "丙" | "丁" | "戊"
  | "己" | "庚" | "辛" | "壬" | "癸";

export type DiZhi =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";

export interface InputParams {
  /** 日干支，例如："甲子"、"丁未"。允许前后有空白，会自动裁剪 */
  dayGanzhi: string;
  /** 第几局（1-12 的正整数） */
  ju: number;
}

export interface SiKeSanZhuan {
  /** 课型名称 */
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
  /** 三传 */
  sanZhuan: [string, string, string];
  /** 简要说明 */
  note?: string;
}

export interface PanResult {
  /** 日干，例如 "甲" */
  gan: TianGan;
  /** 日支，例如 "子" */
  zhi: DiZhi;
  /** 第几局 */
  ju: number;
  /** 干上所临地支（以天干寄宫为第一局起点，按逆序推移） */
  ganShang: DiZhi;
  /** 四课三传（占位，待补规则） */
  siKeSanZhuan: SiKeSanZhuan;
}

export class DlError extends Error {}
