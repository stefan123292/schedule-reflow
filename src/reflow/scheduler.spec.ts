/**
 * Production Schedule Reflow - Test Suite
 * 
 * This test suite covers the core scheduling scenarios:
 * 1. Shift span - work that crosses shift boundaries
 * 2. Dependency cascade - changes propagating through dependencies
 * 3. Maintenance window handling
 * 4. Work center capacity (no overlaps)
 * 5. DAG cycle detection
 */

import { DateTime } from 'luxon';
import { SchedulerService, reflowSchedule } from './scheduler.service';
import { buildDependencyGraph, topologicalSort, validateDependencies } from './dag.service';
import { calculateEndDateWithShifts, findEarliestValidStart } from '../utils/date-utils';
import { WorkOrder, WorkCenter, CircularDependencyError } from './types';

/**
 * Helper factory to create work orders with sensible defaults.
 */
function createWorkOrder(overrides: Partial<WorkOrder['data']> & { 
  docId?: string;
  workCenterId?: string;
}): WorkOrder {
  const docId = overrides.docId ?? `wo-${Math.random().toString(36).slice(2, 9)}`;
  return {
    docId,
    docType: 'workOrder',
    data: {
      workOrderNumber: overrides.workOrderNumber ?? `WO-${docId}`,
      workCenterId: overrides.workCenterId ?? 'wc-1',
      startDate: overrides.startDate ?? '2024-01-15T09:00:00.000Z',
      endDate: overrides.endDate ?? '2024-01-15T10:00:00.000Z',
      durationMinutes: overrides.durationMinutes ?? 60,
      isMaintenance: overrides.isMaintenance ?? false,
      dependsOnWorkOrderIds: overrides.dependsOnWorkOrderIds ?? [],
    },
  };
}

/**
 * Helper factory to create work centers with sensible defaults.
 */
