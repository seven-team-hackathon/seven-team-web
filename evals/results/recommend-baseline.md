# Recommendation evals

Cases: 24, explanations judged: 242

| Metric | Result |
| --- | --- |
| Articles that exist in the catalog | 100.0% |
| Links match the article | 100.0% |
| Every requested category accounted for | 100.0% |
| No duplicate products in a category | 100.0% |
| Primary picks fit the room | 100.0% |
| Budget respected or over-budget reported | 100.0% |
| Ranked by the model (no fallback) | 100.0% |
| Explanations grounded in data (LLM judge) | 83.5% |
| Latency median / p90 | 7.8 s / 11.2 s |
| Cost per request (ranking + judge) | $0.0148 |

Cases with a failed check: none

Unsupported claims found by the judge (examples):
- living-basic s29604033: it is the bulkiest option for the room
- living-basic 10555099: the lowest-cost option that fits a scandinavian look
- living-estimated 20355764: the smallest and lowest-priced option at $299
- bedroom s79441736: it is the widest option at 158.1 cm
- bedroom 10234942: It fits the white wardrobe
