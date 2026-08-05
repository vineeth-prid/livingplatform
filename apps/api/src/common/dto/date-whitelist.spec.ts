import { ValidationPipe } from '@nestjs/common';

import { CreateAMCContractDto, RenewAMCContractDto } from '../../modules/amc/dto/amc-contract.dto';
import { CreateBookingDto } from '../../modules/community-ops/dto/booking.dto';
import { CreateVisitorDto } from '../../modules/community-ops/dto/visitor.dto';
import { CreateMaintenancePlanDto } from '../../modules/maintenance/dto/maintenance-plan.dto';

/**
 * Required date fields must survive the global ValidationPipe.
 *
 * The app runs `whitelist: true, forbidNonWhitelisted: true`, and class-validator
 * only whitelists properties that carry a *validation* decorator. `@Type(() =>
 * Date)` is class-transformer and `@ApiProperty` is swagger — neither counts. A
 * required date declared with those alone is stripped and then rejected with
 * "property <name> should not exist".
 *
 * That single omission silently broke four features at once: inviting a visitor,
 * booking an amenity, creating an AMC contract and creating a maintenance plan.
 * Nothing about the shape of those DTOs looked wrong, which is exactly why this
 * test exists — it exercises the real pipe rather than reading the decorators.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (metatype: new () => object, value: Record<string, unknown>) =>
  pipe.transform(value, { type: 'body', metatype });

describe('required date fields survive the global ValidationPipe', () => {
  it('accepts a visitor invite with expectedArrival', async () => {
    const result = (await transform(CreateVisitorDto, {
      communityId: 'c-1',
      residentId: 'res-1',
      visitorName: 'Ramesh Kumar',
      mobileNumber: '+919876543210',
      expectedArrival: '2026-08-06T09:00:00.000Z',
    })) as CreateVisitorDto;

    expect(result.expectedArrival).toBeInstanceOf(Date);
    expect(result.expectedArrival.toISOString()).toBe('2026-08-06T09:00:00.000Z');
  });

  it('accepts an amenity booking with startTime and endTime', async () => {
    const result = (await transform(CreateBookingDto, {
      communityId: 'c-1',
      amenityId: 'a-1',
      residentId: 'res-1',
      startTime: '2026-08-06T09:00:00.000Z',
      endTime: '2026-08-06T10:00:00.000Z',
    })) as CreateBookingDto;

    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
  });

  it('accepts an AMC contract with startDate and endDate', async () => {
    const result = (await transform(CreateAMCContractDto, {
      communityId: 'c-1',
      vendorId: 'v-1',
      contractNumber: 'AMC-0001',
      name: 'Lift AMC',
      annualCost: 120000,
      startDate: '2026-08-06T00:00:00.000Z',
      endDate: '2027-08-06T00:00:00.000Z',
    })) as CreateAMCContractDto;

    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it('accepts an AMC renewal with endDate', async () => {
    const result = (await transform(RenewAMCContractDto, {
      endDate: '2028-08-06T00:00:00.000Z',
    })) as RenewAMCContractDto;

    expect(result.endDate).toBeInstanceOf(Date);
  });

  it('accepts a maintenance plan with startDate', async () => {
    const result = (await transform(CreateMaintenancePlanDto, {
      communityId: 'c-1',
      assetId: 'asset-1',
      name: 'Quarterly DG service',
      frequencyType: 'QUARTERLY',
      startDate: '2026-08-06T00:00:00.000Z',
    })) as CreateMaintenancePlanDto;

    expect(result.startDate).toBeInstanceOf(Date);
  });

  /** The validator must still reject junk — @IsDate is a real check, not a
   *  whitelist trick. */
  it('still rejects a non-date value', async () => {
    await expect(
      transform(CreateVisitorDto, {
        communityId: 'c-1',
        residentId: 'res-1',
        visitorName: 'Ramesh Kumar',
        mobileNumber: '+919876543210',
        expectedArrival: 'not-a-date',
      }),
    ).rejects.toThrow();
  });

  /** And a genuinely unknown property must still be refused. */
  it('still rejects an unknown property', async () => {
    await expect(
      transform(CreateVisitorDto, {
        communityId: 'c-1',
        residentId: 'res-1',
        visitorName: 'Ramesh Kumar',
        mobileNumber: '+919876543210',
        expectedArrival: '2026-08-06T09:00:00.000Z',
        sneaky: 'value',
      }),
    ).rejects.toThrow();
  });
});
