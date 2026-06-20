import projectsContent from './content/projects.json';

export type Project = {
  name: string;
  href: string;
  repo?: string;
  stars?: number;
  desc: string;
  logo?: string;
  tags: string[];
};

export const projects = projectsContent.projects as Project[];
export const githubProfile = projectsContent.githubProfile;
