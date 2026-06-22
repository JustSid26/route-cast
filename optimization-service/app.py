"""FastAPI wrapper exposing the OR-Tools CVRP solver as an internal service."""
from __future__ import annotations

import os
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from solver import SolveRequest, solve

app = FastAPI(title="VRP Optimization Service", version="1.0.0")

DEFAULT_TIME_LIMIT = int(os.getenv("SOLVER_TIME_LIMIT", "10"))


class SolvePayload(BaseModel):
    num_vehicles: int = Field(gt=0)
    depot_index: int = 0
    distance_matrix: List[List[float]]
    time_matrix: List[List[float]]
    demands: List[float]
    vehicle_capacities: List[float]
    objective: Literal["distance", "time"] = "distance"


class RouteOut(BaseModel):
    vehicle: int
    stops: List[int]
    distance: float
    time: float
    load: float


class SolveResponse(BaseModel):
    status: str
    routes: List[RouteOut]
    dropped: List[int]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve_endpoint(payload: SolvePayload) -> SolveResponse:
    try:
        result = solve(
            SolveRequest(
                num_vehicles=payload.num_vehicles,
                depot_index=payload.depot_index,
                distance_matrix=payload.distance_matrix,
                time_matrix=payload.time_matrix,
                demands=payload.demands,
                vehicle_capacities=payload.vehicle_capacities,
                objective=payload.objective,
                time_limit_seconds=DEFAULT_TIME_LIMIT,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return SolveResponse(
        status=result.status,
        routes=[
            RouteOut(
                vehicle=r.vehicle, stops=r.stops, distance=r.distance,
                time=r.time, load=r.load,
            )
            for r in result.routes
        ],
        dropped=result.dropped,
    )
