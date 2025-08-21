import fs from 'fs';
import path from 'path';
import { TextDecoder } from 'util';

function decodeBuffer(buf) {
  if (!buf || buf.length === 0) return '';
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buf.subarray(3));
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  }
  // Heuristic for UTF-16 without BOM
  const sampleLen = Math.min(buf.length, 2048);
  let zeros = 0, zeroEven = 0, zeroOdd = 0;
  for (let i = 0; i < sampleLen; i++) {
    if (buf[i] === 0x00) {
      zeros++;
      if ((i & 1) === 0) zeroEven++; else zeroOdd++;
    }
  }
  if (zeros > 64) {
    const enc = zeroEven > zeroOdd ? 'utf-16be' : 'utf-16le';
    return new TextDecoder(enc).decode(buf);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }
}

function normalizeLine(line) {
  return line
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+$/g, '')
    .replace(/\r/g, '');
}

// Mirror header parsing used by scripts/parse_books.mjs
function zhMonthToNum(txt) {
  const ZH_NUM = { '正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };
  if (!txt) return null;
  if (ZH_NUM[txt] != null) return ZH_NUM[txt];
  if (txt === '十') return 10;
  if (txt.startsWith('十')) return 10 + (ZH_NUM[txt.slice(1)] || 0);
  return null;
}

function parseHeaderFromLine(line) {
  const reA = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?([正一二三四五六七八九十]{1,2})月(?:[^，,。]*?)?([子丑寅卯辰巳午未申酉戌亥])将/;
  const reB = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?月(?:[^，,。]*?)?([子丑寅卯辰巳午未申酉戌亥])将/;
  const reC = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?([正一二三四五六七八九十]{1,2})月/;
  let m = line.match(reA);
  let yearGanzhi = null, monthZh = null, monthNum = null, yueJiang = null;
  if (m) {
    yearGanzhi = m[1];
    monthZh = m[2];
    monthNum = zhMonthToNum(monthZh);
    yueJiang = m[3];
  } else {
    const m2 = line.match(reB);
    if (m2) {
      yearGanzhi = m2[1];
      yueJiang = m2[2];
    } else {
      const m3 = line.match(reC);
      if (!m3) return null;
      yearGanzhi = m3[1];
      monthZh = m3[2];
      monthNum = zhMonthToNum(monthZh);
    }
  }
  // Optionally pick up 日/时/旬 for reference (not needed for diff)
  const dayTimeRe = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:日)?(?:[，,、\s]*)?([甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥])时/;
  const mDT = line.match(dayTimeRe);
  const dayGanzhi = mDT ? mDT[1] : null;
  const timeGanzhi = mDT ? mDT[2] : null;
  const mX = line.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])旬/);
  const xun = mX ? mX[1] : null;
  return { yearGanzhi, monthZh, monthNum, yueJiang, dayGanzhi, timeGanzhi, xun, raw: line.trim() };
}

function loadRecognizedForFile(reportsDir, baseName) {
  const p = path.join(reportsDir, baseName.replace(/\.[^/.]+$/, '') + '.json');
  if (!fs.existsSync(p)) return new Set();
  try {
    const obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const set = new Set();
    if (obj && Array.isArray(obj.charts)) {
      for (const c of obj.charts) if (c && c.header) set.add(c.header);
    }
    return set;
  } catch {
    return new Set();
  }
}

function analyzeTriads(lines, headerIndex) {
  const triRe = /([财官父兄子鬼印比])\s+((?:[甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥])|(?:[子丑寅卯辰巳午未申酉戌亥][甲乙丙丁戊己庚辛壬癸]?))(?:\s+[朱蛇勾青空贵后阴玄虎常六龙白])?\s*$/;
  const tailGeneral = /[朱蛇勾青空贵后阴玄虎常六龙白]$/;
  const anyGan = '[甲乙丙丁戊己庚辛壬癸]';
  const anyZhi = '[子丑寅卯辰巳午未申酉戌亥]';
  const revRe = new RegExp('([财官父兄子鬼印比])\\s+(' + anyZhi + anyGan + ')');
  // find end by 断曰/断：
  let endIdx = Math.min(lines.length, headerIndex + 30);
  for (let k = headerIndex + 1; k < Math.min(lines.length, headerIndex + 80); k++) {
    const s = lines[k];
    if (!s) continue;
    if (s.includes('断曰') || /^\s*断\s*[：:]/.test(s)) { endIdx = k; break; }
  }
  const triads = [];
  let hasWhiteTail = false;
  let hasReversedGZ = false;
  for (let j = headerIndex + 1; j < endIdx; j++) {
    const ln = lines[j];
    if (!ln) continue;
    const mm = ln.match(triRe);
    if (mm) {
      triads.push({ index: j, label: mm[1], gz: mm[2] });
      if (/白$/.test(ln)) hasWhiteTail = true;
      if (revRe.test(ln)) hasReversedGZ = true;
    } else {
      if (tailGeneral.test(ln) && /[财官父兄子鬼印比]\s+/.test(ln)) {
        if (/白$/.test(ln)) hasWhiteTail = true;
      }
      if (revRe.test(ln)) hasReversedGZ = true;
    }
  }
  return { endIndex: endIdx, triadsFound: triads.length, triads, flags: { hasWhiteTail, hasReversedGZ } };
}

function main() {
  const booksDir = process.argv[2] || path.resolve('books');
  const reportsDir = process.argv[3] || path.resolve('reports');
  const outPath = process.argv[4] || path.join(reportsDir, 'missing_headers.json');

  const entries = fs.existsSync(booksDir) ? fs.readdirSync(booksDir) : [];
  const result = [];
  let totalCandidates = 0, totalMissing = 0;
  for (const name of entries) {
    const fp = path.join(booksDir, name);
    if (!fs.statSync(fp).isFile()) continue;
    const txt = decodeBuffer(fs.readFileSync(fp));
    const lines = txt.split(/\r?\n/).map(normalizeLine);
    const recognized = loadRecognizedForFile(reportsDir, name);
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;
      const hdr = parseHeaderFromLine(ln);
      if (hdr) candidates.push({ index: i, header: hdr.raw });
    }
    const missing = [];
    for (const c of candidates) {
      if (recognized.has(c.header)) continue;
      const analysis = analyzeTriads(lines, c.index);
      missing.push({ index: c.index, header: c.header, analysis });
    }
    totalCandidates += candidates.length;
    totalMissing += missing.length;
    if (missing.length > 0) {
      result.push({ file: name, totalCandidates: candidates.length, missingCount: missing.length, missing });
    }
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ totalCandidates, totalMissing, files: result }, null, 2), 'utf-8');
  console.log(`Scanned ${entries.length} files. Candidates=${totalCandidates}, Missing=${totalMissing}. Report: ${outPath}`);
}

main();
