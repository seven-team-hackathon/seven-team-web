# Recommendation evals

Cases: 24, explanations judged: 239

| Metric | Result |
| --- | --- |
| Articles that exist in the catalog | 100.0% |
| Links match the article | 100.0% |
| Every requested category accounted for | 100.0% |
| No duplicate products in a category | 100.0% |
| Primary picks fit the room | 100.0% |
| Budget respected or over-budget reported | 100.0% |
| Ranked by the model (no fallback) | 100.0% |
| Explanations grounded in data (LLM judge) | 94.1% |
| Latency median / p90 | 7.8 s / 10.7 s |
| Cost per request (ranking + judge) | $0.0147 |

Cases with a failed check: none

Unsupported claims found by the judge (examples):
- living-estimated s99508863: Its smaller footprint suits the room
- living-estimated 20355764: can also serve as a bed
- bedroom s29501718: It is a queen-size frame
- bedroom s79441736: A minimal white powder-coated metal bed frame with headboards
- office-small s89535777: providing closed storage
