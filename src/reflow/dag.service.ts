/**
 * Directed Acyclic Graph (DAG) Service for Work Order Dependencies
 * 
 * This module builds a dependency graph from work orders and performs
 * topological sorting to determine the correct scheduling order.
 * 
 * Key Concepts:
 * - Each work order is a node in the graph
 * - Dependencies create directed edges (dependency -> dependent)
 * - Topological sort ensures we process dependencies before dependents
 * - Circular dependencies are detected and reported as errors
 */

import {
  WorkOrder,
  CircularDependencyError,
  MissingDependencyError,
} from './types';

/**
 * Represents a node in the dependency graph.
 * Each node corresponds to one work order.
 */
interface GraphNode {
  /** The work order this node represents */
  workOrder: WorkOrder;
  
  /** IDs of work orders that this order depends on (incoming edges) */
  dependencies: Set<string>;
  
  /** IDs of work orders that depend on this order (outgoing edges) */
  dependents: Set<string>;
  
  /** Used during topological sort: number of unprocessed incoming edges */
  inDegree: number;
}

/**
 * The complete dependency graph structure.
 */
interface DependencyGraph {
  /** Map of work order ID to graph node */
  nodes: Map<string, GraphNode>;
  
  /** All work order IDs in no particular order */
  allIds: string[];
}

/**
 * Builds a dependency graph from an array of work orders.
 * 
 * The graph represents the "must complete before" relationships:
 * - If order B depends on order A, there's an edge from A to B
 * - This means A must be scheduled (and complete) before B can start
 * 
 * @param workOrders - Array of work orders to build graph from
 * @returns The constructed dependency graph
 * @throws MissingDependencyError if a dependency reference is invalid
 */
export function buildDependencyGraph(workOrders: WorkOrder[]): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const allIds: string[] = [];

  // First pass: Create all nodes
  for (const order of workOrders) {
    allIds.push(order.docId);
    nodes.set(order.docId, {
      workOrder: order,
      dependencies: new Set(order.data.dependsOnWorkOrderIds),
      dependents: new Set(),
      inDegree: order.data.dependsOnWorkOrderIds.length,
    });
  }

  // Second pass: Validate dependencies and build reverse edges (dependents)
  for (const [id, node] of nodes) {
    for (const depId of node.dependencies) {
      const depNode = nodes.get(depId);
      
      if (!depNode) {
        throw new MissingDependencyError(id, depId);
      }
      
      // Add reverse edge: depNode knows that 'node' depends on it
      depNode.dependents.add(id);
    }
  }

  return { nodes, allIds };
}

/**
 * Performs topological sort on the dependency graph using Kahn's algorithm.
 * 
 * The algorithm:
 * 1. Find all nodes with no incoming edges (in-degree = 0)
 * 2. Add them to the result and remove their outgoing edges
 * 3. This may create new nodes with in-degree = 0
 * 4. Repeat until all nodes are processed or a cycle is detected
 * 
 * Why Kahn's algorithm?
 * - It naturally detects cycles (if we can't process all nodes, there's a cycle)
 * - It provides a valid processing order in one pass
 * - It's efficient: O(V + E) where V = nodes, E = edges
 * 
 * @param graph - The dependency graph to sort
 * @returns Array of work orders in topological order
 * @throws CircularDependencyError if the graph contains cycles
 */
export function topologicalSort(graph: DependencyGraph): WorkOrder[] {
  const result: WorkOrder[] = [];
  
  // Create a working copy of in-degrees (we'll modify these)
  const inDegrees = new Map<string, number>();
  for (const [id, node] of graph.nodes) {
    inDegrees.set(id, node.inDegree);
  }

  // Queue of nodes ready to process (in-degree = 0)
  // Using an array as a queue for simplicity; could use a proper queue for large graphs
  const readyQueue: string[] = [];

  // Initialize with all nodes that have no dependencies
  for (const [id, inDegree] of inDegrees) {
    if (inDegree === 0) {
      readyQueue.push(id);
    }
  }

  // Process nodes in order
  while (readyQueue.length > 0) {
    // Sort ready nodes by some criteria for deterministic ordering
    // Here we sort by work order start date, then by ID
    readyQueue.sort((a, b) => {
      const nodeA = graph.nodes.get(a)!;
      const nodeB = graph.nodes.get(b)!;
      
      const dateComparison = nodeA.workOrder.data.startDate.localeCompare(
        nodeB.workOrder.data.startDate
      );
      
      if (dateComparison !== 0) return dateComparison;
      return a.localeCompare(b);
    });

    // Take the first ready node
    const currentId = readyQueue.shift()!;
    const currentNode = graph.nodes.get(currentId)!;
    
    result.push(currentNode.workOrder);

    // "Remove" outgoing edges by decrementing in-degree of dependents
    for (const dependentId of currentNode.dependents) {
      const newInDegree = inDegrees.get(dependentId)! - 1;
      inDegrees.set(dependentId, newInDegree);
      
      // If dependent now has no more dependencies, it's ready to process
      if (newInDegree === 0) {
        readyQueue.push(dependentId);
      }
    }
  }

  // Check if we processed all nodes
  if (result.length !== graph.nodes.size) {
    // There's a cycle - find and report it
    const cycle = findCycle(graph, inDegrees);
    throw new CircularDependencyError(cycle);
  }

  return result;
}

