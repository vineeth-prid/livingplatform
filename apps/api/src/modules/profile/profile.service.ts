import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Self-service profile & preferences. Always scoped to the authenticated user —
 * there is no "manage other users' profiles" here, so no RBAC permission gates
 * these routes (authentication is enough). Admin user management lives in the
 * users module.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true,
        profile: true,
      },
    });
    const profile =
      user.profile ??
      (await this.prisma.userProfile.create({ data: { userId } }));
    return { ...user, profile: this.present(profile) };
  }

  async update(userId: string, dto: UpdateProfileDto, actor: AuthenticatedUser) {
    const data = {
      displayName: dto.displayName,
      avatarKey: dto.avatarKey,
      phone: dto.phone,
      bio: dto.bio,
      language: dto.language,
      theme: dto.theme,
      timezone: dto.timezone,
      notificationPreferences: dto.notificationPreferences as
        | Prisma.InputJsonValue
        | undefined,
      twoFactorEnabled: dto.twoFactorEnabled,
    };
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    this.events.publish({
      name: DomainEventName.ProfileUpdated,
      ...this.events.from(actor, null),
      entityId: profile.id,
      data: { userId },
    });
    return this.present(profile);
  }

  private present<T extends { avatarKey: string | null }>(profile: T) {
    return { ...profile, avatarUrl: this.storage.resolveUrl(profile.avatarKey) };
  }
}
