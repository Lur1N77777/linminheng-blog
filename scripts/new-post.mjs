import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const pipedAnswers = input.isTTY ? null : readFileSync(0, 'utf8').split(/\r?\n/);
const rl = pipedAnswers ? null : createInterface({ input, output });

const today = new Date().toISOString().slice(0, 10);

function slugify(value) {
  return String(value || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function escapeYaml(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function parseTags(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function ask(question, fallback = '') {
  if (pipedAnswers) {
    const answer = pipedAnswers.shift()?.trim();
    return answer || fallback;
  }

  const suffix = fallback ? ` (${fallback})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

try {
  const title = await ask('文章标题', '未命名文章');
  const date = await ask('发布日期', today);
  const tags = parseTags(await ask('标签,用逗号分隔', '随笔'));
  const excerpt = await ask('摘要', '这里写文章摘要。');
  const draftAnswer = await ask('是否保存为草稿? y/N', 'N');
  const draft = /^y(es)?$/i.test(draftAnswer);
  const slug = slugify(await ask('文件名 slug', slugify(title)));

  const dir = join(process.cwd(), 'src', 'content', 'blog');
  await mkdir(dir, { recursive: true });

  let filename = `${date}-${slug}.md`;
  let filePath = join(dir, filename);
  let counter = 2;
  while (existsSync(filePath)) {
    filename = `${date}-${slug}-${counter}.md`;
    filePath = join(dir, filename);
    counter += 1;
  }

  const body = `---\ntitle: "${escapeYaml(title)}"\ndate: ${date}\ntags: [${tags.map((tag) => `"${escapeYaml(tag)}"`).join(', ')}]\nexcerpt: "${escapeYaml(excerpt)}"\ndraft: ${draft ? 'true' : 'false'}\n---\n\n正文从这里开始。\n`;

  await writeFile(filePath, body, 'utf8');
  output.write(`\n已创建: ${filePath}\n`);
} finally {
  rl?.close();
}
