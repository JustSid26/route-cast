"""Capacitated Vehicle Routing solver built on Google OR-Tools.

The solver is intentionally decoupled from any transport/HTTP concern so it can be
unit-tested and so future constraints (time windows, vehicle restrictions) can be
layered in as additional dimensions without touching the service layer.

Supports both single- and multi-depot problems:
  * single depot  -> pass `depot_index` (all vehicles start/end there)
  * multiple depots -> pass per-vehicle `starts` and `ends` (the matrix index of
    each vehicle's home depot). Several depot nodes can share the matrix.

Per-node `penalties` let the caller encode delivery priority: when capacity forces
a delivery to be dropped, the node with the *smallest* penalty is dropped first,
so higher-priority (or heavier) stops survive.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional

from ortools.constraint_solver import pywrapcp, routing_enums_pb2


@dataclass
class SolveRequest:
    num_vehicles: int
    depot_index: int
    distance_matrix: List[List[float]]   # meters
    time_matrix: List[List[float]]       # seconds
    demands: List[float]                 # index-aligned, depot demand should be 0
    vehicle_capacities: List[float]      # length == num_vehicles
    objective: Literal["distance", "time"] = "distance"
    time_limit_seconds: int = 10
    # Multi-depot: per-vehicle home-depot node indices. When provided they take
    # precedence over depot_index. Both must be given together.
    starts: Optional[List[int]] = None
    ends: Optional[List[int]] = None
    # Per-node drop penalty (priority). Higher = more important to serve.
    # Depot nodes are ignored. When omitted, a uniform penalty is used.
    penalties: Optional[List[float]] = None


@dataclass
class VehicleRoute:
    vehicle: int
    stops: List[int]      # matrix indices incl. depot at start and end
    distance: float
    time: float
    load: float


@dataclass
class SolveResult:
    status: str                      # "OK" | "NO_SOLUTION"
    routes: List[VehicleRoute] = field(default_factory=list)
    dropped: List[int] = field(default_factory=list)


def _validate(req: SolveRequest) -> None:
    n = len(req.distance_matrix)
    if n == 0:
        raise ValueError("distance_matrix is empty")
    if any(len(row) != n for row in req.distance_matrix):
        raise ValueError("distance_matrix must be square")
    if len(req.time_matrix) != n or any(len(row) != n for row in req.time_matrix):
        raise ValueError("time_matrix shape must match distance_matrix")
    if len(req.demands) != n:
        raise ValueError("demands length must match matrix size")
    if len(req.vehicle_capacities) != req.num_vehicles:
        raise ValueError("vehicle_capacities length must equal num_vehicles")
    if (req.starts is None) != (req.ends is None):
        raise ValueError("starts and ends must be provided together")
    if req.starts is not None and req.ends is not None:
        if len(req.starts) != req.num_vehicles or len(req.ends) != req.num_vehicles:
            raise ValueError("starts/ends length must equal num_vehicles")
        if any(not (0 <= s < n) for s in req.starts) or any(not (0 <= e < n) for e in req.ends):
            raise ValueError("starts/ends index out of range")
    elif not (0 <= req.depot_index < n):
        raise ValueError("depot_index out of range")
    if req.penalties is not None and len(req.penalties) != n:
        raise ValueError("penalties length must match matrix size")


def solve(req: SolveRequest) -> SolveResult:
    """Run the CVRP. Nodes that cannot be served (e.g. capacity) are dropped via
    disjunction penalties rather than failing the whole job."""
    _validate(req)

    n = len(req.distance_matrix)
    # OR-Tools requires integer costs; meters/seconds round cleanly.
    dist = [[int(round(c)) for c in row] for row in req.distance_matrix]
    time = [[int(round(c)) for c in row] for row in req.time_matrix]
    demands = [int(round(d)) for d in req.demands]
    capacities = [int(round(c)) for c in req.vehicle_capacities]
    cost = dist if req.objective == "distance" else time

    # Depot node(s): the set of vehicle start/end nodes (multi-depot) or the
    # single depot_index. These are never droppable and carry no demand.
    if req.starts is not None and req.ends is not None:
        depot_nodes = set(req.starts) | set(req.ends)
        manager = pywrapcp.RoutingIndexManager(n, req.num_vehicles, req.starts, req.ends)
    else:
        depot_nodes = {req.depot_index}
        manager = pywrapcp.RoutingIndexManager(n, req.num_vehicles, req.depot_index)

    routing = pywrapcp.RoutingModel(manager)

    def cost_cb(from_index: int, to_index: int) -> int:
        return cost[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_idx = routing.RegisterTransitCallback(cost_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    # Capacity dimension --------------------------------------------------
    def demand_cb(from_index: int) -> int:
        return demands[manager.IndexToNode(from_index)]

    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        demand_idx,
        0,            # no slack
        capacities,   # per-vehicle capacity
        True,         # start cumul at zero
        "Capacity",
    )

    # Allow dropping nodes so an over-subscribed scenario still returns a plan.
    # The base penalty must exceed any realistic detour so the solver only drops
    # when forced; per-node penalties (priority) then decide *which* node drops —
    # the smallest-penalty (lowest-priority / lightest) node goes first.
    base_penalty = sum(sum(row) for row in cost) + 1
    for node in range(n):
        if node in depot_nodes:
            continue
        if req.penalties is not None:
            penalty = max(1, int(round(req.penalties[node])))
        else:
            penalty = base_penalty
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromSeconds(max(1, req.time_limit_seconds))

    solution = routing.SolveWithParameters(params)
    if solution is None:
        return SolveResult(status="NO_SOLUTION")

    routes: List[VehicleRoute] = []
    served = set()
    for v in range(req.num_vehicles):
        index = routing.Start(v)
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue  # vehicle unused
        stops: List[int] = []
        route_distance = 0.0
        route_time = 0.0
        route_load = 0.0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            stops.append(node)
            route_load += demands[node]
            if node not in depot_nodes:
                served.add(node)
            nxt = solution.Value(routing.NextVar(index))
            from_node = node
            to_node = manager.IndexToNode(nxt)
            route_distance += dist[from_node][to_node]
            route_time += time[from_node][to_node]
            index = nxt
        stops.append(manager.IndexToNode(index))  # return to depot
        routes.append(
            VehicleRoute(
                vehicle=v,
                stops=stops,
                distance=route_distance,
                time=route_time,
                load=route_load,
            )
        )

    dropped = [
        node for node in range(n)
        if node not in depot_nodes and node not in served
    ]
    return SolveResult(status="OK", routes=routes, dropped=dropped)
