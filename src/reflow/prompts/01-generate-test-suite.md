## Prompt

```
Write a comprehensive Jest test suite for a production scheduling system (finite capacity scheduler) in TypeScript/NestJS.

The system has these core components:
1. SchedulerService - Main scheduler with `reflow(workOrders)` method
2. DAG Service - `buildDependencyGraph()`, `topologicalSort()`, `validateDependencies()`
3. Date Utils - `calculateEndDateWithShifts()`, `findEarliestValidStart()`

Data structures:
- WorkOrder: { docId, data: { workOrderNumber, workCenterId, startDate (ISO), endDate (ISO), durationMinutes, isMaintenance, dependsOnWorkOrderIds[] } }
- WorkCenter: { docId, data: { name, shifts: [{ dayOfWeek (0-6), startHour, endHour }], maintenanceWindows: [{ startDate, endDate, reason? }] } }

Test scenarios to cover:

1. Shift Span: Work order starting near shift end should span to next day (e.g., starts 4pm, needs 2hrs, shift ends 5pm → completes 10am next day)

2. Dependency Cascade: When Order A is delayed, dependent Order B must also move. Test multi-level chains (A→B→C) and cross-machine dependencies.

3. Maintenance Windows: 
   - Maintenance orders are immovable (isFixed: true)
   - Regular work must schedule around work center maintenance windows

4. Work Center Capacity: 
   - No overlapping orders on same machine
   - Parallel execution allowed on different machines

5. DAG Validation:
   - Detect circular dependencies (A→B→C→A) and throw CircularDependencyError
   - Report missing dependency references
   - Process independent orders without artificial sequencing

6. Edge Cases: Zero duration, empty order list, metadata accuracy

Include:
- Helper factories: `createWorkOrder()` and `createWorkCenter()` with sensible defaults
- Clear test descriptions explaining the scenario
- Comments documenting expected behavior
- Use Monday Jan 15, 2024 as base date (weekday)
- Default shift: Mon-Fri 9am-5pm UTC

Output format: Single TypeScript file with Jest describe/it blocks, properly organized by scenario category.
```
