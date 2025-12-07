## Prompt

```
Implement a TypeScript module for Directed Acyclic Graph (DAG) operations on work order dependencies in a production scheduling system.

Context:
- Work orders can depend on other work orders (must complete before dependent can start)
- Dependencies form a directed graph that must be acyclic
- Need to determine correct processing order via topological sort
- Must detect and report circular dependencies

Data Structures:

GraphNode interface:
- workOrder: WorkOrder - The work order this node represents
- dependencies: Set<string> - IDs of orders this depends ON (incoming edges)
- dependents: Set<string> - IDs of orders that depend on THIS (outgoing edges)
- inDegree: number - Count of unprocessed dependencies (for Kahn's algorithm)

DependencyGraph interface:
- nodes: Map<string, GraphNode> - All nodes indexed by ID
- allIds: string[] - All work order IDs

Required Functions:

1. buildDependencyGraph(workOrders: WorkOrder[]): DependencyGraph
   - Two-pass algorithm:
     Pass 1: Create all nodes with dependencies and inDegree
     Pass 2: Validate dependencies exist, build reverse edges (dependents)
   - Throw MissingDependencyError if dependency doesn't exist
   - Time complexity: O(V + E)

2. topologicalSort(graph: DependencyGraph): WorkOrder[]
   - Implement Kahn's algorithm:
     a. Find all nodes with inDegree = 0 (no dependencies)
     b. Add to result, decrement inDegree of their dependents
     c. When dependent's inDegree reaches 0, add to ready queue
     d. Repeat until queue empty
   - Sort ready queue by startDate then ID for deterministic order
   - If not all nodes processed → cycle exists → call findCycle() and throw CircularDependencyError
   - Time complexity: O(V + E)

3. findCycle(graph, remainingInDegrees): string[]
   - Called when topological sort fails
   - Find unprocessed nodes (inDegree > 0)
   - Use DFS with recursion stack to find back edge
   - Return array of IDs forming the cycle: ['A', 'B', 'C', 'A']
   - Used for helpful error messages

4. getTransitiveDependents(graph, workOrderId): Set<string>
   - BFS traversal following dependents edges
   - Returns ALL orders that depend on given order (direct + transitive)
   - Useful for "blast radius" analysis when order changes

5. getTransitiveDependencies(graph, workOrderId): Set<string>
   - BFS traversal following dependencies edges  
   - Returns ALL orders that must complete before given order
   - Useful for understanding prerequisites

6. validateDependencies(workOrders): { isValid: boolean, errors: string[] }
   - Check for self-dependencies (order depends on itself)
   - Check for missing dependency references
   - Check for circular dependencies (via topological sort)
   - Return all errors found, not just first one

Algorithm Details - Kahn's Topological Sort:

```
1. Initialize:
   - Copy inDegrees from graph nodes
   - Add all nodes with inDegree=0 to readyQueue

2. While readyQueue not empty:
   - Sort queue by startDate, then by ID
   - Pop first node, add to result
   - For each dependent of this node:
     - Decrement their inDegree
     - If inDegree becomes 0, add to readyQueue

3. If result.length < total nodes:
   - Cycle exists! Find and report it
```

Algorithm Details - Cycle Detection (DFS):

```
1. Find unprocessed nodes (inDegree > 0 after partial sort)
2. DFS from any unprocessed node:
   - Track visited nodes and recursion stack
   - If we visit a node already in recursion stack → cycle found
   - Extract cycle path from recursion stack
```

Error Handling:
- MissingDependencyError: "Work order X depends on non-existent order Y"
- CircularDependencyError: "Circular dependency detected: A -> B -> C -> A"

Requirements:
- Use Set<string> for dependencies/dependents (O(1) lookup)
- Use Map<string, GraphNode> for nodes (O(1) lookup)
- Include JSDoc comments explaining algorithm choices
- Explain why Kahn's algorithm (natural cycle detection, O(V+E))

Output: Single TypeScript file with all functions exported.
```

