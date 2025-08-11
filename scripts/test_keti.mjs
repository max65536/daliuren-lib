import fs from 'fs';
import path from 'path';
import url from 'url';

// ESM helpers
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import built outputs
import { computePanByJu } from '../dist/src/full.js';
import { calcGanShang, parseDayGanzhi } from '../dist/src/core.js';

const KETI_DIR = path.resolve(__dirname, '../keti');
const REPORT_DIR = path.resolve(__dirname, '../reports');

function parseJuText(txt) {
  // 兼容 OCR 混淆：屮/曰 -> 十
  txt = txt.replace(/[屮曰]/g, '十');
  // 支持 一~十二：十、十一、十二
  const special = { '十一': 11, '十二': 12 };
  if (special[txt] != null) return special[txt];
  if (txt === '十') return 10;
  const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  if (txt.startsWith('十')) {
    const tail = txt.slice(1);
    return 10 + (map[tail] ?? 0);
  }
  return map[txt];
}

function parseCaseTitle(title) {
  // 形如："甲子日第七局"
  const m = title.match(/^(..?)日第(.+?)局$/);
  if (!m) throw new Error(`无法解析局名: ${title}`);
  const dayGanzhi = m[1];
  const ju = parseJuText(m[2]);
  return { dayGanzhi, ju };
}

function expectedFromGroup(group) {
  // 返回 { kinds: string[], skipKind: boolean }
  switch (group) {
    case '伏吟':
    case '反吟':
      // 这两类需要(月将,时支)才能可靠判定；按 ju 测试时跳过课类校验
      return { kinds: [], skipKind: true };
    case '元首': return { kinds: ['元首课'], skipKind: false };
    case '重审': return { kinds: ['重审课'], skipKind: false };
    case '比用': return { kinds: ['比用课'], skipKind: false };
    case '涉害': return { kinds: ['涉害课'], skipKind: false };
    case '遥克': return { kinds: ['蒿矢课','弹射课'], skipKind: false };
    case '昴星': // keti 用“昴星”，实现为“昂星课”
    case '昂星': return { kinds: ['昂星课'], skipKind: false };
    case '别责': return { kinds: ['别责课'], skipKind: false };
    case '八专': return { kinds: ['八专课'], skipKind: false };
    default: return { kinds: [], skipKind: false };
  }
}

function main() {
  const files = fs.readdirSync(KETI_DIR).filter(f => f.endsWith('.json'));
  let total = 0, pass = 0;
  const perGroup = [];
  const allFailures = [];

  for (const f of files) {
    const full = path.join(KETI_DIR, f);
    const group = f.replace(/^keti_/,'').replace(/\.json$/,'');
    const { kinds: expectedKinds, skipKind } = expectedFromGroup(group);
    const raw = fs.readFileSync(full, 'utf-8');
    const items = JSON.parse(raw);
    let gTotal = 0, gPass = 0;
    const failures = [];

    for (const it of items) {
      gTotal++; total++;
      try {
        const { dayGanzhi, ju } = parseCaseTitle(it['局名']);
        const pan = computePanByJu(dayGanzhi, ju);
        // 校验干上
        const { gan } = parseDayGanzhi(dayGanzhi);
        const expectGanShangText = it['干上'];
        const expectedGanShang = calcGanShang(gan, ju);
        const okGanShang = expectedGanShang === expectGanShangText && pan.ganShang === expectGanShangText;
        // 校验课体（按组主类）
        const okKind = skipKind ? true : (expectedKinds.length === 0 ? true : expectedKinds.includes(pan.siKeSanZhuan.kind));
        if (okGanShang && okKind) {
          gPass++; pass++;
        } else {
          const rec = {
            group,
            title: it['局名'],
            dayGanzhi,
            ju,
            expectedGanShang: expectGanShangText,
            gotGanShang: pan.ganShang,
            expectedKindGroup: group,
            gotKind: pan.siKeSanZhuan.kind,
            skipKind,
          };
          failures.push(rec);
          allFailures.push(rec);
        }
      } catch (e) {
        const rec = { group, title: it['局名'], error: String(e) };
        failures.push(rec);
        allFailures.push(rec);
      }
    }

    perGroup.push({ group, gTotal, gPass, failures });
  }

  // 输出结果
  for (const g of perGroup) {
    const { group, gTotal, gPass, failures } = g;
    const rate = gTotal ? ((gPass / gTotal) * 100).toFixed(1) : '0.0';
    console.log(`[${group}] ${gPass}/${gTotal} (${rate}%)`);
    for (const f of failures) {
      const base = `  - ${f.title}`;
      if (f.error) {
        console.log(`${base} ERROR: ${f.error}`);
      } else {
        console.log(`${base} 干上: 期望=${f.expectedGanShang}, 实得=${f.gotGanShang}; 课类: 组=${f.group}, 实得=${f.gotKind}`);
      }
    }
  }
  const rate = total ? ((pass / total) * 100).toFixed(1) : '0.0';
  console.log(`\n总计: ${pass}/${total} (${rate}%)`);

  // 写出报告
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  // CSV（失败用例）
  const headers = ['group','title','dayGanzhi','ju','expectedGanShang','gotGanShang','expectedKindGroup','gotKind','skipKind','error'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return '"' + s + '"';
  };
  const csv = [headers.join(',')].concat(
    allFailures.map(r => headers.map(h => esc(r[h])).join(','))
  ).join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'keti_failures.csv'), csv, 'utf-8');
  // 仅导出失败；另导出仅“异常错误”的子集 CSV
  const onlyErrors = allFailures.filter(x => x.error);
  const csvErr = [headers.join(',')].concat(
    onlyErrors.map(r => headers.map(h => esc(r[h])).join(','))
  ).join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'keti_errors_only.csv'), csvErr, 'utf-8');
}

main();
