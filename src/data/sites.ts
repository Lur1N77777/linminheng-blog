import sitesContent from './content/sites.json';

export type Site = {
  name: string;
  href: string;
  desc: string;
  logo?: string;
  tags: string[];
};

export const sites = sitesContent.sites as Site[];
