import { BadRequestException } from '@nestjs/common';

import { AuthService } from './auth.service';

/**
 * Password recovery has to end somewhere the user can actually finish.
 *
 * The reported failure: a staff member asked for a reset, was told
 * "instructions sent", received a one-time code on WhatsApp — and the app
 * showed the emailed-link screen, which has nowhere to type a code. Two bugs
 * met there. `channel` was derived from the SHAPE of what was typed rather than
 * from what the engine actually sent, and the OTP endpoint could only find an
 * account by its digits, so the code could never be redeemed by anyone who had
 * asked by email.
 */
describe('password recovery', () => {
  const STAFF = {
    id: 'u-1', email: 'guard@living.local', username: '9876543210', firstName: 'Ramesh',
  };
  const OFFICE = { id: 'u-2', email: 'office@acme.com', username: null, firstName: 'Asha' };

  function build(user: typeof STAFF | typeof OFFICE | null) {
    const otp = { issue: jest.fn().mockResolvedValue(undefined), verify: jest.fn().mockResolvedValue('u-1') };
    const mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(user) } };
    const config = { get: () => ({ defaultPassword: 'Living@123' }) };
    const svc = new AuthService(
      prisma as never, // prisma
      {} as never, // rbac
      {} as never, // tokens
      mail as never, // mail
      {} as never, // passwords
      otp as never, // otp
      config as never, // config
    );
    // createVerificationToken hits tables this unit test does not stand up.
    (svc as unknown as { createVerificationToken: unknown }).createVerificationToken =
      jest.fn().mockResolvedValue('tok');
    (svc as unknown as { applyNewPassword: unknown }).applyNewPassword =
      jest.fn().mockResolvedValue({ message: 'ok' });
    return { svc, otp, mail, prisma };
  }

  it('reports the OTP channel when the code is what actually goes out', async () => {
    const { svc, otp } = build(STAFF);
    // Typed as an EMAIL — the account still has a mobile, so a code is sent.
    const result = await svc.forgotPassword({ identifier: 'guard@living.local' });
    expect(otp.issue).toHaveBeenCalled();
    expect(result.channel).toBe('otp');
  });

  it('reports the link channel for an account with no mobile number', async () => {
    const { svc, otp, mail } = build(OFFICE);
    const result = await svc.forgotPassword({ identifier: 'office@acme.com' });
    expect(otp.issue).not.toHaveBeenCalled();
    expect(mail.sendPasswordReset).toHaveBeenCalled();
    expect(result.channel).toBe('link');
  });

  it('falls back to the identifier’s shape for an unknown account', async () => {
    // Must not become an account-existence oracle: no user, no lookup result to
    // shape the answer from.
    await expect(build(null).svc.forgotPassword({ identifier: '9876543210' }))
      .resolves.toMatchObject({ channel: 'otp' });
    await expect(build(null).svc.forgotPassword({ identifier: 'nobody@acme.com' }))
      .resolves.toMatchObject({ channel: 'link' });
  });

  it('redeems the code against an identifier that is an email', async () => {
    const { svc, otp } = build(STAFF);
    await svc.resetPasswordWithOtp({
      identifier: 'guard@living.local', code: '482913', password: 'Living@1234',
    });
    // This is the step that used to fail: the digits-only lookup found nothing
    // and every attempt came back "invalid or expired".
    expect(otp.verify).toHaveBeenCalledWith('u-1', '482913');
  });

  it('redeems the code against a mobile number too', async () => {
    const { svc, otp } = build(STAFF);
    await svc.resetPasswordWithOtp({
      identifier: '9876543210', code: '482913', password: 'Living@1234',
    });
    expect(otp.verify).toHaveBeenCalledWith('u-1', '482913');
  });

  it('gives the same generic failure when no account matches', async () => {
    const { svc } = build(null);
    await expect(
      svc.resetPasswordWithOtp({ identifier: 'ghost@acme.com', code: '000000', password: 'Living@1234' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
