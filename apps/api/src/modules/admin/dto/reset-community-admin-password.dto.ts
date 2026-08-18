import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ResetCommunityAdminPasswordDto {
  /**
   * Email the temporary password to the admin's own address. Defaults to true —
   * the reason this endpoint exists is that a password shown once on screen had
   * to be relayed by hand. Pass false to reset without notifying (e.g. when the
   * address is known to be wrong and the platform admin will relay it).
   */
  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  sendEmail?: boolean;
}
