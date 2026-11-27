import math
import pandas as pd

def analyze_frame(frame: pd.DataFrame) -> dict:
    if frame.empty:
        raise ValueError("The uploaded dataset contains no data rows.")
    columns = []
    numeric = frame.select_dtypes(include="number")
    for name in frame.columns:
        series = frame[name]
        item = {
            "name": str(name),
            "dtype": str(series.dtype),
            "count": int(series.count()),
            "missing": int(series.isna().sum()),
            "unique": int(series.nunique(dropna=True)),
        }
        if name in numeric.columns:
            x = series.dropna()
            item["statistics"] = {
                "mean": _finite(x.mean()), "std": _finite(x.std()),
                "min": _finite(x.min()), "q1": _finite(x.quantile(.25)),
                "median": _finite(x.median()), "q3": _finite(x.quantile(.75)),
                "max": _finite(x.max()),
            }
            q1, q3 = x.quantile(.25), x.quantile(.75)
            iqr = q3 - q1
            item["possible_outliers_iqr"] = int(((x < q1 - 1.5*iqr) | (x > q3 + 1.5*iqr)).sum()) if len(x) else 0
        columns.append(item)
    corr = numeric.corr().round(6).where(pd.notna(numeric.corr()), None).to_dict() if len(numeric.columns) > 1 else {}
    return {
        "shape": {"rows": int(len(frame)), "columns": int(len(frame.columns))},
        "columns": columns,
        "numeric_columns": [str(x) for x in numeric.columns],
        "correlation_matrix": corr,
        "duplicate_rows": int(frame.duplicated().sum()),
        "preview": frame.head(10).astype(object).where(pd.notna(frame.head(10)), None).to_dict(orient="records"),
        "warnings": _warnings(frame),
    }

def _finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None

def _warnings(frame):
    notes = []
    if frame.isna().any().any():
        notes.append("Missing values are present; choose a scientifically justified treatment before modeling.")
    if frame.duplicated().any():
        notes.append("Duplicate rows are present; verify whether they are repeated measurements or accidental duplicates.")
    if not len(frame.select_dtypes(include="number").columns):
        notes.append("No numeric columns were detected; numerical analysis and quantum formulation need additional information.")
    return notes