function createWorkCenter(overrides: Partial<WorkCenter['data']> & {
  docId?: string;
} = {}): WorkCenter {
  const docId = overrides.docId ?? 'wc-1';
  return {
    docId,
    docType: 'workCenter',
    data: {
      name: overrides.name ?? `Work Center ${docId}`,
      shifts: overrides.shifts ?? [
        // Default: Monday-Friday, 9am-5pm
        { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday
        { dayOfWeek: 2, startHour: 9, endHour: 17 }, // Tuesday
        { dayOfWeek: 3, startHour: 9, endHour: 17 }, // Wednesday
        { dayOfWeek: 4, startHour: 9, endHour: 17 }, // Thursday
        { dayOfWeek: 5, startHour: 9, endHour: 17 }, // Friday
      ],
      maintenanceWindows: overrides.maintenanceWindows ?? [],
    },
  };
}

describe('SchedulerService', () => {
  describe('Shift Span Scenario', () => {
    /**
     * Test: Work order starts 1 hour before shift ends, requires 2 hours total.
     * 
     * Scenario:
     * - Shift: 9am-5pm (8 hours)
     * - Order starts at 4pm (16:00)
     * - Duration: 2 hours (120 minutes)
     * - Expected: 1 hour today (4pm-5pm), pause overnight, 1 hour tomorrow (9am-10am)
     * - Result: Ends at 10am next day
     */
    it('should span work across shift boundaries correctly', () => {
      // Monday, January 15, 2024 at 4pm UTC
      const startDate = '2024-01-15T16:00:00.000Z';
      
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday 9am-5pm
          { dayOfWeek: 2, startHour: 9, endHour: 17 }, // Tuesday 9am-5pm
        ],
      });

      const workOrder = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate,
        endDate: '2024-01-15T18:00:00.000Z', // Original (incorrect) end
        durationMinutes: 120, // 2 hours
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([workOrder]);

      // Verify the result
      expect(result.results).toHaveLength(1);
      const orderResult = result.results[0];

      // Start should remain at 4pm Monday
      expect(orderResult.newStartDate).toBe('2024-01-15T16:00:00.000Z');

      // End should be 10am Tuesday (1 hour Monday + 1 hour Tuesday)
      expect(orderResult.newEndDate).toBe('2024-01-16T10:00:00.000Z');
      expect(orderResult.wasRescheduled).toBe(true);
    });

    it('should handle work starting exactly at shift start', () => {
      const startDate = '2024-01-15T09:00:00.000Z'; // Monday 9am

      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday 9am-5pm
        ],
      });

      const workOrder = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate,
        endDate: '2024-01-15T11:00:00.000Z',
        durationMinutes: 120, // 2 hours
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([workOrder]);

      const orderResult = result.results[0];
      // Should complete within the same shift
      expect(orderResult.newStartDate).toBe('2024-01-15T09:00:00.000Z');
      expect(orderResult.newEndDate).toBe('2024-01-15T11:00:00.000Z');
    });

    it('should push work to next available shift if starting outside shift hours', () => {
      // Saturday - no shifts defined
      const startDate = '2024-01-13T10:00:00.000Z';

      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Only Monday
        ],
      });

      const workOrder = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate,
        endDate: '2024-01-13T11:00:00.000Z',
        durationMinutes: 60,
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([workOrder]);

      const orderResult = result.results[0];
      // Should move to Monday 9am
      expect(orderResult.newStartDate).toBe('2024-01-15T09:00:00.000Z');
      expect(orderResult.newEndDate).toBe('2024-01-15T10:00:00.000Z');
      expect(orderResult.wasRescheduled).toBe(true);
    });
  });

  describe('Dependency Cascade Scenario', () => {
    /**
     * Test: Order A moves, verify Order B (which depends on A) moves accordingly.
     * 
     * Scenario:
     * - Order A: starts 9am, 2 hours duration
     * - Order B: depends on A, originally starts at 11am, 1 hour duration
     * - If A is delayed (starts at 10am instead), B must also move
     */
    it('should cascade delays through dependencies', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday
        ],
      });

      // Order A - will be delayed because it starts at 10am
      const orderA = createWorkOrder({
        docId: 'wo-a',
        workOrderNumber: 'WO-A',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T10:00:00.000Z', // 10am
        endDate: '2024-01-15T12:00:00.000Z',   // 12pm
        durationMinutes: 120, // 2 hours
      });

      // Order B - depends on A, originally at 11am (would overlap without dependency)
      const orderB = createWorkOrder({
        docId: 'wo-b',
        workOrderNumber: 'WO-B',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T11:00:00.000Z', // 11am - would overlap with A
        endDate: '2024-01-15T12:00:00.000Z',
        durationMinutes: 60, // 1 hour
        dependsOnWorkOrderIds: ['wo-a'],
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([orderB, orderA]); // Intentionally out of order

      // Find results
      const resultA = result.results.find(r => r.workOrderId === 'wo-a')!;
      const resultB = result.results.find(r => r.workOrderId === 'wo-b')!;

      // Order A should start at 10am, end at 12pm
      expect(resultA.newStartDate).toBe('2024-01-15T10:00:00.000Z');
      expect(resultA.newEndDate).toBe('2024-01-15T12:00:00.000Z');

      // Order B must start AFTER A ends (12pm) due to dependency
      // It should start at 12pm and end at 1pm
      expect(resultB.newStartDate).toBe('2024-01-15T12:00:00.000Z');
      expect(resultB.newEndDate).toBe('2024-01-15T13:00:00.000Z');
      expect(resultB.wasRescheduled).toBe(true);
    });

    it('should handle multi-level dependency chains', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 },
        ],
      });

      // Chain: A -> B -> C
      const orderA = createWorkOrder({
        docId: 'wo-a',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const orderB = createWorkOrder({
        docId: 'wo-b',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z', // Same time - should move
        durationMinutes: 60,
        dependsOnWorkOrderIds: ['wo-a'],
      });

      const orderC = createWorkOrder({
        docId: 'wo-c',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z', // Same time - should move
        durationMinutes: 60,
        dependsOnWorkOrderIds: ['wo-b'],
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([orderC, orderB, orderA]); // Randomized order

      const resultA = result.results.find(r => r.workOrderId === 'wo-a')!;
      const resultB = result.results.find(r => r.workOrderId === 'wo-b')!;
      const resultC = result.results.find(r => r.workOrderId === 'wo-c')!;

      // A: 9-10am
      expect(resultA.newStartDate).toBe('2024-01-15T09:00:00.000Z');
      expect(resultA.newEndDate).toBe('2024-01-15T10:00:00.000Z');

      // B: 10-11am (after A)
      expect(resultB.newStartDate).toBe('2024-01-15T10:00:00.000Z');
      expect(resultB.newEndDate).toBe('2024-01-15T11:00:00.000Z');

      // C: 11am-12pm (after B)
      expect(resultC.newStartDate).toBe('2024-01-15T11:00:00.000Z');
      expect(resultC.newEndDate).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should respect dependencies across different work centers', () => {
      const workCenter1 = createWorkCenter({
        docId: 'wc-1',
        name: 'Machine 1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const workCenter2 = createWorkCenter({
        docId: 'wc-2',
        name: 'Machine 2',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      // Order A on machine 1
      const orderA = createWorkOrder({
        docId: 'wo-a',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 120, // 2 hours, ends at 11am
      });

      // Order B on machine 2, depends on A
      const orderB = createWorkOrder({
        docId: 'wo-b',
        workCenterId: 'wc-2',
        startDate: '2024-01-15T09:00:00.000Z', // Wants to start at 9am
        durationMinutes: 60,
        dependsOnWorkOrderIds: ['wo-a'],
      });

      const scheduler = new SchedulerService([workCenter1, workCenter2]);
      const result = scheduler.reflow([orderA, orderB]);

      const resultB = result.results.find(r => r.workOrderId === 'wo-b')!;

      // B must wait for A even though it's on a different machine
      expect(resultB.newStartDate).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('Maintenance Window Handling', () => {
    it('should keep maintenance orders fixed (immovable)', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const maintenanceOrder = createWorkOrder({
        docId: 'wo-maint',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T12:00:00.000Z',
        endDate: '2024-01-15T13:00:00.000Z',
        durationMinutes: 60,
        isMaintenance: true,
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([maintenanceOrder]);

      const maintResult = result.results[0];
      expect(maintResult.isFixed).toBe(true);
      expect(maintResult.wasRescheduled).toBe(false);
      expect(maintResult.newStartDate).toBe(maintenanceOrder.data.startDate);
      expect(maintResult.newEndDate).toBe(maintenanceOrder.data.endDate);
    });

    it('should schedule around work center maintenance windows', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 },
        ],
        maintenanceWindows: [
          {
            startDate: '2024-01-15T11:00:00.000Z',
            endDate: '2024-01-15T13:00:00.000Z',
            reason: 'Scheduled maintenance',
          },
        ],
      });

      // Order starts at 10am, needs 3 hours
      // Without maintenance: 10am-1pm
      // With maintenance window (11am-1pm): 10am-11am (1hr) + 1pm-3pm (2hrs) = end at 3pm
      const workOrder = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T10:00:00.000Z',
        durationMinutes: 180, // 3 hours
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([workOrder]);

      const orderResult = result.results[0];
      // Work before maintenance: 10-11am (1 hour)
      // Maintenance: 11am-1pm (blocked)
      // Work after maintenance: 1pm-3pm (2 hours)
      expect(orderResult.newStartDate).toBe('2024-01-15T10:00:00.000Z');
      expect(orderResult.newEndDate).toBe('2024-01-15T15:00:00.000Z');
    });
  });

  describe('Work Center Capacity (No Overlaps)', () => {
    it('should prevent overlapping orders on same work center', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      // Two orders wanting to start at the same time
      const order1 = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const order2 = createWorkOrder({
        docId: 'wo-2',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z', // Same start time
        durationMinutes: 60,
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([order1, order2]);

      const result1 = result.results.find(r => r.workOrderId === 'wo-1')!;
      const result2 = result.results.find(r => r.workOrderId === 'wo-2')!;

      // One should be at 9am, the other at 10am (no overlap)
      const times = [result1.newStartDate, result2.newStartDate].sort();
      expect(times).toEqual([
        '2024-01-15T09:00:00.000Z',
        '2024-01-15T10:00:00.000Z',
      ]);
    });

    it('should allow parallel execution on different work centers', () => {
      const workCenter1 = createWorkCenter({
        docId: 'wc-1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const workCenter2 = createWorkCenter({
        docId: 'wc-2',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const order1 = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const order2 = createWorkOrder({
        docId: 'wo-2',
        workCenterId: 'wc-2',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const scheduler = new SchedulerService([workCenter1, workCenter2]);
      const result = scheduler.reflow([order1, order2]);

      const result1 = result.results.find(r => r.workOrderId === 'wo-1')!;
      const result2 = result.results.find(r => r.workOrderId === 'wo-2')!;

      // Both can start at 9am (different machines)
      expect(result1.newStartDate).toBe('2024-01-15T09:00:00.000Z');
      expect(result2.newStartDate).toBe('2024-01-15T09:00:00.000Z');
    });
  });

  describe('DAG and Topological Sort', () => {
    it('should detect circular dependencies', () => {
      // A depends on B, B depends on C, C depends on A
      const workOrders: WorkOrder[] = [
        createWorkOrder({
          docId: 'wo-a',
          dependsOnWorkOrderIds: ['wo-b'],
        }),
        createWorkOrder({
          docId: 'wo-b',
          dependsOnWorkOrderIds: ['wo-c'],
        }),
        createWorkOrder({
          docId: 'wo-c',
          dependsOnWorkOrderIds: ['wo-a'],
        }),
      ];

      expect(() => {
        const graph = buildDependencyGraph(workOrders);
        topologicalSort(graph);
      }).toThrow(CircularDependencyError);
    });

    it('should validate dependencies correctly', () => {
      const validOrders: WorkOrder[] = [
        createWorkOrder({ docId: 'wo-a', dependsOnWorkOrderIds: [] }),
        createWorkOrder({ docId: 'wo-b', dependsOnWorkOrderIds: ['wo-a'] }),
      ];

      const result = validateDependencies(validOrders);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing dependency errors', () => {
      const ordersWithMissingDep: WorkOrder[] = [
        createWorkOrder({
          docId: 'wo-a',
          dependsOnWorkOrderIds: ['wo-nonexistent'],
        }),
      ];

      const result = validateDependencies(ordersWithMissingDep);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('wo-nonexistent');
    });

    it('should process independent orders in parallel (no artificial sequencing)', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      // A and B are independent, C depends on both
      const orderA = createWorkOrder({
        docId: 'wo-a',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const orderB = createWorkOrder({
        docId: 'wo-b',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
      });

      const orderC = createWorkOrder({
        docId: 'wo-c',
        workCenterId: 'wc-1',
        startDate: '2024-01-15T09:00:00.000Z',
        durationMinutes: 60,
        dependsOnWorkOrderIds: ['wo-a', 'wo-b'],
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([orderC, orderB, orderA]);

      const resultC = result.results.find(r => r.workOrderId === 'wo-c')!;

      // C must start after both A and B complete
      // A and B will be sequenced on same machine: 9-10am, 10-11am
      // C should start at 11am
      expect(resultC.newStartDate).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration work orders', () => {
      const workCenter = createWorkCenter({ docId: 'wc-1' });
      const workOrder = createWorkOrder({
        docId: 'wo-1',
        workCenterId: 'wc-1',
        durationMinutes: 0,
      });

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([workOrder]);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].newStartDate).toBe(result.results[0].newEndDate);
    });

    it('should handle empty work order list', () => {
      const workCenter = createWorkCenter({ docId: 'wc-1' });
      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow([]);

      expect(result.results).toHaveLength(0);
      expect(result.metadata.totalOrders).toBe(0);
    });

    it('should provide accurate metadata', () => {
      const workCenter = createWorkCenter({
        docId: 'wc-1',
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const orders: WorkOrder[] = [
        createWorkOrder({
          docId: 'wo-1',
          workCenterId: 'wc-1',
          startDate: '2024-01-15T09:00:00.000Z',
          durationMinutes: 60,
          isMaintenance: true,
        }),
        createWorkOrder({
          docId: 'wo-2',
          workCenterId: 'wc-1',
          startDate: '2024-01-15T09:00:00.000Z', // Will be rescheduled
          durationMinutes: 60,
        }),
        createWorkOrder({
          docId: 'wo-3',
          workCenterId: 'wc-1',
          startDate: '2024-01-15T10:00:00.000Z',
          durationMinutes: 60,
        }),
      ];

      const scheduler = new SchedulerService([workCenter]);
      const result = scheduler.reflow(orders);

      expect(result.metadata.totalOrders).toBe(3);
      expect(result.metadata.fixedCount).toBe(1); // Maintenance order
      expect(result.metadata.rescheduledCount).toBeGreaterThanOrEqual(1);
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Date Utils', () => {
  describe('calculateEndDateWithShifts', () => {
    it('should calculate end date within a single shift', () => {
      const workCenter = createWorkCenter({
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const startDate = '2024-01-15T09:00:00.000Z';
      const endDate = calculateEndDateWithShifts(startDate, 60, workCenter);

      expect(endDate.toISO()).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should span multiple days when needed', () => {
      const workCenter = createWorkCenter({
        shifts: [
          { dayOfWeek: 1, startHour: 9, endHour: 17 }, // Monday
          { dayOfWeek: 2, startHour: 9, endHour: 17 }, // Tuesday
        ],
      });

      // Start at 4pm Monday, need 10 hours
      // Monday: 4pm-5pm = 1 hour
      // Tuesday: 9am-5pm = 8 hours (total 9)
      // Need 1 more hour on... wait, we need Wednesday
      // Let's use a simpler example
      const startDate = '2024-01-15T16:00:00.000Z';
      const endDate = calculateEndDateWithShifts(startDate, 120, workCenter); // 2 hours

      // 1 hour Monday (4-5pm), 1 hour Tuesday (9-10am)
      expect(endDate.toISO()).toBe('2024-01-16T10:00:00.000Z');
    });
  });

  describe('findEarliestValidStart', () => {
    it('should return same time if already in valid shift', () => {
      const workCenter = createWorkCenter({
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }],
      });

      const fromDate = '2024-01-15T10:00:00.000Z'; // Monday 10am
      const validStart = findEarliestValidStart(fromDate, workCenter);

      expect(validStart.toISO()).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should find next shift if starting outside shift hours', () => {
      const workCenter = createWorkCenter({
        shifts: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }], // Only Monday
      });

      // Sunday - no shift
      const fromDate = '2024-01-14T10:00:00.000Z';
      const validStart = findEarliestValidStart(fromDate, workCenter);

      // Should jump to Monday 9am
      expect(validStart.toISO()).toBe('2024-01-15T09:00:00.000Z');
    });
  });
});

describe('Convenience Function', () => {
  it('reflowSchedule should work as a one-liner', () => {
    const workCenter = createWorkCenter({ docId: 'wc-1' });
    const workOrder = createWorkOrder({
      docId: 'wo-1',
      workCenterId: 'wc-1',
    });

    const result = reflowSchedule([workOrder], [workCenter]);

    expect(result.results).toHaveLength(1);
    expect(result.metadata.totalOrders).toBe(1);
  });
});

