import sitesContent from './content/sites.json';
import { sitesContentSchema, type Site } from './schema';

const parsedSitesContent = sitesContentSchema.parse(sitesContent);

export type { Site };

export const sites: Site[] = parsedSitesContent.sites;
