## Prompt

```
Generate NestJS DTOs (Data Transfer Objects) for a production scheduling API endpoint with full Swagger documentation and class-validator validation.

Context:
- POST /reflow endpoint that accepts work orders and work centers
- Returns rescheduled dates for all work orders
- Uses class-validator for validation and @nestjs/swagger for OpenAPI docs

Required DTOs:

1. Request DTOs:

   WorkOrderDataDto:
   - workOrderNumber: string (required) - Human-readable identifier
   - workCenterId: string (required) - Reference to work center
   - startDate: string (required) - ISO 8601 UTC datetime
   - endDate: string (required) - ISO 8601 UTC datetime  
   - durationMinutes: number (required) - Working time in minutes
   - isMaintenance?: boolean (optional) - If true, order is immovable
   - dependsOnWorkOrderIds?: string[] (optional) - Dependencies

   WorkOrderDto:
   - docId: string (required) - Unique identifier
   - data: WorkOrderDataDto (nested, validated)

   ShiftDefinitionDto:
   - dayOfWeek: number (required) - 0=Sunday to 6=Saturday
   - startHour: number (required) - 0-23
   - endHour: number (required) - 0-23

   MaintenanceWindowDto:
   - startDate: string (required) - ISO 8601 UTC
   - endDate: string (required) - ISO 8601 UTC
   - reason?: string (optional) - Description

   WorkCenterDataDto:
   - name: string (required)
   - shifts: ShiftDefinitionDto[] (required, nested array)
   - maintenanceWindows?: MaintenanceWindowDto[] (optional)

   WorkCenterDto:
   - docId: string (required)
   - data: WorkCenterDataDto (nested, validated)

   ReflowRequestDto:
   - workOrders: WorkOrderDto[] (required)
   - workCenters: WorkCenterDto[] (required)
   - allowEarlierStart?: boolean (optional)
   - timezone?: string (optional, default UTC)

2. Response DTOs:

   ReflowResultDto:
   - workOrderId, workOrderNumber
   - originalStartDate, originalEndDate
   - newStartDate, newEndDate
   - wasRescheduled: boolean
   - isFixed: boolean

   ReflowMetadataDto:
   - totalOrders, rescheduledCount, fixedCount, processingTimeMs

   ReflowResponseDto:
   - results: ReflowResultDto[]
   - warnings: string[]
   - metadata: ReflowMetadataDto

Requirements:
- Use @ApiProperty() with example values and descriptions
- Use @ApiPropertyOptional() for optional fields
- Use @IsString(), @IsNumber(), @IsBoolean(), @IsArray(), @IsOptional()
- Use @ValidateNested() with @Type() decorator for nested objects
- Use @IsString({ each: true }) for string arrays
- Provide realistic example values (dates, work order numbers)
- Group DTOs with comment sections (// ===== Work Order DTOs =====)

Dependencies:
- @nestjs/swagger (ApiProperty, ApiPropertyOptional)
- class-validator (IsString, IsNumber, IsBoolean, IsArray, IsOptional, ValidateNested)
- class-transformer (Type)

Output: Single TypeScript file with all DTO classes exported.
```

