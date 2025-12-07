## Prompt

```
Generate comprehensive English documentation for all functions in this TypeScript module. For each function, provide:

1. Summary - One-line description of what the function does
2. Purpose - Why this function exists and when to use it
3. Algorithm - Step-by-step explanation of how it works (for complex functions)
4. Parameters - Each parameter with type, description, and constraints
5. Returns - What the function returns and possible values
6. Throws - Any errors/exceptions that can be thrown
7. Time Complexity - Big O notation where applicable
8. Example - Code example showing typical usage
9. Edge Cases - Important edge cases and how they're handled

Format as JSDoc comments that can be placed directly above each function.

Group documentation by file:
- dag.service.ts (graph building, topological sort, cycle detection)
- scheduler.service.ts (main scheduling logic, constraint resolution)  
- date-utils.ts (shift-aware calculations, time utilities)
- types.ts (interfaces and error classes)

For complex algorithms (topological sort, shift-aware duration), include ASCII diagrams showing the data flow or state transitions.

Output should be production-ready documentation suitable for a senior engineering team.
```
