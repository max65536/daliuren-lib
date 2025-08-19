import fs from 'fs';
import path from 'path';

const ZH_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';

function normalizeLine(line) {
  return line.replace(/\u00A0/g, ' ').replace(/\t/g,' ').replace(/\s+$/,'');
}
function leftHalf(line) {
  // 优先处理“左右两半重复”的行：形如 `X   X`
  const dup = line.match(/^(.*\S)\s+\1\s*$/);
  if (dup) return dup[1].trim();
  // 选取最接近中点的 3+ 空格作为左右栏分隔
  const s = line;
  const gaps = [];
  for (let i = 0; i < s.length; ) {
    if (s[i] === ' ') {
      let j = i;
      while (j < s.length && s[j] === ' ') j++;
      const len = j - i;
      if (len >= 3) gaps.push({ start: i, len });
      i = j;
    } else i++;
  }
  if (gaps.length === 0) return s.trim();
  const mid = s.length / 2;
  gaps.sort((a, b) => Math.abs(a.start + a.len / 2 - mid) - Math.abs(b.start + b.len / 2 - mid));
  const cut = gaps[0].start;
  return s.slice(0, cut).trim();
}
function parseHeader(line) {
  const m = line.match(/^【(.+?)】\s+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,2})局/);
  if (!m) return null;
  const dayGanzhi = m[2];
  const juTxt = m[3];
  let ju = ZH_NUM[juTxt];
  if (!ju) {
    if (juTxt === '十') ju = 10; else if (juTxt.startsWith('十')) ju = 10 + (ZH_NUM[juTxt.slice(1)] || 0);
  }
  return { dayGanzhi, ju };
}
function parseBlock(lines) {
  const nonEmpty = lines.map(leftHalf).map(normalizeLine).map(s=>s.trim()).filter(Boolean);
  if (nonEmpty.length < 8) throw new Error('块内容过短，无法解析');
  // 从底部筛选三传三行：首列为用神（财/官/父/兄/子），第二列含地支
  const sanLines = [];
  for (let i = nonEmpty.length - 1; i >= 0 && sanLines.length < 3; i--) {
    const ln = nonEmpty[i];
    const tokens = ln.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2 && tokens[0].length === 1 && '财官父兄子'.includes(tokens[0])) {
      const gz = tokens[1];
      const zhi = Array.from(gz).find((ch) => ZHI.includes(ch));
      if (zhi) sanLines.push(ln);
    }
  }
  if (sanLines.length !== 3) throw new Error('未能从底部提取到三传三行');
  sanLines.reverse();
  const sanZhuan = sanLines.map((ln) => {
    const tokens = ln.split(/\s+/).filter(Boolean);
    const gz = tokens[1];
    const zhi = Array.from(gz).find((ch) => ZHI.includes(ch));
    return zhi;
  });
  const firstSanIdx = nonEmpty.indexOf(sanLines[0]);
  const tokens = (ln) => ln.split(/\s+/).filter(Boolean);
  const isFour = (ln) => tokens(ln).length === 4;
  const hasGan = (ln) => Array.from(ln).some((ch) => GAN.includes(ch));
  const allZhi = (ln) => tokens(ln).every((t) => Array.from(t).every((ch) => ZHI.includes(ch)));

  let rowDown = null;
  let rowUp = null;
  for (let i = firstSanIdx - 1, seen = 0; i >= 0 && seen < 6; i--, seen++) {
    const ln = nonEmpty[i];
    if (!rowDown && isFour(ln) && hasGan(ln)) {
      rowDown = ln;
      for (let j = i - 1, seen2 = 0; j >= 0 && seen2 < 6; j--, seen2++) {
        const upLn = nonEmpty[j];
        if (isFour(upLn) && allZhi(upLn)) { rowUp = upLn; break; }
      }
      break;
    }
  }
  if (!rowDown || !rowUp) {
    const cand2 = nonEmpty.slice(firstSanIdx - 2, firstSanIdx);
    if (cand2.length !== 2) throw new Error('四课行数量异常');
    const [rowA, rowB] = cand2;
    rowDown = hasGan(rowA) ? rowA : rowB;
    rowUp = hasGan(rowA) ? rowB : rowA;
  }
  const ups = tokens(rowUp);
  const downs = tokens(rowDown);
  if (ups.length !== 4 || downs.length !== 4) throw new Error('四课行需各4个字符');
  // 书面右→左为 [四、三、二、一]，反转为 [一、二、三、四]
  const pairsLR = [0,1,2,3].map((i) => ({ up: ups[i], down: downs[i] }));
  const siKePairs = pairsLR.reverse();
  return { siKePairs, sanZhuan };
}
function parseFile(file, targetJu = 1) {
  const raw = fs.readFileSync(file, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const rawLn of lines) {
    const ln = normalizeLine(rawLn);
    const hdr = parseHeader(ln);
    if (hdr) {
      if (cur) blocks.push(cur);
      cur = { meta: hdr, lines: [] };
      continue;
    }
    if (cur) cur.lines.push(ln);
  }
  if (cur) blocks.push(cur);
  if (blocks.length === 0) throw new Error('未找到任何块');
  const blk = blocks.find(b => b.meta.ju === targetJu) || blocks[0];
  const { siKePairs, sanZhuan } = parseBlock(blk.lines);
  return { dayGanzhi: blk.meta.dayGanzhi, ju: blk.meta.ju, siKePairs, sanZhuan };
}

// main
const file = process.argv[2] || path.resolve('ju/0002-甲子.txt');
const ju = process.argv[3] ? parseInt(process.argv[3], 10) : 1;
const parsed = parseFile(file, ju);
const { computePanByJu } = await import(path.resolve('dist/src/full.js'));
const computed = computePanByJu(parsed.dayGanzhi, parsed.ju);

const fmtPairs = (pairs) => pairs.map(p => `${p.up}/${p.down}`);
const reversePairs = (pairs) => [...pairs].reverse();
const wantPairs = parsed.siKePairs;
const gotPairs = computed.siKePairs;
const wantFmt = fmtPairs(wantPairs);
const gotFmt = fmtPairs(gotPairs);
const gotRevFmt = fmtPairs(reversePairs(gotPairs));

// 规范化四课顺序：
// 若直接相等，使用原顺序；若反转后相等，按反转顺序比较；否则保留原顺序并视为不等。
let usedOrder = 'as-is';
let normComputedPairsFmt = gotFmt;
let matchSiKe = JSON.stringify(wantFmt) === JSON.stringify(gotFmt);
if (!matchSiKe) {
  const revOk = JSON.stringify(wantFmt) === JSON.stringify(gotRevFmt);
  if (revOk) {
    usedOrder = 'reversed';
    normComputedPairsFmt = gotRevFmt;
    matchSiKe = true;
  }
}

const sanWant = parsed.sanZhuan;
const sanGot = computed.siKeSanZhuan.sanZhuan;
const matchSan = sanWant.join('') === sanGot.join('');

const result = {
  file,
  dayGanzhi: parsed.dayGanzhi,
  ju: parsed.ju,
  parsedSanZhuan: parsed.sanZhuan,
  computedSanZhuan: computed.siKeSanZhuan.sanZhuan,
  parsedSiKePairs: wantFmt,
  computedSiKePairs: gotFmt,
  normalizedComputedSiKePairs: normComputedPairsFmt,
  siKeOrderUsed: usedOrder,
  matchSan,
  matchSiKe,
  match: matchSan && matchSiKe,
};
console.log(JSON.stringify(result, null, 2));
