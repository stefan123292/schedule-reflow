/**
 * Production Schedule Reflow - Main Scheduler Service
 * 
 * This is the core scheduling engine that performs finite capacity scheduling
 * for manufacturing work orders. It handles:
 * 
 * - Dependency resolution via topological sort (DAG)
 * - Shift-aware time calculations
 * - Maintenance window avoidance
 * - Work center capacity constraints (no overlaps)
 * 
 * Algorithm Overview:
 * 1. Build dependency graph from work orders
 * 2. Perform topological sort to get processing order
 * 3. For each order (in topo order):
 *    a. Calculate earliest start = max(dependency ends, machine availability, original start)
 *    b. Use shift-aware calculation for end time
 *    c. Update machine availability tracker
 * 4. Return rescheduled orders with metadata
 */

import { DateTime } from 'luxon';
import {
  WorkOrder,
  WorkCenter,
  ReflowResult,
  ReflowOutput,
  SchedulerConfig,
  MissingWorkCenterError,
} from './types';
import { buildDependencyGraph, topologicalSort } from './dag.service';
import {
  calculateEndDateWithShifts,
  findEarliestValidStart,
  maxDateTime,
} from '../utils/date-utils';

/**
 * Tracks the availability of each work center.
 * Maps work center ID to the earliest time it becomes available.
 */
type WorkCenterAvailability = Map<string, DateTime>;

/**
 * Tracks the end times of completed/scheduled work orders.
 * Used for dependency resolution.
 */
type WorkOrderEndTimes = Map<string, DateTime>;

/**
 * Main scheduler class for production schedule reflow.
 * 
 * Usage:
 * ```typescript
 * const scheduler = new SchedulerService(workCenters);
 * const result = scheduler.reflow(workOrders);
 * ```
 */
export class SchedulerService {  
  private workCenters: Map<string, WorkCenter>;
  private config: Required<SchedulerConfig>;

  /**
   * Creates a new scheduler instance.
   * 
   * @param workCenters - Array of work centers available for scheduling
   * @param config - Optional configuration overrides
   */
  constructor(workCenters: WorkCenter[], config: SchedulerConfig = {}) {
    // Index work centers by ID for O(1) lookup
    this.workCenters = new Map(workCenters.map(wc => [wc.docId, wc]));
    
    // Apply default configuration
    this.config = {
      allowEarlierStart: config.allowEarlierStart ?? false,
      timezone: config.timezone ?? 'UTC',
    };
  }

  /**
   * Performs a complete schedule reflow operation.
   * 
   * This is the main entry point for rescheduling work orders.
   * It respects all constraints: dependencies, shifts, maintenance, and machine capacity.
   * 
   * @param workOrders - Array of work orders to reschedule
   * @returns Complete reflow output with results and metadata
   */
  reflow(workOrders: WorkOrder[]): ReflowOutput {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Validate all work centers exist
    this.validateWorkCenters(workOrders);

    // Step 1: Build dependency graph and get topological order
    // This ensures we process dependencies before their dependents
    const graph = buildDependencyGraph(workOrders);
    const sortedOrders = topologicalSort(graph);

    // Step 2: Initialize tracking structures
    // - workCenterAvailability: When each machine is next free
    // - workOrderEndTimes: When each order completes (for dependency resolution)
    const workCenterAvailability: WorkCenterAvailability = new Map();
    const workOrderEndTimes: WorkOrderEndTimes = new Map();

    // Step 3: Process each work order in topological order
    const results: ReflowResult[] = [];

    for (const order of sortedOrders) {
      const result = this.scheduleWorkOrder(
        order,
        workCenterAvailability,
        workOrderEndTimes,
        warnings,
      );
      
      results.push(result);
    }

    // Step 4: Compile statistics and return
    const processingTimeMs = Date.now() - startTime;
    const rescheduledCount = results.filter(r => r.wasRescheduled).length;
    const fixedCount = results.filter(r => r.isFixed).length;

    return {
      results,
      warnings,
      metadata: {
        totalOrders: workOrders.length,
        rescheduledCount,
        fixedCount,
        processingTimeMs,
      },
    };
  }

