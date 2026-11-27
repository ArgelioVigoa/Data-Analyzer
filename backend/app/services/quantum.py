REGISTRY = [
    {"id":"vqe","name":"Variational Quantum Eigensolver","problem_types":["ground_state_energy","eigenvalue","hamiltonian"],"status":"candidate_only","requirements":["A defined Hamiltonian and encoding","A suitable ansatz and measurement strategy"],"caveats":["No execution is implemented in this service","Noise, shot cost and classical optimization must be assessed"]},
    {"id":"qaoa","name":"Quantum Approximate Optimization Algorithm","problem_types":["combinatorial_optimization"],"status":"candidate_only","requirements":["A discrete optimization objective","A mapping to a cost Hamiltonian"],"caveats":["Continuous or arbitrary tabular data is not directly a QAOA instance","No quantum advantage is implied"]},
    {"id":"qae","name":"Quantum Amplitude Estimation","problem_types":["probability_estimation","expectation_estimation","monte_carlo"],"status":"candidate_only","requirements":["A probability or expectation represented as an amplitude","A state-preparation procedure and coherent oracle"],"caveats":["Oracle construction and state preparation can dominate cost","Canonical and practical variants have different resource requirements"]},
    {"id":"grover","name":"Grover Search","problem_types":["unstructured_search","constraint_search"],"status":"candidate_only","requirements":["A search space and a reversible predicate/oracle"],"caveats":["The oracle must be implemented; it is not obtained automatically from a file"]},
]

def recommend(problem: dict) -> dict:
    text = " ".join([str(problem.get("title","")), str(problem.get("field","")), str(problem.get("objective",""))]).lower()
    candidates = []
    if any(k in text for k in ["hamiltonian","ground state","estado fundamental","eigenvalue","autovalor","energía","energia"]):
        candidates.append(("vqe","ground_state_energy"))
    if any(k in text for k in ["optim","combinatorial","combinatorio","logística","logistica"]):
        candidates.append(("qaoa","combinatorial_optimization"))
    if any(k in text for k in ["monte carlo","probability","probabilidad","expectation","esperanza","transporte neutrónico","transporte neutronico"]):
        candidates.append(("qae","probability_estimation"))
    if any(k in text for k in ["search","búsqueda","busqueda","constraint","restricción","restriccion"]):
        candidates.append(("grover","unstructured_search"))
    return {
        "recommendations":[{**next(a for a in REGISTRY if a["id"]==aid),"matched_task":task,"match_basis":"keyword heuristic; requires expert validation"} for aid,task in candidates],
        "message":"These are preliminary candidates, not proof of applicability or quantum advantage. A mathematically explicit problem formulation is required.",
    }
