import fs from 'fs';
import path from 'path';
import { TextDecoder } from 'util';

const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const ZH_NUM = { '正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };

function decodeText(filePath) {
  const buf = fs.readFileSync(filePath);
  return decodeBuffer(buf);
}

function decodeBuffer(buf) {
  if (!buf || buf.length === 0) return '';
  // BOM-based detection first
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buf.subarray(3));
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  }
  // Heuristic: lots of 0x00 bytes => UTF-16; decide endianness by position
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
  // Try strict UTF-8 first
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (_) {
    // Fallback to GB18030 (superset of GBK) if available
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch (e2) {
      // Last resort: permissive UTF-8
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

function leftHalf(line) {
  const dup = line.match(/^(.*\S)\s+\1\s*$/);
  if (dup) return dup[1].trim();
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

function tokens(ln) {
  return ln.split(/\s+/).filter(Boolean);
}

function isFour(ln) {
  return tokens(ln).length === 4;
}

function hasGan(ln) {
  return Array.from(ln).some((ch) => GAN.includes(ch));
}

function allZhi(ln) {
  const ts = tokens(ln);
  if (ts.length !== 4) return false;
  return ts.every((t) => Array.from(t).every((ch) => ZHI.includes(ch)));
}

function zhMonthToNum(txt) {
  if (!txt) return null;
  if (ZH_NUM[txt] != null) return ZH_NUM[txt];
  // e.g. 十一, 十二, or 十三(极少)
  if (txt === '十') return 10;
  if (txt.startsWith('十')) return 10 + (ZH_NUM[txt.slice(1)] || 0);
  return null;
}

// Title line: like "八、昴  星  课" or "十二、八  专  课"
// Only up to 十二
function parseTitleFromLine(line) {
  const m = line.match(/^\s*(十[一二]?|[正一二三四五六七八九十])\s*[、．\.]\s*(.*\S)\s*$/);
  if (!m) return null;
  const numTxt = m[1];
  const num = zhMonthToNum(numTxt);
  if (!num || num < 1 || num > 12) return null;
  const title = m[2];
  return { num, numTxt, title, raw: line.trim() };
}

function parseHeaderFromLine(line) {
  // Examples we handle:
  // A) "辛巳九月寒露辰将"
  // B) "庚寅年七月处暑巳将"
  // C) "己丑年月寅将"（无具体月序）
  // D) 无“将”而含年/月/日/时，如：
  //    "庚寅年五月甲寅日丁卯时，因天气亢旱，闻鸠鸣，占一课……"
  // D) 「……，乙未日己卯时，甲午旬」同行或后续行补齐日时旬
  // 支持“正月”作为一月
  const reA = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?([正一二三四五六七八九十]{1,2})月(?:[^，,。]*?)?([子丑寅卯辰巳午未申酉戌亥])将/;
  const reB = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?月(?:[^，,。]*?)?([子丑寅卯辰巳午未申酉戌亥])将/;
  // 年+具体月，但不带“将”字
  const reC = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:年)?([一二三四五六七八九十]{1,2})月/;
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
      // 无“将”，yueJiang 置空
    }
  }
  // Try to parse 日干支与时辰（可选，可能无“日”字）
  let dayGanzhi = null;
  let timeGanzhi = null;
  const dayTimeRe = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:日)?(?:[，,、\s]*)?([甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥])时/;
  const m2 = line.match(dayTimeRe);
  if (m2) {
    dayGanzhi = m2[1];
    timeGanzhi = m2[2];
  }
  // 旬（可选）
  let xun = null;
  const xunRe = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])旬/;
  const m3 = line.match(xunRe);
  if (m3) xun = m3[1];
  return { yearGanzhi, monthZh, monthNum, yueJiang, dayGanzhi, timeGanzhi, xun, raw: line.trim() };
}

function findTriadInLine(ln) {
  // Look for patterns like: "财 壬辰 勾" or "鬼 乙酉 后" or "兄 辛卯 青"
  // Flexible: 将名可无，用神+干支必须有
  // Some sources abbreviate generals as single chars; occasionally use 龙(青龙)或白(白虎)
  // Also allow label “比” seen in某些课类（知一/涉害等）
  // Accept 干支顺序正反皆可（如 壬辰 或 辰壬）
  const re = /([财官父兄子鬼印比])\s+((?:[甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥])|(?:[子丑寅卯辰巳午未申酉戌亥][甲乙丙丁戊己庚辛壬癸]?))(?:\s+[朱蛇勾青空贵后阴玄虎常六龙白])?\s*$/;
  const m = ln.match(re);
  if (!m) return null;
  const label = m[1];
  const gz = m[2];
  const zhi = Array.from(gz).find((ch) => ZHI.includes(ch));
  return { label, gz, zhi };
}

