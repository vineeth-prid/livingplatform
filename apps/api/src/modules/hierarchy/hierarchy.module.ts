import { Module } from '@nestjs/common';

import { BlockService } from './block.service';
import { FloorService } from './floor.service';
import {
  BlocksController,
  FloorsController,
  PhasesController,
} from './hierarchy.controller';
import { PhaseService } from './phase.service';

@Module({
  controllers: [PhasesController, BlocksController, FloorsController],
  providers: [PhaseService, BlockService, FloorService],
  exports: [PhaseService, BlockService, FloorService],
})
export class HierarchyModule {}
