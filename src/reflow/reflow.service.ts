import { Injectable } from '@nestjs/common';
import { ReflowRequestDto } from './dto/reflow.dto';
import { SchedulerService } from './scheduler.service';
import { WorkOrder, WorkCenter, ReflowOutput } from './types';

@Injectable()
export class ReflowService {
  reflow(request: ReflowRequestDto): ReflowOutput {
    const workOrders = this.toWorkOrders(request.workOrders);
    const workCenters = this.toWorkCenters(request.workCenters);

    const scheduler = new SchedulerService(workCenters, {
      allowEarlierStart: request.allowEarlierStart,
      timezone: request.timezone,
    });

    return scheduler.reflow(workOrders);
  }

  private toWorkOrders(dtos: ReflowRequestDto['workOrders']): WorkOrder[] {
    return dtos.map((dto) => ({
      docId: dto.docId,
      docType: 'workOrder',
      data: {
        workOrderNumber: dto.data.workOrderNumber,
        workCenterId: dto.data.workCenterId,
        startDate: dto.data.startDate,
        endDate: dto.data.endDate,
        durationMinutes: dto.data.durationMinutes,
        isMaintenance: dto.data.isMaintenance ?? false,
        dependsOnWorkOrderIds: dto.data.dependsOnWorkOrderIds ?? [],
      },
    }));
  }

  private toWorkCenters(dtos: ReflowRequestDto['workCenters']): WorkCenter[] {
    return dtos.map((dto) => ({
      docId: dto.docId,
      docType: 'workCenter',
      data: {
        name: dto.data.name,
        shifts: dto.data.shifts,
        maintenanceWindows: dto.data.maintenanceWindows ?? [],
      },
    }));
  }
}

