// 历程 —— 一条一条的经历卡片
// 想加一段经历,复制一个对象、改掉内容即可

export type Experience = {
  meta: string;        // 时间,如 '2024 — 至今'
  title: string;       // 标题
  desc: string;        // 描述
  tags: string[];      // 关键词标签
  href?: string;       // 可选:点击跳转的链接
};

export const experiences: Experience[] = [
  {
    meta: '2024 — 至今',
    title: '某个身份 / 阶段',
    desc: '这里写一段你在做的事、扮演的角色,以及它带给你的成长。占位文字,之后替换成你真实的经历。',
    tags: ['关键词', '技能', '领域'],
    href: '#',
  },
  {
    meta: '2023',
    title: '另一段经历',
    desc: '把鼠标移到不同条目上感受一下「聚焦」效果——其余的会优雅地变淡,当前这条会微微浮起。',
    tags: ['摄影', '设计'],
    href: '#',
  },
  {
    meta: '2022',
    title: '起点',
    desc: '一切开始的地方。占位描述,等你来讲述属于你的故事。',
    tags: ['学习'],
    href: '#',
  },
];
