import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const kind = process.argv[2];
if (!['project', 'site'].includes(kind)) {
  output.write('Usage: node scripts/new-card.mjs project|site\n');
  process.exit(1);
}

const pipedAnswers = input.isTTY ? null : readFileSync(0, 'utf8').split(/\r?\n/);
const rl = pipedAnswers ? null : createInterface({ input, output });

async function ask(question, fallback = '') {
  if (pipedAnswers) {
    const answer = pipedAnswers.shift()?.trim();
    return answer || fallback;
  }

  const suffix = fallback ? ` (${fallback})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

function parseTags(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

try {
  const name = await ask(kind === 'project' ? '项目名称' : '站点名称');
  const href = await ask('链接');
  const desc = await ask('简介');
  const logo = await ask('Logo 路径,可留空', '');
  const tags = parseTags(await ask('标签,用逗号分隔', kind === 'project' ? 'TypeScript' : '在线服务'));

  if (!name || !href || !desc) {
    output.write('\n名称、链接、简介不能为空。\n');
    process.exit(1);
  }

  if (kind === 'project') {
    const repo = await ask('GitHub repo,例如 user/repo,可留空', '');
    const starsText = await ask('兜底 star 数', '0');
    const path = join(process.cwd(), 'src', 'data', 'content', 'projects.json');
    const data = await readJson(path);
    data.projects.push({
      name,
      href,
      repo,
      stars: Number.parseInt(starsText, 10) || 0,
      desc,
      logo,
      tags,
    });
    await writeJson(path, data);
    output.write(`\n已添加项目: ${name}\n`);
  } else {
    const path = join(process.cwd(), 'src', 'data', 'content', 'sites.json');
    const data = await readJson(path);
    data.sites.push({ name, href, desc, logo, tags });
    await writeJson(path, data);
    output.write(`\n已添加站点: ${name}\n`);
  }
} finally {
  rl?.close();
}
