"""Smoke tests for the CVRP solver. Run: python -m pytest (or python test_solver.py)."""
from solver import SolveRequest, solve


def _symmetric_matrix(coords):
    """Manhattan-ish integer matrix just for deterministic testing."""
    n = len(coords)
    m = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            m[i][j] = abs(coords[i][0] - coords[j][0]) + abs(coords[i][1] - coords[j][1])
    return m


def test_basic_two_vehicles():
    coords = [(0, 0), (1, 0), (2, 0), (0, 1), (0, 2)]
    dist = _symmetric_matrix(coords)
    req = SolveRequest(
        num_vehicles=2,
        depot_index=0,
        distance_matrix=dist,
        time_matrix=dist,
        demands=[0, 10, 10, 10, 10],
        vehicle_capacities=[20, 20],
        objective="distance",
        time_limit_seconds=2,
    )
    res = solve(req)
    assert res.status == "OK"
    served = {node for r in res.routes for node in r.stops if node != 0}
    assert served == {1, 2, 3, 4}
    assert not res.dropped
    # every vehicle respects capacity
    assert all(r.load <= 20 for r in res.routes)


def test_drops_when_capacity_insufficient():
    coords = [(0, 0), (1, 0), (2, 0)]
    dist = _symmetric_matrix(coords)
    req = SolveRequest(
        num_vehicles=1,
        depot_index=0,
        distance_matrix=dist,
        time_matrix=dist,
        demands=[0, 100, 100],   # total 200 > capacity 100
        vehicle_capacities=[100],
        objective="distance",
        time_limit_seconds=2,
    )
    res = solve(req)
    assert res.status == "OK"
    assert len(res.dropped) >= 1


if __name__ == "__main__":
    test_basic_two_vehicles()
    test_drops_when_capacity_insufficient()
    print("solver tests passed")
