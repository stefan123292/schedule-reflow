import { Module } from '@nestjs/common';
import { ReflowController } from './reflow.controller';

@Module({
  controllers: [ReflowController],
})
export class ReflowModule {}

