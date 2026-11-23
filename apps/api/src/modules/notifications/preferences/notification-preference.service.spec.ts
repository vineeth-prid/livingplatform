import { BadRequestException } from '@nestjs/common';
import { NotificationEvent } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import type { CommunityAccessService } from '../../tenancy/community-access.service';
import { LIVING_BRAND, type NotificationBrand, type NotificationBrandingResolver } from '../core/notification-branding';
import { NotificationRenderer } from '../core/notification-renderer';
import { EmailTemplateEngine } from '../core/templates/template.engine';
import { NotificationPreferenceService } from './notification-preference.service';

const ABC: NotificationBrand = {
  ...LIVING_BRAND,
  community_name: 'ABC Residency',
  brand_name: 'ABC Residency',
  signature: 'ABC Residency Management Team',
  branded: true,
  sender_name: 'ABC Residency',
};

function make(brand: NotificationBrand = ABC) {
  const upsert = jest.fn((args: { create: unknown }) => Promise.resolve(args.create));
  const prisma = { communityNotificationTemplate: { upsert } } as unknown as PrismaService;
  const access = { assert: jest.fn().mockResolvedValue(undefined) } as unknown as CommunityAccessService;
  const engine = new EmailTemplateEngine();
  const branding = { for: jest.fn().mockResolvedValue(brand) } as unknown as NotificationBrandingResolver;
  const service = new NotificationPreferenceService(prisma, access, new NotificationRenderer(engine, branding));
  return { service, upsert, access };
}

const actor = { id: 'u-1' } as never;

describe('NotificationPreferenceService — template editor', () => {
  it('lists every event with its variables and default wording for both channels', async () => {
    const { service } = make();
    const defaults = await service.templateDefaults('c-1');
    const ticket = defaults.find((d) => d.event === NotificationEvent.TICKET_UPDATE)!;
    expect(ticket.variables.map((v) => v.name)).toEqual(expect.arrayContaining([
      'recipient_name', 'ticket_number', 'ticket_title', 'status', 'update_description', 'updated_at', 'ticket_link', 'community_name',
    ]));
    expect(ticket.variables.find((v) => v.name === 'ticket_number')!.required).toBe(true);
    expect(ticket.whatsapp.body).toContain('{{update_description}}');
    expect(ticket.email.subject).toContain('{{ticket_number}}');
    expect(defaults).toHaveLength(16);
  });

  it('saves wording that uses supported variables', async () => {
    const { service, upsert } = make();
    await service.upsertTemplate('c-1', {
      event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp',
      body: 'Hi {{recipient_name}}, {{ticket_number}} is {{status}}. {{signature}}',
    }, actor);
    expect(upsert).toHaveBeenCalled();
  });

  it('refuses a placeholder this event never supplies', async () => {
    const { service, upsert } = make();
    await expect(service.upsertTemplate('c-1', {
      event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp', body: 'Hi {{residentName}}, pay {{amount}}',
    }, actor)).rejects.toThrow(new BadRequestException('Unknown variables: {{residentName}}, {{amount}}'));
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuses raw {{{triple}}} output in community wording', async () => {
    const { service } = make();
    await expect(service.upsertTemplate('c-1', {
      event: NotificationEvent.TICKET_UPDATE, channel: 'email', body: '<p>{{{ticket_title}}}</p>',
    }, actor)).rejects.toThrow(BadRequestException);
  });

  it('previews the default WhatsApp wording with sample data and the community name', async () => {
    const { service } = make();
    const out = await service.preview('c-1', { event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp' });
    expect(out.ok).toBe(true);
    expect(out.text).toContain('*Ticket Update – TKT-000116*');
    expect(out.text).toContain('Hello Vineeth,');
    expect(out.text).toContain('Issue: Not clean');
    expect(out.text).toContain('Current Status: In Progress');
    expect(out.text).toContain('*ABC Residency Management Team*');
    expect(out.text).not.toContain('Living');
  });

  it('previews an unbranded community with the Living identity', async () => {
    const { service } = make({ ...LIVING_BRAND, community_name: 'Plain Towers' });
    const out = await service.preview('c-1', { event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp' });
    expect(out.text).toContain('*Living Community Management Team*');
  });

  it('previews custom wording exactly as it would send, and reports errors inline', async () => {
    const { service } = make();
    const ok = await service.preview('c-1', {
      event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp', body: "{{ticket_number}} — {{ticket_title}}: it's {{status}}",
    });
    expect(ok.text).toBe("TKT-000116 — Not clean: it's In Progress");

    const bad = await service.preview('c-1', { event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp', body: 'Hi {{nope}}' });
    expect(bad).toMatchObject({ ok: false, error: 'Unknown variable: {{nope}}' });

    const broken = await service.preview('c-1', { event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp', body: 'Hi {{#if x}' });
    expect(broken.ok).toBe(false);
  });

  it('previews email inside the branded layout', async () => {
    const { service } = make();
    const out = await service.preview('c-1', { event: NotificationEvent.PAYMENT_SUCCESS, channel: 'email' });
    expect(out.subject).toBe('Payment received — INR 2,500.00');
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.html).toContain('ABC Residency');
    expect(out.html).not.toContain('A calm operating system'); // Living tagline stays off branded mail
  });

  it('checks community access before previewing', async () => {
    const { service, access } = make();
    (access.assert as jest.Mock).mockRejectedValue(new Error('Forbidden'));
    await expect(service.preview('c-2', { event: NotificationEvent.TICKET_UPDATE, channel: 'whatsapp' })).rejects.toThrow('Forbidden');
  });
});

describe('NotificationPreferenceService — payment WhatsApp default', () => {
  const make2 = (row: unknown, whatsappEnabled = false) => {
    const prisma = {
      communityNotificationPreference: { findUnique: jest.fn().mockResolvedValue(row) },
      communitySettings: { findUnique: jest.fn().mockResolvedValue({ emailEnabled: true, whatsappEnabled }) },
    } as unknown as PrismaService;
    return new NotificationPreferenceService(prisma, {} as CommunityAccessService, {} as NotificationRenderer);
  };

  it.each([NotificationEvent.PAYMENT_SUCCESS, NotificationEvent.PAYMENT_CONFIRMATION])(
    '%s goes out on WhatsApp unless the community switched it off',
    async (event) => {
      await expect(make2(null).resolve('c-1', event)).resolves.toEqual({ enabled: true, channels: ['email', 'whatsapp'] });
      await expect(make2({ enabled: true, emailEnabled: true, whatsappEnabled: false }).resolve('c-1', event))
        .resolves.toEqual({ enabled: true, channels: ['email'] });
    },
  );

  it('other events keep following the community WhatsApp setting', async () => {
    await expect(make2(null).resolve('c-1', NotificationEvent.TICKET_UPDATE)).resolves.toEqual({ enabled: true, channels: ['email'] });
  });
});
