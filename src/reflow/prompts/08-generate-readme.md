## Prompt

```
Write a README.md for a production scheduling system built with NestJS. The system reschedules manufacturing work orders while respecting dependencies, shift schedules, and machine capacity.

Structure the README with these sections:

1. Project Overview
   - Brief description of what the system does
   - Key features (dependency-aware, shift-aware, maintenance windows, capacity constraints)

2. Setup Instructions
   - Prerequisites (Node.js version, npm)
   - Installation commands
   - Keep it simple, no Docker needed

3. How to Run
   - Development mode command
   - Production build and run
   - Test commands (unit tests, watch mode, coverage)
   - Swagger UI URL

4. API Documentation
   - Main endpoint (POST /reflow)
   - Show a realistic request body example with work orders and work centers
   - Show the response structure with results and metadata

5. Algorithm Explanation
   This is the most important section. Explain the three-phase approach:
   
   Phase 1 - Dependency Graph:
   - Build a DAG from work orders
   - Forward edges (dependencies) and reverse edges (dependents)
   - Validate all references exist
   
   Phase 2 - Topological Sort:
   - Use Kahn's algorithm
   - Explain WHY this algorithm (natural cycle detection, O(V+E))
   - Show a simple example with 3 nodes
   
   Phase 3 - Schedule Each Order:
   - Calculate earliest start from constraints (dependencies, machine availability, original time)
   - Snap to valid shift time
   - Calculate end using shift-aware duration
   - Update trackers
   
   Include ASCII diagrams showing the flow. Add a concrete example of shift-spanning:
   "Start Monday 4pm, need 3 hours, shift ends 5pm → End Tuesday 11am"

6. Project Structure
   - Show the folder tree for src/reflow/
   - One-line description for each file

7. Test Coverage
   - Table of test scenarios (shift span, dependencies, maintenance, capacity, errors)

8. Complexity Analysis
   - Big O for each operation
   - Total complexity

Keep the tone technical but readable. Use tables and code blocks for clarity. Don't over-explain basics - assume the reader is a developer familiar with scheduling concepts.
```

