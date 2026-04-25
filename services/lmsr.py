from __future__ import annotations

import math


def prices(q_vector: list[float], b: float) -> list[float]:
    """Bucket probabilities derived from q_vector. Numerically stable via log-sum-exp."""
    max_q = max(q_vector)
    exps = [math.exp((q - max_q) / b) for q in q_vector]
    total = sum(exps)
    return [e / total for e in exps]


def cost(q_vector: list[float], b: float) -> float:
    """LMSR cost function C(q). Numerically stable."""
    max_q = max(q_vector)
    return max_q + b * math.log(sum(math.exp((q - max_q) / b) for q in q_vector))


def shares_for_budget(
    q_vector: list[float], b: float, bucket_index: int, budget: float
) -> float:
    """Compute shares received for spending exactly `budget` points on `bucket_index`.

    Derived by solving C(q after) - C(q before) = budget for Δ:
      Δ = max_q + b·log(S_norm·(e^(budget/b) - 1) + norm_exp_k) - q_k
    where S_norm = Σ exp((q_j - max_q)/b), norm_exp_k = exp((q_k - max_q)/b).
    """
    max_q = max(q_vector)
    norm_exps = [math.exp((q - max_q) / b) for q in q_vector]
    S_norm = sum(norm_exps)
    norm_exp_k = norm_exps[bucket_index]
    inner = S_norm * (math.exp(budget / b) - 1) + norm_exp_k
    return max_q + b * math.log(inner) - q_vector[bucket_index]


def apply_bet(
    q_vector: list[float], b: float, bucket_index: int, budget: float
) -> tuple[list[float], float, float]:
    """Apply a bet of `budget` points on `bucket_index`.

    Returns (new_q_vector, shares_received, actual_cost).
    actual_cost ≈ budget; small numerical difference from floating point.
    """
    shares = shares_for_budget(q_vector, b, bucket_index, budget)
    new_q = q_vector.copy()
    new_q[bucket_index] += shares
    actual_cost = cost(new_q, b) - cost(q_vector, b)
    return new_q, shares, actual_cost


def default_b(n_personas: int, n_buckets: int, budget: float = 100.0) -> float:
    """Calibrate b so the market is sensitive enough for the given cohort size.

    Formula: b = (n_personas × budget) / (2 × log(n_buckets))
    At this value, a single unanimous cohort fully dominates the prior.
    """
    if n_buckets < 2:
        raise ValueError("LMSR requires at least 2 buckets")
    return (n_personas * budget) / (2 * math.log(n_buckets))
