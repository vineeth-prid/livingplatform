import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateDocumentDto,
  QueryDocumentDto,
  RequestUploadUrlDto,
  UpdateDocumentDto,
} from './dto/document.dto';

const SORTABLE = ['title', 'category', 'createdAt', 'status', 'expiresOn'] as const;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
  ) {}

  /**
   * Hand out a signed upload target. The client PUTs bytes to `uploadUrl`, then
   * creates/updates a document with the returned `key`. Decoupled from the
   * concrete store via StorageService (no file uploads land this sprint — the
   * local stub returns a placeholder URL, real providers return a real one).
   */
  async requestUploadUrl(communityId: string, dto: RequestUploadUrlDto) {
    await this.access.assert(communityId);
    const key = this.storage.buildKey(
      `communities/${communityId}/documents`,
      dto.fileName,
    );
    const signed = await this.storage.signUpload(key, {
      contentType: dto.contentType,
    });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  async create(communityId: string, dto: CreateDocumentDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const doc = await this.prisma.communityDocument.create({
      data: {
        communityId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        status: dto.status ?? 'DRAFT',
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: dto.version,
        issuedOn: dto.issuedOn,
        expiresOn: dto.expiresOn,
        tags: dto.tags ?? [],
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.DocumentAdded,
      ...this.events.from(actor, communityId),
      entityId: doc.id,
      data: { title: doc.title, category: doc.category },
    });
    return this.present(doc);
  }

  async findMany(communityId: string, query: QueryDocumentDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.CommunityDocumentWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communityDocument.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.communityDocument.count({ where }),
    ]);
    return paginate(items.map((d) => this.present(d)), total, query);
  }

  async findOne(id: string) {
    const doc = await this.prisma.communityDocument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.access.assert(doc.communityId);
    return this.present(doc);
  }

  async update(id: string, dto: UpdateDocumentDto, actor: AuthenticatedUser) {
    await this.findOne(id);
    const doc = await this.prisma.communityDocument.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        status: dto.status,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        version: dto.version,
        issuedOn: dto.issuedOn,
        expiresOn: dto.expiresOn,
        tags: dto.tags,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    return this.present(doc);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.communityDocument.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  private present<T extends { storageKey: string | null }>(doc: T) {
    return { ...doc, downloadUrl: this.storage.resolveUrl(doc.storageKey) };
  }
}
