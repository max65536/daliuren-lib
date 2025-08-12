import fs from 'fs';
import path from 'path';

const ZH_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';

function normalizeLine(line) {
  // 将 NBSP 替换为空格，并去掉多余控制符
  return line.replace(/\u00A0/g, ' ').replace(/\t/g,' ').replace(/\s+$/,'');
}

function leftHalf(line) {
  // 以 3 个以上空格切分左右两半，仅取左侧
  const parts = line.split(/\s{3,}/);
  return (parts[0] || '').trim();
}

function parseHeader(line) {
  // 形如："【寅】 甲子一局" -> dayGanzhi=甲子, ju=1
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
  // 从块底部提取三传与四课
  const nonEmpty = lines.map(leftHalf).map(normalizeLine).map(s=>s.trim()).filter(Boolean);
  if (nonEmpty.length < 8) throw new Error('块内容过短，无法解析');
  // 取末三行 -> 三传
  const last3 = nonEmpty.slice(-3);
  const sanZhuan = last3.map((ln) => {
    const tokens = ln.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) throw new Error('三传行格式异常: ' + ln);
    const gz = tokens[1];
    // 只取地支
    const zhi = Array.from(gz).find((ch) => ZHI.includes(ch));
    if (!zhi) throw new Error('未找到地支: ' + ln);
    return zhi;
  });
  // 倒数第4、5行 -> 四课（两行各4个）
  const cand2 = nonEmpty.slice(-5, -3); // [-5, -4]
  if (cand2.length !== 2) throw new Error('四课行数量异常');
  // 判断上下行：含天干者为“下行”（一课下应含日干）
  const hasGan = (ln) => Array.from(ln).some(ch => GAN.includes(ch));
  const [rowA, rowB] = cand2;
  const rowDown = hasGan(rowA) ? rowA : rowB;
  const rowUp = hasGan(rowA) ? rowB : rowA;
  const ups = rowUp.split(/\s+/).filter(Boolean);
  const downs = rowDown.split(/\s+/).filter(Boolean);
  if (ups.length !== 4 || downs.length !== 4) throw new Error('四课行需各4个字符: ' + rowUp + ' | ' + rowDown);
  // 生成 [一课..四课] 的上/下
  const siKePairs = [0,1,2,3].map((i) => ({ up: ups[i], down: downs[i] }));
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
  if (blocks.length === 0) throw new Error('未找到任何“甲子x局”块');
  const blk = blocks.find(b => b.meta.ju === targetJu) || blocks[0];
  const { siKePairs, sanZhuan } = parseBlock(blk.lines);
  return { dayGanzhi: blk.meta.dayGanzhi, ju: blk.meta.ju, siKePairs, sanZhuan };
}

// main
const file = process.argv[2] || path.resolve('ju/0002-甲子.txt');
const ju = process.argv[3] ? parseInt(process.argv[3], 10) : 1;
const result = parseFile(file, ju);
console.log(JSON.stringify(result, null, 2));

