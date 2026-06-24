import profileContent from './content/profile.json';
import { profileContentSchema, type Profile } from './schema';

export type { Palette, Profile, Socials, Theme } from './schema';

const parsedProfileContent = profileContentSchema.parse(profileContent);

export const profile: Profile = parsedProfileContent.profile;
export const about = parsedProfileContent.about;
