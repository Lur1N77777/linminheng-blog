import experiencesContent from './content/experiences.json';

export type Experience = {
  meta: string;
  title: string;
  desc: string;
  tags: string[];
  href?: string;
};

export const experiences = experiencesContent.experiences as Experience[];