  /**
   * Schedules a single work order, updating availability trackers.
   * 
   * The earliest start time is the maximum of:
   * 1. All dependency end times (work can't start until dependencies complete)
   * 2. Work center availability (no overlap with previous orders on same machine)
   * 3. Original start time (unless allowEarlierStart is enabled)
   * 4. First valid shift time (work must occur during shifts)
   * 
   * @param order - Work order to schedule
   * @param workCenterAvailability - Tracker for machine availability
   * @param workOrderEndTimes - Tracker for completed order end times
   * @param warnings - Array to accumulate any warnings
   * @returns The scheduling result for this order
   */
  private scheduleWorkOrder(
    order: WorkOrder,
    workCenterAvailability: WorkCenterAvailability,
    workOrderEndTimes: WorkOrderEndTimes,
    warnings: string[],
  ): ReflowResult {
    const workCenter = this.workCenters.get(order.data.workCenterId)!;
    const originalStart = DateTime.fromISO(order.data.startDate, { zone: this.config.timezone });
    const originalEnd = DateTime.fromISO(order.data.endDate, { zone: this.config.timezone });

    // Maintenance orders are immovable - they define blocked time
    // We still track them for work center availability
    if (order.data.isMaintenance) {
      // Update work center availability to after this maintenance window
      const currentAvailability = workCenterAvailability.get(order.data.workCenterId);
      if (!currentAvailability || originalEnd > currentAvailability) {
        workCenterAvailability.set(order.data.workCenterId, originalEnd);
      }

      // Track end time for any orders that depend on this maintenance
      workOrderEndTimes.set(order.docId, originalEnd);

      return {
        workOrderId: order.docId,
        workOrderNumber: order.data.workOrderNumber,
        originalStartDate: order.data.startDate,
        originalEndDate: order.data.endDate,
        newStartDate: order.data.startDate,
        newEndDate: order.data.endDate,
        wasRescheduled: false,
        isFixed: true,
      };
    }

    // Calculate earliest possible start time based on all constraints
    const earliestStart = this.calculateEarliestStart(
      order,
      workCenterAvailability,
      workOrderEndTimes,
    );

    // Find the first valid start time (during a shift, not in maintenance)
    const validStart = findEarliestValidStart(
      earliestStart,
      workCenter,
      this.config.timezone,
    );

    // Calculate end time using shift-aware duration calculation
    const newEnd = calculateEndDateWithShifts(
      validStart,
      order.data.durationMinutes,
      workCenter,
      this.config.timezone,
    );

    // Update work center availability
    workCenterAvailability.set(order.data.workCenterId, newEnd);

    // Track end time for dependent orders
    workOrderEndTimes.set(order.docId, newEnd);

    // Check if schedule actually changed
    const wasRescheduled = !validStart.equals(originalStart) || !newEnd.equals(originalEnd);

    // Generate warning if order moved significantly
    if (wasRescheduled) {
      const delayMinutes = validStart.diff(originalStart, 'minutes').minutes;
      if (delayMinutes > 0) {
        warnings.push(
          `Work order "${order.data.workOrderNumber}" delayed by ${Math.round(delayMinutes)} minutes`
        );
      }
    }

    return {
      workOrderId: order.docId,
      workOrderNumber: order.data.workOrderNumber,
      originalStartDate: order.data.startDate,
      originalEndDate: order.data.endDate,
      newStartDate: validStart.toISO()!,
      newEndDate: newEnd.toISO()!,
      wasRescheduled,
      isFixed: false,
    };
  }

  /**
   * Calculates the earliest possible start time for a work order.
   * 
   * This is the key constraint resolution function. It considers:
   * 1. Dependency constraints: Must start after all dependencies complete
   * 2. Machine constraints: Must start after machine is available
   * 3. Original timing: Must not start earlier than originally planned (unless configured)
   * 
   * @param order - Work order to calculate start for
   * @param workCenterAvailability - Current machine availability
   * @param workOrderEndTimes - End times of scheduled orders
   * @returns The earliest DateTime this order can start
   */
  private calculateEarliestStart(
    order: WorkOrder,
    workCenterAvailability: WorkCenterAvailability,
    workOrderEndTimes: WorkOrderEndTimes,
  ): DateTime {
    const constraints: DateTime[] = [];

    // Constraint 1: Original start time (if not allowing earlier start)
    if (!this.config.allowEarlierStart) {
      constraints.push(
        DateTime.fromISO(order.data.startDate, { zone: this.config.timezone })
      );
    }

    // Constraint 2: Work center availability
    // The order can't start until the machine is free from previous orders
    const machineAvailability = workCenterAvailability.get(order.data.workCenterId);
    if (machineAvailability) {
      constraints.push(machineAvailability);
    }

    // Constraint 3: Dependency end times
    // The order can't start until all dependencies have completed
    for (const depId of order.data.dependsOnWorkOrderIds) {
      const depEndTime = workOrderEndTimes.get(depId);
      if (depEndTime) {
        constraints.push(depEndTime);
      }
    }

    // Return the maximum (latest) of all constraints
    // If no constraints, use current time
    const max = maxDateTime(...constraints);
    return max ?? DateTime.now().setZone(this.config.timezone);
  }

  /**
   * Validates that all work orders reference existing work centers.
   * 
   * @param workOrders - Orders to validate
   * @throws MissingWorkCenterError if any work center is not found
   */
  private validateWorkCenters(workOrders: WorkOrder[]): void {
    for (const order of workOrders) {
      if (!this.workCenters.has(order.data.workCenterId)) {
        throw new MissingWorkCenterError(order.docId, order.data.workCenterId);
      }
    }
  }

  /**
   * Reschedules a single work order, considering its impact on dependent orders.
   * 
   * This is useful for "what-if" scenarios or handling disruptions to
   * individual orders without reprocessing the entire schedule.
   * 
   * @param workOrderId - ID of the order to reschedule
   * @param newStartDate - New proposed start date
   * @param allOrders - All work orders (for dependency resolution)
   * @returns Reflow output for affected orders only
   */
  rescheduleOrder(
    workOrderId: string,
    newStartDate: string,
    allOrders: WorkOrder[],
  ): ReflowOutput {
    // Find the target order and update its start date
    const updatedOrders = allOrders.map(order => {
      if (order.docId === workOrderId) {
        return {
          ...order,
          data: {
            ...order.data,
            startDate: newStartDate,
          },
        };
      }
      return order;
    });

    // Run full reflow with updated orders
    return this.reflow(updatedOrders);
  }
}

/**
 * Convenience function to run a one-off reflow operation.
 * 
 * @param workOrders - Work orders to schedule
 * @param workCenters - Available work centers
 * @param config - Optional configuration
 * @returns Complete reflow output
 */
export function reflowSchedule(
  workOrders: WorkOrder[],
  workCenters: WorkCenter[],
  config?: SchedulerConfig,
): ReflowOutput {
  const scheduler = new SchedulerService(workCenters, config);
  return scheduler.reflow(workOrders);
}

