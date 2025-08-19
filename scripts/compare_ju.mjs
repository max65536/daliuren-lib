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
  // 否则用最长的 3+ 空格串作为左右栏分隔符
  const s = line;
  let maxLen = 0, maxIndex = -1;
  for (let i = 0; i < s.length; ) {
    if (s[i] === ' ') {
      let j = i;
      while (j < s.length && s[j] === ' ') j++;
      const len = j - i;
      if (len >= 3 && len > maxLen) {
        maxLen = len;
        maxIndex = i;
      }
      i = j;
    } else i++;
  }
  const left = maxIndex >= 0 ? s.slice(0, maxIndex) : s;
  return left.trim();
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
  // 从底部筛选三传三行（第二列含地支）
  const sanLines = [];
  for (let i = nonEmpty.length - 1; i >= 0 && sanLines.length < 3; i--) {
    const ln = nonEmpty[i];
    const tokens = ln.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
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
  // 以三传首行索引向上取两行 -> 四课（两行各4个）
  const firstSanIdx = nonEmpty.indexOf(sanLines[0]);
  const cand2 = nonEmpty.slice(firstSanIdx - 2, firstSanIdx);
  if (cand2.length !== 2) throw new Error('四课行数量异常');
  const hasGan = (ln) => Array.from(ln).some(ch => GAN.includes(ch));
  const [rowA, rowB] = cand2;
  const rowDown = hasGan(rowA) ? rowA : rowB;
  const rowUp = hasGan(rowA) ? rowB : rowA;
  const ups = rowUp.split(/\s+/).filter(Boolean);
  const downs = rowDown.split(/\s+/).filter(Boolean);
  if (ups.length !== 4 || downs.length !== 4) throw new Error('四课行需各4个字符: ' + rowUp + ' | ' + rowDown);
  // 右→左展示为 [四、三、二、一]，反转成 [一、二、三、四]
  const pairsLR = [0,1,2,3].map((i) => ({ up: ups[i], down: downs[i] }));
  const siKePairs = pairsLR.reverse();
  return { siKePairs, sanZhuan };
}

function parseFileAll(file) {
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

  const items = [];
  for (const blk of blocks) {
    try {
      const { siKePairs, sanZhuan } = parseBlock(blk.lines);
      items.push({ file, dayGanzhi: blk.meta.dayGanzhi, ju: blk.meta.ju, siKePairs, sanZhuan });
    } catch (e) {
      // skip malformed block
      continue;
    }
  }
  return items;
}

