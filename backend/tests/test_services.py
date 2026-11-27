import pandas as pd
from app.services.analysis import analyze_frame
from app.services.quantum import recommend

def test_analysis_reports_shape_missing_and_numeric_summary():
    result=analyze_frame(pd.DataFrame({"energy":[1.0,2.0,None,100.0],"label":["a","b","b","c"]}))
    assert result["shape"]=={"rows":4,"columns":2}
    assert result["columns"][0]["missing"]==1
    assert result["columns"][0]["statistics"]["mean"]==pytest.approx(34.3333333333)
    assert result["duplicate_rows"]==0

def test_quantum_recommendation_is_explicitly_heuristic():
    result=recommend({"title":"Neutron Monte Carlo","field":"Nuclear physics","objective":"Estimate transmission probability"})
    assert result["recommendations"][0]["id"]=="qae"
    assert "heuristic" in result["recommendations"][0]["match_basis"]

import pytest
