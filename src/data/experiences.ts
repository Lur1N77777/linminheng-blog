import experiencesContent from './content/experiences.json';
import { experiencesContentSchema, type Experience } from './schema';

const parsedExperiencesContent = experiencesContentSchema.parse(experiencesContent);

export type { Experience };

export const experiences: Experience[] = parsedExperiencesContent.experiences;