async function main() {
  const target = process.argv[2]; // optional file path or glob dir
  const baseDir = target ? (fs.statSync(target).isDirectory() ? target : path.dirname(target)) : 'ju';
  const files = (target && fs.statSync(target).isFile())
    ? [target]
    : fs.readdirSync(baseDir).filter(f => f.endsWith('.txt')).map(f => path.join(baseDir, f));

  const { computePanByJu } = await import(path.resolve('dist/src/full.js'));

  const results = [];
  const mismatches = [];
  let total = 0;
  let matched = 0;

  for (const file of files) {
    let items = [];
    try {
      items = parseFileAll(file);
    } catch (e) {
      console.error('解析失败:', file, e.message || e);
      continue;
    }
    if (!items.length) {
      // 轻量提示，方便排查
      // console.warn('未发现块:', file);
    }
    for (const it of items) {
      total++;
      let comp;
      try {
        comp = computePanByJu(it.dayGanzhi, it.ju);
      } catch (e) {
        mismatches.push({ file, dayGanzhi: it.dayGanzhi, ju: it.ju, reason: 'computePanByJu异常: ' + (e.message || e) });
        continue;
      }
      const gotSan = comp.siKeSanZhuan.sanZhuan;
      const wantSan = it.sanZhuan;
      const sanOk = Array.isArray(gotSan) && Array.isArray(wantSan) && gotSan.length === wantSan.length && gotSan.every((z, i) => z === wantSan[i]);

      const pairKey = (p) => `${p.up}/${p.down}`;
      const gotKe = comp.siKePairs.map(pairKey);
      const gotKeRev = [...gotKe].reverse();
      const wantKe = it.siKePairs.map(pairKey);
      let keOk = JSON.stringify(gotKe) === JSON.stringify(wantKe);
      let usedOrder = 'as-is';
      let normGotKe = gotKe;
      if (!keOk) {
        if (JSON.stringify(gotKeRev) === JSON.stringify(wantKe)) {
          keOk = true;
          usedOrder = 'reversed';
          normGotKe = gotKeRev;
        }
      }

      const pass = sanOk && keOk;
      const kind = (comp.siKeSanZhuan && comp.siKeSanZhuan.kind) || '';
      const note = (comp.siKeSanZhuan && comp.siKeSanZhuan.note) || '';
      const ganShang = comp.ganShang || '';
      if (pass) matched++;
      else mismatches.push({ file, dayGanzhi: it.dayGanzhi, ju: it.ju, wantSan: wantSan.join(''), gotSan: gotSan.join(''), wantKe: wantKe.join(' '), gotKe: gotKe.join(' '), gotKeNorm: normGotKe.join(' '), orderUsed: usedOrder, kind, note, ganShang });
      results.push({ file, dayGanzhi: it.dayGanzhi, ju: it.ju, pass, wantSan: wantSan.join(''), gotSan: gotSan.join(''), wantKe: wantKe.join(' '), gotKe: gotKe.join(' '), gotKeNorm: normGotKe.join(' '), orderUsed: usedOrder, kind, note, ganShang });
    }
  }

  // 输出控制台摘要
  console.log('JU compare summary');
  console.log(`Total blocks: ${total}`);
  console.log(`Matched: ${matched}`);
  console.log(`Mismatched: ${mismatches.length}`);
  if (mismatches.length) {
    for (const m of mismatches.slice(0, 50)) {
      console.log(`${m.file} | ${m.dayGanzhi}-${m.ju}局 | 三传 want=${m.wantSan || ''} got=${m.gotSan || ''} | 四课 want=[${m.wantKe||''}] got=[${m.gotKe||''}] norm=[${m.gotKeNorm||''}] order=${m.orderUsed||''} ${m.reason ? '('+m.reason+')' : ''}`);
    }
    if (mismatches.length > 50) console.log(`...and ${mismatches.length - 50} more`);
  }

  // 写出 CSV 报告
  const reportDir = path.resolve('reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const csvPath = path.join(reportDir, 'ju_compare_mismatch.csv');
  const header = 'file,dayGanzhi,ju,wantSan,gotSan,wantKe,gotKe,gotKeNorm,orderUsed,kind,note,ganShang,reason\n';
  const rows = mismatches.map(m => [m.file, m.dayGanzhi, m.ju, m.wantSan || '', m.gotSan || '', m.wantKe || '', m.gotKe || '', m.gotKeNorm || '', m.orderUsed || '', m.kind || '', m.note || '', m.ganShang || '', m.reason || '']
    .map(s => String(s).replaceAll('"', '""')).map(s => `"${s}"`).join(','));
  fs.writeFileSync(csvPath, header + rows.join('\n'), 'utf-8');
  console.log('Report written:', csvPath);

  const csvFull = path.join(reportDir, 'ju_compare_full.csv');
  const headerFull = 'file,dayGanzhi,ju,pass,wantSan,gotSan,wantKe,gotKe,gotKeNorm,orderUsed,kind,note,ganShang\n';
  const rowsFull = results.map(r => [r.file, r.dayGanzhi, r.ju, r.pass ? '1' : '0', r.wantSan || '', r.gotSan || '', r.wantKe || '', r.gotKe || '', r.gotKeNorm || '', r.orderUsed || '', r.kind || '', r.note || '', r.ganShang || '']
    .map(s => String(s).replaceAll('"', '""')).map(s => `"${s}"`).join(','));
  fs.writeFileSync(csvFull, headerFull + rowsFull.join('\n'), 'utf-8');
  console.log('Report written:', csvFull);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
