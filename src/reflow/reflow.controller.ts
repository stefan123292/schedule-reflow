import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReflowRequestDto, ReflowResponseDto } from './dto/reflow.dto';
import { SchedulerService } from './scheduler.service';
import { WorkOrder, WorkCenter } from './types';

@ApiTags('Reflow')
@Controller('reflow')
export class ReflowController {
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reflow production schedule',
    description: `
Performs finite capacity scheduling for work orders.

**Algorithm:**
1. Build dependency graph from work orders
2. Topological sort to determine processing order
3. For each order: calculate earliest valid start respecting:
   - Dependencies (must complete before dependent can start)
   - Machine availability (no overlapping orders on same machine)
   - Shift schedules (work only during shift hours)
   - Maintenance windows (avoid blocked periods)

**Returns** rescheduled dates for all work orders.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Schedule successfully reflowed',
    type: ReflowResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (circular dependency, missing reference, etc.)',
  })
  reflow(@Body() request: ReflowRequestDto): ReflowResponseDto {
    // Convert DTOs to domain types
    const workOrders: WorkOrder[] = request.workOrders.map((wo) => ({
      docId: wo.docId,
      docType: 'workOrder' as const,
      data: {
        workOrderNumber: wo.data.workOrderNumber,
        workCenterId: wo.data.workCenterId,
        startDate: wo.data.startDate,
        endDate: wo.data.endDate,
        durationMinutes: wo.data.durationMinutes,
        isMaintenance: wo.data.isMaintenance ?? false,
        dependsOnWorkOrderIds: wo.data.dependsOnWorkOrderIds ?? [],
      },
    }));

    const workCenters: WorkCenter[] = request.workCenters.map((wc) => ({
      docId: wc.docId,
      docType: 'workCenter' as const,
      data: {
        name: wc.data.name,
        shifts: wc.data.shifts,
        maintenanceWindows: wc.data.maintenanceWindows ?? [],
      },
    }));

    // Create scheduler and run reflow
    const scheduler = new SchedulerService(workCenters, {
      allowEarlierStart: request.allowEarlierStart,
      timezone: request.timezone,
    });

    return scheduler.reflow(workOrders);
  }
}

