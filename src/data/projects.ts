// 项目 —— GitHub 仓库卡片
// repo 填 "用户名/仓库名",页面会实时抓取它的 star 数(随你 GitHub 变化)
// stars 是兜底数字:抓取失败时显示它,绝不空白

export type Project = {
  name: string;
  href: string;
  repo?: string;       // "Lur1N77777/CloudMail",有则显示实时 star
  stars?: number;      // 兜底 star 数
  desc: string;
  logo?: string;       // 缩略图路径,如 '/assets/cloudmail-logo.png';留空显示名字
  tags: string[];
};

export const projects: Project[] = [
  {
    name: 'CloudMail',
    href: 'https://github.com/Lur1N77777/CloudMail',
    repo: 'Lur1N77777/CloudMail',
    stars: 14,
    desc: '面向 Cloudflare 临时邮箱的 Expo React Native Android 管理 App,把 webmail 装进口袋里随手管。',
    logo: '/assets/cloudmail-logo.png',
    tags: ['TypeScript', 'Expo', 'React Native'],
  },
  {
    name: 'loven7-mail-cloudflare-suite',
    href: 'https://github.com/Lur1N77777/loven7-mail-cloudflare-suite',
    repo: 'Lur1N77777/loven7-mail-cloudflare-suite',
    stars: 9,
    desc: '为 Cloudflare Temp Mail 打造的增强版管理后台与 webmail 前端,界面更顺手、功能更全。',
    logo: '/assets/loven7-logo.svg',
    tags: ['TypeScript', 'Cloudflare'],
  },
];

// 「在 GitHub 上看全部」的链接
export const githubProfile = 'https://github.com/Lur1N77777';