function parseAround(lines, idxFirstSan, idxsSan) {
  // Find rowDown (含天干) and rowUp (全地支)
  let rowDown = null;
  let rowUp = null;
  for (let i = idxFirstSan - 1, seen = 0; i >= 0 && seen < 6; i--, seen++) {
    const ln = lines[i];
    if (!rowDown && isFour(ln) && hasGan(ln)) {
      rowDown = { idx: i, ln };
      for (let j = i - 1, seen2 = 0; j >= 0 && seen2 < 6; j--, seen2++) {
        const upLn = lines[j];
        if (isFour(upLn) && allZhi(upLn)) { rowUp = { idx: j, ln: upLn }; break; }
      }
      break;
    }
  }
  if (!rowDown || !rowUp) {
    const a = lines[idxFirstSan - 2];
    const b = lines[idxFirstSan - 1];
    if (!a || !b) return null;
    const downCand = hasGan(a) ? a : b;
    const upCand = downCand === a ? b : a;
    if (!(isFour(downCand) && isFour(upCand))) return null;
    rowDown = { idx: idxFirstSan - 2, ln: downCand };
    rowUp = { idx: idxFirstSan - 1, ln: upCand };
  }

  const ups = tokens(rowUp.ln);
  const downs = tokens(rowDown.ln);
  if (ups.length !== 4 || downs.length !== 4) return null;
  const pairsLR = [0, 1, 2, 3].map((i) => ({ up: ups[i], down: downs[i] }));
  const siKePairs = pairsLR.reverse();

  const sanLines = idxsSan.map((i) => lines[i]);
  const sanZhuan = sanLines.map((ln) => findTriadInLine(ln)?.zhi || null);
  if (sanZhuan.some((z) => !z)) return null;

  return {
    siKePairs,
    sanZhuan,
    context: {
      rowUp: rowUp.ln,
      rowDown: rowDown.ln,
      sanLines,
      indices: { rowUp: rowUp.idx, rowDown: rowDown.idx, sanLines: idxsSan }
    }
  };
}

