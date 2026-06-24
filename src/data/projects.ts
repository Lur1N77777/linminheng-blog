import projectsContent from './content/projects.json';
import { projectsContentSchema, type Project } from './schema';

const parsedProjectsContent = projectsContentSchema.parse(projectsContent);

export type { Project };

export const projects: Project[] = parsedProjectsContent.projects;
export const githubProfile = parsedProjectsContent.githubProfile;
