"""Score a run against the ground truth of one set.

Usage: python3 score.py set-B/ground_truth/field_mapping.json my_run.json
my_run.json format: {"decisions": {"<source column>": {"target": "<attr>", "route": "auto|review|fallback"}}}
"""
import json, sys

truth = json.load(open(sys.argv[1]))
run = json.load(open(sys.argv[2]))["decisions"]
cols = list(truth)
auto = [c for c in cols if run.get(c, {}).get("route") == "auto"]
correct_auto = [c for c in auto if run[c]["target"] == truth[c]]
fallback = [c for c in cols if run.get(c, {}).get("route") == "fallback"]
print(f"Columns: {len(cols)}")
print(f"Auto-map rate: {len(auto) / len(cols):.0%}")
print(f"Auto-accept precision: {(len(correct_auto) / len(auto)) if auto else 1:.0%}")
print(f"Fallback rate: {len(fallback) / len(cols):.0%}")
