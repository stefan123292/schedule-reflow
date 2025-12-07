/**
 * Production Schedule Reflow Module
 * 
 * This module provides finite capacity scheduling for manufacturing work orders.
 * It handles shift schedules, maintenance windows, dependencies, and machine capacity.
 * 
 * @example
 * ```typescript
 * import { SchedulerService, reflowSchedule, WorkOrder, WorkCenter } from './reflow';
 * 
 * // Create work centers with shift definitions
 * const workCenters: WorkCenter[] = [...];
 * 
 * // Create work orders with dependencies
 * const workOrders: WorkOrder[] = [...];
 * 
 * // Option 1: Use the convenience function
 * const result = reflowSchedule(workOrders, workCenters);
 * 
 * // Option 2: Use the service class for more control
 * const scheduler = new SchedulerService(workCenters, { timezone: 'America/New_York' });
 * const result = scheduler.reflow(workOrders);
 * ```
 */

// Core types
export type {
  WorkOrder,
  WorkCenter,
  ShiftDefinition,
  MaintenanceWindow,
  ReflowResult,
  ReflowOutput,
  SchedulerConfig,
} from './types';

// Error classes
export {
  CircularDependencyError,
  MissingDependencyError,
  MissingWorkCenterError,
} from './types';

// Main scheduler
export { SchedulerService, reflowSchedule } from './scheduler.service';

// DAG utilities (for advanced use cases)
export {
  buildDependencyGraph,
  topologicalSort,
  validateDependencies,
  getTransitiveDependents,
  getTransitiveDependencies,
} from './dag.service';

// Date utilities (for custom scheduling logic)
export {
  calculateEndDateWithShifts,
  findEarliestValidStart,
  findNextWorkableSlot,
  isWithinWorkingHours,
  convertTimezone,
  maxDateTime,
} from '../utils/date-utils';

