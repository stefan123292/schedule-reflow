# Production Schedule Reflow

A finite capacity scheduling system for manufacturing work orders built with NestJS and TypeScript.

## Features

- **Dependency-aware scheduling** - Work orders respect dependencies (B waits for A to complete)
- **Shift-aware calculations** - Work only counted during active shifts
- **Maintenance window handling** - Schedules around blocked periods
- **Machine capacity constraints** - No overlapping orders on same machine
- **Circular dependency detection** - Validates and reports invalid dependency graphs

---

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
### Installation

```bash
# Clone the repository
git clone <repository-url>
cd naologic-task

# Install dependencies
npm install
```

---

## How to Run

### Development Mode

```bash
npm run start:dev
```

The server will start at **http://localhost:3000**

### Production Mode

```bash
npm run build
npm run start:prod
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

---

## API Documentation

Swagger UI is available at: **http://localhost:3000/api**

### Main Endpoint

**POST /reflow** - Reschedule work orders respecting all constraints

#### Request Body

```json
{
  "workOrders": [
    {
      "docId": "wo-001",
      "data": {
        "workOrderNumber": "WO-001",
        "workCenterId": "machine-a",
        "startDate": "2024-01-15T09:00:00.000Z",
        "endDate": "2024-01-15T11:00:00.000Z",
        "durationMinutes": 120,
        "isMaintenance": false,
        "dependsOnWorkOrderIds": []
      }
    }
  ],
  "workCenters": [
    {
      "docId": "machine-a",
      "data": {
        "name": "Machine A",
        "shifts": [
          { "dayOfWeek": 1, "startHour": 9, "endHour": 17 }
        ],
        "maintenanceWindows": []
      }
    }
  ]
}
```

#### Response

```json
{
  "results": [
    {
      "workOrderId": "wo-001",
      "workOrderNumber": "WO-001",
      "originalStartDate": "2024-01-15T09:00:00.000Z",
      "originalEndDate": "2024-01-15T11:00:00.000Z",
      "newStartDate": "2024-01-15T09:00:00.000Z",
      "newEndDate": "2024-01-15T11:00:00.000Z",
      "wasRescheduled": false,
      "isFixed": false
    }
  ],
  "warnings": [],
  "metadata": {
    "totalOrders": 1,
    "rescheduledCount": 0,
    "fixedCount": 0,
    "processingTimeMs": 5
  }
}
```

---

## High-Level Algorithm Approach

### Overview

The scheduler uses a **three-phase approach** to reschedule work orders:

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Build Dependency Graph (DAG)                          │
│  - Create nodes for each work order                             │
│  - Build forward edges (dependencies) and reverse edges         │
│  - Validate all dependencies exist                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Topological Sort (Kahn's Algorithm)                   │
│  - Process orders with no dependencies first                    │
│  - Naturally detects circular dependencies                      │
│  - Time complexity: O(V + E)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: Schedule Each Order (in topological order)            │
│  - Calculate earliest start from constraints                    │
│  - Find valid start time within shift hours                     │
│  - Calculate end time using shift-aware duration                │
│  - Update machine availability tracker                          │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: Dependency Graph Construction

```
Input: [Order A, Order B (depends on A), Order C (depends on A)]

Graph:
     A (inDegree: 0)
    / \
   B   C (inDegree: 1 each)

Forward edges: B.dependencies = {A}, C.dependencies = {A}
Reverse edges: A.dependents = {B, C}
```

### Phase 2: Topological Sort (Kahn's Algorithm)

**Why Kahn's Algorithm?**
- Naturally detects cycles (if not all nodes processed → cycle exists)
- Provides valid processing order in single pass
- O(V + E) time complexity

```
Algorithm:
1. Find all nodes with inDegree = 0 (no dependencies)
2. Add to result, decrement inDegree of dependents
3. When inDegree becomes 0, add to ready queue
4. Repeat until queue empty
5. If result.length < total → cycle detected
```

**Example:**
```
Initial: A(0), B(1), C(1)
         
Step 1: Process A → result: [A]
        B(0), C(0) ← decremented
        
Step 2: Process B → result: [A, B]
Step 3: Process C → result: [A, B, C]

Final order: A → B → C ✓
```

### Phase 3: Constraint Resolution

For each work order, the earliest start is calculated as:

```
earliestStart = MAX(
  originalStartDate,           // Can't start earlier (unless configured)
  machineAvailability,         // Machine must be free
  MAX(dependencyEndTimes)      // All dependencies must complete
)
```

Then adjusted for shift schedules:

```
Example: earliestStart = 11:00 PM, Shift = 9 AM - 5 PM
         validStart = 9:00 AM next day (snapped to shift)
```

### Shift-Aware Duration Calculation

Work duration only counts during active shifts:

```
Start: Monday 4:00 PM
Duration: 3 hours
Shift: 9 AM - 5 PM

Monday:  4 PM - 5 PM = 1 hour  ✓
         5 PM - 9 AM = (off shift, not counted)
Tuesday: 9 AM - 11 AM = 2 hours ✓

End: Tuesday 11:00 AM (3 working hours total)
```

---

## Project Structure

```
src/
├── reflow/
│   ├── dag.service.ts        # Graph building, topological sort
│   ├── scheduler.service.ts  # Main scheduling logic
│   ├── types.ts              # Interfaces and error classes
│   ├── dto/
│   │   └── reflow.dto.ts     # Request/response DTOs
│   ├── reflow.controller.ts  # API endpoint
│   ├── reflow.module.ts      # NestJS module
│   ├── scheduler.spec.ts     # Test suite (23+ test cases)
│   └── test-payloads.json    # Sample API payloads
|── utils/
│     └── date-utils.ts     # Shift-aware time calculations
├── app.module.ts
└── main.ts
```

---

## Test Scenarios Covered

| Scenario | Description |
|----------|-------------|
| Shift Span | Work crossing shift boundaries |
| Dependency Cascade | Delays propagating through chain |
| Multi-level Chain | A → B → C dependency chains |
| Cross-machine Dependencies | Dependencies across different machines |
| Maintenance Windows | Fixed orders and blocked periods |
| Machine Capacity | No overlapping orders on same machine |
| Parallel Execution | Different machines run simultaneously |
| Circular Dependency | Detection and error reporting |
| Missing Dependency | Validation and error reporting |

---

## Time Complexity

| Operation | Complexity |
|-----------|------------|
| Build dependency graph | O(V + E) |
| Topological sort | O(V + E) |
| Schedule single order | O(S) where S = shifts to search |
| Total reflow | O(V + E + V×S) |

Where V = work orders, E = dependency edges, S = shift slots

---

## Technologies Used

- **NestJS** - Backend framework
- **TypeScript** - Type safety
- **Luxon** - Date/time handling with timezone support
- **Jest** - Testing framework
- **Swagger** - API documentation
- **class-validator** - Request validation
