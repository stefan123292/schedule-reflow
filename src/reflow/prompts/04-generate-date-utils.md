## Prompt

```
Implement a TypeScript utility module for shift-aware date/time calculations in a manufacturing scheduling system using Luxon.

Core Concept:
- "Working time" = time when shifts are active (counts toward work duration)
- "Calendar time" = real elapsed time including off-hours (not used for duration)

Required Functions:

1. calculateEndDateWithShifts(startDate, durationMinutes, workCenter, timezone)
   - Given a start time and required working minutes, calculate the end date
   - Must respect shift schedules (only count time during active shifts)
   - Must avoid maintenance windows (blocked periods)
   - Handle work spanning multiple days/weeks
   - Safety limit to prevent infinite loops (365 days max search)
   - Example: Start 4pm, need 2hrs, shift ends 5pm → End 10am next day

2. findNextWorkableSlot(fromDate, workCenter, timezone)
   - Find the next continuous time slot where work can occur
   - Consider day-of-week shift schedules
   - Exclude maintenance windows
   - Handle overnight shifts (end hour < start hour)
   - Search up to 30 days ahead
   - Return { start, end, durationMinutes } or null

3. findEarliestValidStart(fromDate, workCenter, timezone)
   - Find first valid moment work can begin
   - Must be during active shift, not in maintenance
   - Return the later of: requested time or next shift start

4. isWithinWorkingHours(dateTime, workCenter, timezone)
   - Check if a specific moment is during working hours
   - Consider shift schedules and maintenance windows
   - Return boolean

5. subtractMaintenanceWindows(slotStart, slotEnd, maintenanceWindows, timezone)
   - Remove maintenance periods from a time slot
   - Return first available portion
   - Handle: fully blocked, partially blocked at start/end, blocked in middle

6. Helper utilities:
   - convertTimezone(dateTime, targetTimezone) - timezone conversion
   - maxDateTime(...dates) - return latest DateTime from array

Data Structures:
- WorkCenter: { data: { name, shifts: ShiftDefinition[], maintenanceWindows: MaintenanceWindow[] } }
- ShiftDefinition: { dayOfWeek: 0-6 (Sun-Sat), startHour: 0-23, endHour: 0-23 }
- MaintenanceWindow: { startDate: ISO string, endDate: ISO string }
- WorkableSlot: { start: DateTime, end: DateTime, durationMinutes: number }

Requirements:
- Use Luxon for all date/time operations
- Handle timezone conversions properly
- Support overnight shifts (e.g., 22:00 to 06:00)
- Throw descriptive errors when no valid slots found
- Include JSDoc comments with @param, @returns, @example
- Edge cases: zero duration, no shifts defined, fully blocked by maintenance

Output: Single TypeScript file with all functions exported.
```