function findCharts(rawLines) {
  const lines = rawLines.map((l) => normalizeLine(l));
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const hdrLine = lines[i];
    const hdrObj = parseHeaderFromLine(hdrLine);
    if (!hdrObj) continue;
    // 若本行未能取到日时，尝试从下一行补充
    if (!hdrObj.dayGanzhi || !hdrObj.timeGanzhi) {
      const merged = hdrLine + '，' + (lines[i + 1] || '') + '，' + (lines[i + 2] || '');
      const dayTimeRe2 = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])(?:日)?(?:[，,、\s]*)?([甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥])时/;
      const mm = merged.match(dayTimeRe2);
      if (mm) {
        hdrObj.dayGanzhi = hdrObj.dayGanzhi || mm[1];
        hdrObj.timeGanzhi = hdrObj.timeGanzhi || mm[2];
      }
      const xunRe2 = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])旬/;
      const mx = merged.match(xunRe2);
      if (mx) hdrObj.xun = hdrObj.xun || mx[1];
    }
    // Bound the block by an end marker: "断曰" or "断："/"断:"
    let endIdx = Math.min(lines.length, i + 30);
    for (let k = i + 1; k < Math.min(lines.length, i + 80); k++) {
      const s = lines[k];
      if (!s) continue;
      if (s.includes('断曰') || /^\s*断\s*[：:]/.test(s)) { endIdx = k; break; }
    }
    // Look ahead for 3 triad lines prior to end marker
    const triIdx = [];
    for (let j = i + 1; j < endIdx && j <= i + 20 && triIdx.length < 3; j++) {
      const tri = findTriadInLine(lines[j]);
      if (tri) triIdx.push(j);
    }
    if (triIdx.length !== 3) continue;
    triIdx.sort((a, b) => a - b);
    // End marker extraction, possibly multi-line until next header or title
    let endLine = lines[endIdx] || '';
    let endMarker = null;
    let endText = null;
    let endExtraLines = [];
    if (endLine) {
      const mEnd = endLine.match(/^\s*(断曰|断[：:])\s*(.*)$/);
      if (mEnd) {
        endMarker = mEnd[1];
        endText = (mEnd[2] || '').trim();
        // collect subsequent lines until the next header or title
        for (let k = endIdx + 1; k < lines.length; k++) {
          const ln = lines[k];
          if (!ln) { endExtraLines.push(ln); continue; }
          const nextHdr = parseHeaderFromLine(ln);
          const nextTitle = parseTitleFromLine(ln);
          if (nextHdr || nextTitle) break;
          endExtraLines.push(ln);
        }
      }
    }
    // Compute preview range: from header to end section (including extended lines)
    const previewStopIdx = (() => {
      // If we already know the end extension length, use it; else fall back to endIdx
      // Note: endExtraLines is defined below; handle temporal ordering by a local function.
      return endIdx; // placeholder; will be recomputed after end extraction
    })();

    const parsed = parseAround(
      // For 四课定位我们需要可见的空格，故不走 leftHalf
      lines,
      triIdx[0],
      triIdx
    );
    const triads = triIdx.map((idx) => findTriadInLine(lines[idx]));
    // Now that endExtraLines is known, finalize nearby
    const finalPreviewStop = (endMarker ? endIdx + endExtraLines.length : endIdx);
    const nearby = lines.slice(i, Math.min(lines.length, finalPreviewStop + 1));
    results.push({
      header: hdrObj.raw,
      meta: hdrObj,
      triads,
      ...(parsed || {}),
      previewLines: nearby,
      end: endMarker ? { marker: endMarker, text: [endText, ...endExtraLines.filter(v => v != null && v !== '')].join('\n'), line: endLine, index: endIdx } : null,
      start: i,
    });
    // move i beyond this chart to avoid re-detecting inside
    i = triIdx[2];
  }
  return results;
}

function main() {
  const dir = process.argv[2] || path.resolve('books');
  const limit = process.argv[3] ? parseInt(process.argv[3], 10) : 3; // preview count per file
  const outArg = process.argv[4] || '';
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];

  // Determine write mode:
  // - default (no arg): per-file under reports/<basename>.json
  // - if arg endswith .json: write single aggregated file to that path
  // - else: treat arg as directory and write per-file JSONs inside it
  const isSingleFile = outArg && path.extname(outArg).toLowerCase() === '.json';
  const outDir = isSingleFile ? path.dirname(outArg) : (outArg ? outArg : path.resolve('reports'));

  const out = [];
  const full = [];
  for (const name of entries) {
    const fp = path.join(dir, name);
    if (!fs.statSync(fp).isFile()) continue;
    const txt = decodeText(fp);
    const lines = txt.split(/\r?\n/);
    const charts = findCharts(lines);
    const summary = {
      file: name,
      totalFound: charts.length,
      preview: charts.slice(0, limit).map((c) => ({
        header: c.header,
        meta: c.meta,
        triads: c.triads,
        siKePairs: c.siKePairs || null,
        sanZhuan: c.sanZhuan || (c.triads ? c.triads.map(t => t.zhi) : null),
        context: c.context || null,
        previewLines: c.previewLines,
        end: c.end || null,
        start: c.start,
      })),
    };
    out.push(summary);
    const fullForFile = { file: name, totalFound: charts.length, charts };
    full.push(fullForFile);

    // Per-file output (default or directory mode)
    if (!isSingleFile) {
      try {
        fs.mkdirSync(outDir, { recursive: true });
        const base = path.parse(name).name + '.json';
        const outPathFile = path.join(outDir, base);
        fs.writeFileSync(outPathFile, JSON.stringify(fullForFile, null, 2), 'utf-8');
      } catch (e) {
        // ignore file write errors in CLI preview mode
      }
    }
  }
  console.log(JSON.stringify(out, null, 2));
  // Aggregated output only if explicitly requested
  if (isSingleFile) {
    try {
      fs.mkdirSync(path.dirname(outArg), { recursive: true });
      fs.writeFileSync(outArg, JSON.stringify(full, null, 2), 'utf-8');
    } catch (e) {
      // ignore file write errors in CLI preview mode
    }
  }
}

main();
