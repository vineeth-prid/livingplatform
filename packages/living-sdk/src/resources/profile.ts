import type { HttpClient } from '../http';

export interface UserProfileDocument {
  id: string;
  userId: string;
  displayName: string | null;
  avatarKey: string | null;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  language: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone: string;
  twoFactorEnabled: boolean;
}

export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string | null;
  profile: UserProfileDocument;
}

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string;
  bio?: string;
  language?: string;
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone?: string;
}

/** The signed-in user's own profile and preferences. Always self-scoped. */
export class ProfileResource {
  constructor(private readonly http: HttpClient) {}

  me(): Promise<MyProfile> {
    return this.http.get('/profile/me');
  }

  update(input: UpdateProfileInput): Promise<UserProfileDocument> {
    return this.http.put('/profile/me', input);
  }
}