/**
 * Finds a cycle in the graph when topological sort fails.
 * Used to provide a helpful error message.
 * 
 * Uses DFS to find a back edge, then traces the cycle.
 * 
 * @param graph - The dependency graph
 * @param remainingInDegrees - In-degrees after partial topological sort
 * @returns Array of work order IDs forming the cycle
 */
function findCycle(
  graph: DependencyGraph,
  remainingInDegrees: Map<string, number>,
): string[] {
  // Find nodes that weren't processed (still have in-degree > 0)
  const unprocessed = new Set<string>();
  for (const [id, inDegree] of remainingInDegrees) {
    if (inDegree > 0) {
      unprocessed.add(id);
    }
  }

  if (unprocessed.size === 0) {
    return ['unknown cycle'];
  }

  // Use DFS to find the cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): string[] | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return null;

    // Check dependencies (following edges backward to find cycle)
    for (const depId of node.dependencies) {
      if (!visited.has(depId)) {
        const result = dfs(depId);
        if (result) return result;
      } else if (recursionStack.has(depId)) {
        // Found a cycle! Extract it from the path
        const cycleStart = path.indexOf(depId);
        return [...path.slice(cycleStart), depId];
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return null;
  }

  // Start DFS from any unprocessed node
  const startNode = unprocessed.values().next().value;
  const cycle = dfs(startNode);
  
  return cycle || [startNode, '...', startNode];
}

/**
 * Gets all work orders that depend (directly or transitively) on a given order.
 * Useful for understanding the "blast radius" of a schedule change.
 * 
 * @param graph - The dependency graph
 * @param workOrderId - ID of the work order to check
 * @returns Set of work order IDs that depend on the given order
 */
export function getTransitiveDependents(
  graph: DependencyGraph,
  workOrderId: string,
): Set<string> {
  const result = new Set<string>();
  const queue = [workOrderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = graph.nodes.get(currentId);
    
    if (!node) continue;

    for (const dependentId of node.dependents) {
      if (!result.has(dependentId)) {
        result.add(dependentId);
        queue.push(dependentId);
      }
    }
  }

  return result;
}

/**
 * Gets all work orders that a given order depends on (directly or transitively).
 * Useful for understanding what must complete before an order can start.
 * 
 * @param graph - The dependency graph
 * @param workOrderId - ID of the work order to check
 * @returns Set of work order IDs that must complete before this order
 */
export function getTransitiveDependencies(
  graph: DependencyGraph,
  workOrderId: string,
): Set<string> {
  const result = new Set<string>();
  const queue = [workOrderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = graph.nodes.get(currentId);
    
    if (!node) continue;

    for (const depId of node.dependencies) {
      if (!result.has(depId)) {
        result.add(depId);
        queue.push(depId);
      }
    }
  }

  return result;
}

/**
 * Validates the dependency graph without performing full topological sort.
 * Checks for:
 * - Missing dependency references
 * - Circular dependencies
 * - Self-dependencies
 * 
 * @param workOrders - Array of work orders to validate
 * @returns Object with isValid flag and any error messages
 */
export function validateDependencies(
  workOrders: WorkOrder[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const orderIds = new Set(workOrders.map(o => o.docId));

  // Check for missing dependencies and self-references
  for (const order of workOrders) {
    for (const depId of order.data.dependsOnWorkOrderIds) {
      
      if (depId === order.docId) {
        errors.push(
          `Work order "${order.data.workOrderNumber}" (${order.docId}) depends on itself`
        );
      } else if (!orderIds.has(depId)) {
        errors.push(
          `Work order "${order.data.workOrderNumber}" (${order.docId}) ` +
          `depends on non-existent order "${depId}"`
        );
      }
    }
  }

  // If basic validation passed, check for cycles
  if (errors.length === 0) {
    try {
      const graph = buildDependencyGraph(workOrders);
      topologicalSort(graph);
    } catch (e) {
      if (e instanceof CircularDependencyError) {
        errors.push(e.message);
      } else if (e instanceof MissingDependencyError) {
        errors.push(e.message);
      } else {
        throw e;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

