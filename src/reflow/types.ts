/**
 * Production Schedule Reflow - Type Definitions
 * 
 * These interfaces define the core data structures for the finite capacity
 * scheduling system. All dates are stored as ISO strings in UTC timezone.
 */

/**
 * Represents a single work order in the production schedule.
 * Work orders are the atomic units of work that need to be scheduled.
 */
export interface WorkOrder {
  docId: string;
  docType: 'workOrder';
  data: {
    /** Human-readable work order number for display/reference */
    workOrderNumber: string;
    
    /** Reference to the work center where this order will be processed */
    workCenterId: string;
    
    /** Scheduled start date/time as ISO 8601 string (UTC) */
    startDate: string;
    
    /** Scheduled end date/time as ISO 8601 string (UTC) */
    endDate: string;
    
    /** 
     * Total productive time required to complete this order.
     * This is "working time" - pauses during off-shift periods are not counted.
     */
    durationMinutes: number;
    
    /**
     * If true, this is a maintenance window that cannot be moved.
     * Other orders must schedule around maintenance orders.
     */
    isMaintenance: boolean;
    
    /**
     * List of work order docIds that must complete before this order can start.
     * Used to build the dependency DAG.
     */
    dependsOnWorkOrderIds: string[];
  };
}

/**
 * Defines a shift window for a specific day of the week.
 * Shifts define when productive work can occur at a work center.
 */
export interface ShiftDefinition {
  /** Day of week: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday */
  dayOfWeek: number;
  
  /** Start hour in 24-hour format (0-23) */
  startHour: number;
  
  /** End hour in 24-hour format (0-23). If less than startHour, wraps to next day. */
  endHour: number;
}

/**
 * Defines a blocked time window where work cannot be performed.
 * This could be for planned maintenance, holidays, or other reasons.
 */
export interface MaintenanceWindow {
  /** Start of blocked period as ISO 8601 string (UTC) */
  startDate: string;
  
  /** End of blocked period as ISO 8601 string (UTC) */
  endDate: string;
  
  /** Optional description of why this window is blocked */
  reason?: string;
}

/**
 * Represents a work center (machine, station, or resource) where work orders
 * are processed. Each work center has its own shift schedule and maintenance windows.
 */
export interface WorkCenter {
  docId: string;
  docType: 'workCenter';
  data: {
    /** Human-readable name for the work center */
    name: string;
    
    /**
     * Weekly shift schedule. Multiple shifts per day are supported.
     * If no shifts are defined for a day, no work can occur on that day.
     */
    shifts: ShiftDefinition[];
    
    /**
     * Specific date ranges where this work center is unavailable.
     * Takes precedence over shift schedules (blocks work even during normal shifts).
     */
    maintenanceWindows: MaintenanceWindow[];
  };
}

/**
 * Result of the reflow operation for a single work order.
 * Contains the original order plus the newly calculated schedule.
 */
export interface ReflowResult {
  /** The original work order docId */
  workOrderId: string;
  
  /** The original work order number for reference */
  workOrderNumber: string;
  
  /** Original start date before reflow */
  originalStartDate: string;
  
  /** Original end date before reflow */
  originalEndDate: string;
  
  /** Newly calculated start date after reflow */
  newStartDate: string;
  
  /** Newly calculated end date after reflow */
  newEndDate: string;
  
  /** Whether the schedule was changed by the reflow */
  wasRescheduled: boolean;
  
  /** If true, this order could not be moved (maintenance order) */
  isFixed: boolean;
}

/**
 * Complete output of a reflow operation.
 */
export interface ReflowOutput {
  /** Results for each work order, in topological order */
  results: ReflowResult[];
  
  /** Any warnings generated during scheduling */
  warnings: string[];
  
  /** Processing metadata */
  metadata: {
    /** Number of orders processed */
    totalOrders: number;
    
    /** Number of orders that were rescheduled */
    rescheduledCount: number;
    
    /** Number of fixed (immovable) orders */
    fixedCount: number;
    
    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
}

/**
 * Configuration options for the scheduler.
 */
export interface SchedulerConfig {
  /**
   * If true, allows scheduling work orders before their original start date
   * when dependencies are satisfied earlier. Default: false
   */
  allowEarlierStart?: boolean;
  
  /**
   * Timezone to use for shift calculations. Default: 'UTC'
   */
  timezone?: string;
}

/**
 * Error thrown when a circular dependency is detected in work order dependencies.
 */
export class CircularDependencyError extends Error {
  constructor(
    public readonly cycle: string[],
    message?: string,
  ) {
    super(message || `Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when a work order references a non-existent dependency.
 */
export class MissingDependencyError extends Error {
  constructor(
    public readonly workOrderId: string,
    public readonly missingDependencyId: string,
  ) {
    super(
      `Work order "${workOrderId}" depends on non-existent order "${missingDependencyId}"`,
    );
    this.name = 'MissingDependencyError';
  }
}

/**
 * Error thrown when a work center referenced by a work order doesn't exist.
 */
export class MissingWorkCenterError extends Error {
  constructor(
    public readonly workOrderId: string,
    public readonly workCenterId: string,
  ) {
    super(
      `Work order "${workOrderId}" references non-existent work center "${workCenterId}"`,
    );
    this.name = 'MissingWorkCenterError';
  }
}


