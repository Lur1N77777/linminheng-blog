import profileContent from './content/profile.json';

export type Palette =
  | 'amber'
  | 'pine'
  | 'terra'
  | 'indigo'
  | 'heather'
  | 'ink'
  | 'stone'
  | 'olive'
  | 'onyx'
  | 'claude'
  | 'openai';

export type Theme = 'dark' | 'light';

export type Socials = {
  github: string;
  instagram: string;
  email: string;
};

export type Profile = {
  name: string;
  title: string;
  tagline: string;
  foot: string;
  defaultPalette: Palette;
  defaultTheme: Theme;
  socials: Socials;
};

export const profile = profileContent.profile as Profile;
export const about = profileContent.about as string[];
