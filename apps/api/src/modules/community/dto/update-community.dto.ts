import { PartialType } from '@nestjs/swagger';

import { CreateCommunityDto } from './create-community.dto';

/** All community fields become optional on update (code/slug remain unique). */
export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}
