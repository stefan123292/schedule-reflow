import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// ============== Work Order DTOs ==============

export class WorkOrderDataDto {
  @ApiProperty({ example: 'WO-001', description: 'Human-readable work order number' })
  @IsString()
  workOrderNumber: string;

  @ApiProperty({ example: 'machine-a', description: 'Work center ID where this order will be processed' })
  @IsString()
  workCenterId: string;

  @ApiProperty({ example: '2025-12-08T09:00:00Z', description: 'Scheduled start date (ISO 8601 UTC)' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2025-12-08T11:00:00Z', description: 'Scheduled end date (ISO 8601 UTC)' })
  @IsString()
  endDate: string;

  @ApiProperty({ example: 120, description: 'Working time required in minutes' })
  @IsNumber()
  durationMinutes: number;

  @ApiPropertyOptional({ example: false, description: 'If true, this is an immovable maintenance window' })
  @IsBoolean()
  @IsOptional()
  isMaintenance?: boolean;

  @ApiPropertyOptional({
    example: [],
    description: 'Work order IDs that must complete before this order can start',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dependsOnWorkOrderIds?: string[];
}

export class WorkOrderDto {
  @ApiProperty({ example: 'wo-001', description: 'Unique document ID' })
  @IsString()
  docId: string;

  @ApiProperty({ type: WorkOrderDataDto })
  @ValidateNested()
  @Type(() => WorkOrderDataDto)
  data: WorkOrderDataDto;
}

// ============== Work Center DTOs ==============

export class ShiftDefinitionDto {
  @ApiProperty({ example: 1, description: 'Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday' })
  @IsNumber()
  dayOfWeek: number;

  @ApiProperty({ example: 8, description: 'Start hour (0-23)' })
  @IsNumber()
  startHour: number;

  @ApiProperty({ example: 17, description: 'End hour (0-23)' })
  @IsNumber()
  endHour: number;
}

export class MaintenanceWindowDto {
  @ApiProperty({ example: '2025-12-10T08:00:00Z', description: 'Start of blocked period (ISO 8601 UTC)' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2025-12-10T12:00:00Z', description: 'End of blocked period (ISO 8601 UTC)' })
  @IsString()
  endDate: string;

  @ApiPropertyOptional({ example: 'Planned maintenance', description: 'Reason for blocking' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class WorkCenterDataDto {
  @ApiProperty({ example: 'Machine A', description: 'Human-readable name' })
  @IsString()
  name: string;

  @ApiProperty({
    type: [ShiftDefinitionDto],
    description: 'Weekly shift schedule',
    example: [
      { dayOfWeek: 1, startHour: 8, endHour: 17 },
      { dayOfWeek: 2, startHour: 8, endHour: 17 },
      { dayOfWeek: 3, startHour: 8, endHour: 17 },
      { dayOfWeek: 4, startHour: 8, endHour: 17 },
      { dayOfWeek: 5, startHour: 8, endHour: 17 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftDefinitionDto)
  shifts: ShiftDefinitionDto[];

  @ApiPropertyOptional({
    type: [MaintenanceWindowDto],
    description: 'Blocked time windows',
    default: [],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaintenanceWindowDto)
  @IsOptional()
  maintenanceWindows?: MaintenanceWindowDto[];
}

export class WorkCenterDto {
  @ApiProperty({ example: 'machine-a', description: 'Unique document ID' })
  @IsString()
  docId: string;

  @ApiProperty({ type: WorkCenterDataDto })
  @ValidateNested()
  @Type(() => WorkCenterDataDto)
  data: WorkCenterDataDto;
}

// ============== Request DTO ==============

export class ReflowRequestDto {
  @ApiProperty({
    type: [WorkOrderDto],
    description: 'Work orders to schedule',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderDto)
  workOrders: WorkOrderDto[];

  @ApiProperty({
    type: [WorkCenterDto],
    description: 'Available work centers',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkCenterDto)
  workCenters: WorkCenterDto[];

  @ApiPropertyOptional({
    example: false,
    description: 'Allow scheduling earlier than original start date',
  })
  @IsBoolean()
  @IsOptional()
  allowEarlierStart?: boolean;

  @ApiPropertyOptional({
    example: 'UTC',
    description: 'Timezone for shift calculations',
  })
  @IsString()
  @IsOptional()
  timezone?: string;
}

// ============== Response DTOs ==============

export class ReflowResultDto {
  @ApiProperty({ example: 'wo-001' })
  workOrderId: string;

  @ApiProperty({ example: 'WO-001' })
  workOrderNumber: string;

  @ApiProperty({ example: '2025-12-08T09:00:00Z' })
  originalStartDate: string;

  @ApiProperty({ example: '2025-12-08T11:00:00Z' })
  originalEndDate: string;

  @ApiProperty({ example: '2025-12-08T09:00:00Z' })
  newStartDate: string;

  @ApiProperty({ example: '2025-12-08T11:00:00Z' })
  newEndDate: string;

  @ApiProperty({ example: false })
  wasRescheduled: boolean;

  @ApiProperty({ example: false })
  isFixed: boolean;
}

export class ReflowMetadataDto {
  @ApiProperty({ example: 3 })
  totalOrders: number;

  @ApiProperty({ example: 1 })
  rescheduledCount: number;

  @ApiProperty({ example: 0 })
  fixedCount: number;

  @ApiProperty({ example: 5 })
  processingTimeMs: number;
}

export class ReflowResponseDto {
  @ApiProperty({ type: [ReflowResultDto] })
  results: ReflowResultDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings: string[];

  @ApiProperty({ type: ReflowMetadataDto })
  metadata: ReflowMetadataDto;
}

