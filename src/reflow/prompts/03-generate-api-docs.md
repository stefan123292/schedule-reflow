## Prompt

```
Generate comprehensive REST API documentation for the POST /reflow endpoint in a NestJS production scheduling system.

Endpoint Overview:
- Performs finite capacity scheduling (reflow) for manufacturing work orders
- Respects dependencies, shift schedules, maintenance windows, and machine capacity
- Returns rescheduled dates for all work orders

Request Body Structure:
- workOrders[]: Array of work orders with docId, workOrderNumber, workCenterId, startDate, endDate, durationMinutes, isMaintenance, dependsOnWorkOrderIds
- workCenters[]: Array of work centers with docId, name, shifts (dayOfWeek, startHour, endHour), maintenanceWindows
- allowEarlierStart?: boolean - Allow scheduling before original start date
- timezone?: string - Timezone for shift calculations (default: UTC)

Response Structure:
- results[]: Array with workOrderId, originalStartDate, originalEndDate, newStartDate, newEndDate, wasRescheduled, isFixed
- warnings[]: Array of warning messages
- metadata: { totalOrders, rescheduledCount, fixedCount, processingTimeMs }

Documentation Required:

1. OpenAPI/Swagger Specification
   - Complete YAML spec with all schemas
   - Request/response examples
   - Error responses (400 for circular deps, missing refs, invalid data)

2. README Section
   - Endpoint description with business context
   - When to use this endpoint
   - Request/response field explanations
   - cURL and fetch examples

3. Error Catalog
   - CircularDependencyError - cycle in work order dependencies
   - MissingDependencyError - reference to non-existent work order
   - MissingWorkCenterError - reference to non-existent work center
   - Validation errors - invalid dates, negative duration, etc.

4. Usage Examples
   - Simple case: 2 independent orders
   - Dependency chain: A → B → C
   - Machine conflict: 2 orders same time, same machine
   - Shift spanning: order crosses shift boundary
   - Maintenance avoidance: order scheduled around blocked window

Include realistic example payloads with proper ISO dates and meaningful work order numbers.

Output format: Markdown documentation ready for README.md or API docs portal.
```
