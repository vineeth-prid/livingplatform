import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { BrandingService, ICON_SIZES, type BrandApp, type IconName } from './branding.service';

/**
 * Public white-label endpoints. The resident and workforce apps proxy
 * `/brand/*` on their own origin to here (nginx), because a PWA manifest and
 * its icons must be same-origin with the app that installs them.
 */
@ApiTags('Branding')
@Public()
@Controller('public/branding/:communityId')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @ApiOperation({ summary: "A community's public branding: name, logo, theme" })
  get(@Param('communityId') id: string) {
    return this.branding.publicView(id);
  }

  @Get('manifest.webmanifest')
  @ApiOperation({ summary: 'PWA manifest for this community (icons from its logo)' })
  async manifest(@Param('communityId') id: string, @Query('app') app: string, @Res() res: Response) {
    if (app !== 'resident' && app !== 'workforce') throw new BadRequestException('app must be resident or workforce');
    const body = await this.branding.manifest(id, app as BrandApp);
    res.set('Content-Type', 'application/manifest+json').set('Cache-Control', 'no-cache').send(JSON.stringify(body));
  }

  @Get(':file')
  @ApiOperation({ summary: 'Square PNG app icon built from the community logo' })
  async icon(@Param('communityId') id: string, @Param('file') file: string, @Res() res: Response) {
    const name = /^icon-(.+)\.png$/.exec(file)?.[1];
    if (!name || !(name in ICON_SIZES)) throw new NotFoundException();
    const png = await this.branding.icon(id, name as IconName);
    if (!png) throw new NotFoundException('This community has no logo');
    // URLs carry ?v=<version>, so a replaced logo is a new URL — safe to cache.
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400').send(png);
  }
}
