import { Body, Controller, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReflowRequestDto, ReflowResponseDto } from './dto/reflow.dto';
import { ReflowService } from './reflow.service';
import { ReflowExceptionFilter } from './reflow.filter';

@ApiTags('Reflow')
@Controller('reflow')
@UseFilters(ReflowExceptionFilter)
export class ReflowController {
  constructor(private readonly reflowService: ReflowService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reflow production schedule' })
  @ApiResponse({ status: 200, description: 'Schedule reflowed', type: ReflowResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  reflow(@Body() request: ReflowRequestDto): ReflowResponseDto {
    return this.reflowService.reflow(request);
  }
}
