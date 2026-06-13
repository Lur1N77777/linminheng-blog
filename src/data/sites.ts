// 站点 —— 我在网上的其他存在,一键直达
// 卡片样式和「项目」统一。想加新站,复制一个对象改掉内容即可

export type Site = {
  name: string;
  href: string;
  desc: string;
  logo?: string;       // 缩略图路径;留空显示名字
  tags: string[];
};

export const sites: Site[] = [
  {
    name: 'Loven7-Mail',
    href: 'https://mail.loven7.cc.cd',
    desc: '自部署的 Cloudflare 临时邮箱管理端,React + PWA,可装到桌面/手机当 App 用,随用随收、随手管理。',
    logo: '/assets/loven7-logo.svg',
    tags: ['在线服务', 'Cloudflare', 'PWA'],
  },
  {
    name: '个人图床',
    href: 'https://img.loven7.com',
    desc: '自部署的现代化文件托管平台,图床 + 云存储,存图、传图、外链分享,自己数据的归属权在自己手里。',
    logo: '/assets/imghub-logo.png',
    tags: ['在线服务', '图床', '云存储'],
  },
  {
    name: '无限画布',
    href: 'https://pic.loven7.com',
    desc: '一个无限画布创作工具,在无边的画布上自由排布想法、素材和图层,像把整张灵感桌铺开来随手摆弄。',
    logo: '/assets/canvas-logo.svg',
    tags: ['创作工具', '画布'],
  },
  {
    name: 'DEEIX Chat',
    href: 'https://chat.loven7.cc.cd',
    desc: '自部署的多模型 AI 对话系统,一个界面里切换不同的模型聊天,日常问答、写作、折腾代码都能用。',
    logo: '/assets/deeix-logo.png',
    tags: ['AI', '多模型', '自部署'],
  },
];
