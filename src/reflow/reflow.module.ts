import { Module } from '@nestjs/common';
import { ReflowController } from './reflow.controller';
import { ReflowService } from './reflow.service';

@Module({
  controllers: [ReflowController],
  providers: [ReflowService],
})
export class ReflowModule {}

