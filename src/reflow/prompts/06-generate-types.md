## Prompt

```
Generate TypeScript type definitions for a finite capacity production scheduling system. Include interfaces for domain entities and custom error classes.

Domain Context:
- Manufacturing scheduling system
- Work orders are scheduled on work centers (machines)
- Work centers have shift schedules and maintenance windows
- Work orders can have dependencies on other orders
- System performs "reflow" to reschedule orders respecting all constraints

Required Interfaces:

1. WorkOrder - A unit of work to be scheduled
   - docId: string - Unique identifier
   - docType: 'workOrder' - Discriminator literal
   - data object containing:
     - workOrderNumber: string - Human-readable reference
     - workCenterId: string - Target machine/resource
     - startDate: string - ISO 8601 UTC scheduled start
     - endDate: string - ISO 8601 UTC scheduled end
     - durationMinutes: number - Working time (not calendar time)
     - isMaintenance: boolean - If true, cannot be moved
     - dependsOnWorkOrderIds: string[] - Must complete before this starts

2. ShiftDefinition - When work can occur
   - dayOfWeek: number - 0=Sunday through 6=Saturday
   - startHour: number - 0-23 format
   - endHour: number - 0-23 format (if < startHour, wraps to next day)

3. MaintenanceWindow - Blocked time period
   - startDate: string - ISO 8601 UTC
   - endDate: string - ISO 8601 UTC
   - reason?: string - Optional description

4. WorkCenter - Machine/resource where work occurs
   - docId: string
   - docType: 'workCenter'
   - data object containing:
     - name: string
     - shifts: ShiftDefinition[] - Weekly schedule
     - maintenanceWindows: MaintenanceWindow[] - Blocked periods

5. ReflowResult - Result for single work order
   - workOrderId, workOrderNumber
   - originalStartDate, originalEndDate
   - newStartDate, newEndDate
   - wasRescheduled: boolean
   - isFixed: boolean

6. ReflowOutput - Complete operation result
   - results: ReflowResult[]
   - warnings: string[]
   - metadata: { totalOrders, rescheduledCount, fixedCount, processingTimeMs }

7. SchedulerConfig - Configuration options
   - allowEarlierStart?: boolean - Schedule before original start
   - timezone?: string - For shift calculations

Required Error Classes (extend Error):

1. CircularDependencyError
   - Property: cycle: string[] - IDs forming the cycle
   - Constructor: (cycle: string[], message?: string)
   - Default message: "Circular dependency detected: A -> B -> C -> A"

2. MissingDependencyError
   - Properties: workOrderId, missingDependencyId
   - Constructor: (workOrderId: string, missingDependencyId: string)
   - Message: "Work order X depends on non-existent order Y"

3. MissingWorkCenterError
   - Properties: workOrderId, workCenterId
   - Constructor: (workOrderId: string, workCenterId: string)
   - Message: "Work order X references non-existent work center Y"

Requirements:
- Use JSDoc comments with @description for each interface and field
- Explain business meaning, not just technical type
- Use literal types where appropriate (docType: 'workOrder')
- Error classes should set this.name = 'ErrorClassName'
- All dates as ISO 8601 strings (not Date objects)
- Export all interfaces and classes

Output: Single TypeScript file with all types and error classes.
```

