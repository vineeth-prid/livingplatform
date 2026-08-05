import { ValidationPipe } from '@nestjs/common';

import { QueryVisitorDto } from '../community-ops/dto/visitor.dto';
import {
  CreateGateEntryDto,
  GateStatisticsQueryDto,
  QueryGateEntryDto,
} from './dto/gate-entry.dto';

/**
 * Query DTOs must accept every parameter the clients actually send.
 *
 * The app runs `whitelist: true, forbidNonWhitelisted: true`, and the pipe
 * validates the WHOLE query object against the DTO bound with `@Query()`. A
 * handler that also took a separate `@Query('communityId')` parameter therefore
 * 400'd on every call — the DTO had never heard of `communityId`.
 *
 * That is what made the gate register look permanently empty: creation
 * succeeded, the list that displays it did not. Nothing about the controller
 * signature looked wrong, which is exactly why these assert against the real
 * pipe using the payloads the SDK sends rather than reading the decorators.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const query = (metatype: new () => object, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'query', metatype });

const body = (metatype: new () => object, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'body', metatype });

describe('gate query DTOs accept what the apps send', () => {
  it('accepts the workforce gate register call', async () => {
    const result = (await query(QueryGateEntryDto, {
      communityId: 'c-1',
      limit: '100',
      todayOnly: 'true',
      sortBy: 'createdAt',
      sortDir: 'desc',
    })) as QueryGateEntryDto;

    expect(result.communityId).toBe('c-1');
  });

  it('accepts the portal register call with filters and search', async () => {
    const result = (await query(QueryGateEntryDto, {
      communityId: 'c-1',
      status: 'NOTIFIED',
      deliveryType: 'FOOD',
      search: 'swiggy',
      page: '2',
    })) as QueryGateEntryDto;

    expect(result.communityId).toBe('c-1');
    expect(result.status).toBe('NOTIFIED');
  });

  it('accepts the analytics call', async () => {
    const result = (await query(GateStatisticsQueryDto, {
      communityId: 'c-1',
      days: '30',
    })) as GateStatisticsQueryDto;

    expect(result.communityId).toBe('c-1');
    expect(result.days).toBe(30);
  });

  /** The resident's own list is self-scoped and sends no community. */
  it('accepts the resident self-scoped call with no communityId', async () => {
    const result = (await query(QueryGateEntryDto, {
      pendingOnly: 'true',
      limit: '5',
    })) as QueryGateEntryDto;

    expect(result.communityId).toBeUndefined();
  });

  it('accepts the delivery creation body the guard submits', async () => {
    const result = (await body(CreateGateEntryDto, {
      entryType: 'DELIVERY',
      unitId: 'unit-1',
      vendorName: 'Swiggy',
      deliveryType: 'FOOD',
      personName: 'Ramesh',
      mobileNumber: '9876500000',
    })) as CreateGateEntryDto;

    expect(result.personName).toBe('Ramesh');
  });

  /** The whitelist must still do its job — this is not a loophole. */
  it('still rejects a genuinely unknown query parameter', async () => {
    await expect(
      query(QueryGateEntryDto, { communityId: 'c-1', sneaky: 'value' }),
    ).rejects.toThrow();
  });

  /**
   * The established pattern this deviated from: every other community-scoped
   * list carries communityId ON its query DTO. Pinned so the gate DTOs are not
   * "fixed" back into a separate parameter later.
   */
  it('matches how the visitor register already declares communityId', async () => {
    const result = (await query(QueryVisitorDto, {
      communityId: 'c-1',
      limit: '50',
    })) as QueryVisitorDto;

    expect(result.communityId).toBe('c-1');
  });
});
