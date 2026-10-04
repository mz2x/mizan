# Reranker check for the retrieval comparison: re-scores the top-50 hybrid pool of each clause with
# a cross-encoder (BAAI/bge-reranker-v2-m3, local) and measures whether a governing unit lands in
# the top 17 handed to the judge. Input/output in .data/lab (written by retrieval-lab.ts).
import json, sys
from sentence_transformers import CrossEncoder

items = json.load(open(".data/lab/rerank-pool.json"))
model = CrossEncoder("BAAI/bge-reranker-v2-m3", max_length=512)
hit = mrr = 0
pool_hit = 0
missed = []
for it in items:
    pairs = [(it.get("query", it["clause"]) if len(sys.argv) > 1 else it["clause"], u["text"]) for u in it["pool"]]
    scores = model.predict(pairs, batch_size=16)
    ranked = [u["id"] for _, u in sorted(zip(scores, it["pool"]), key=lambda x: -x[0])]
    if any(u in [p["id"] for p in it["pool"]] for u in it["units"]): pool_hit += 1
    top = ranked[:17]
    rank = next((i for i, x in enumerate(top) if x in it["units"]), -1)
    if rank >= 0:
        hit += 1; mrr += 1 / (rank + 1)
    else:
        missed.append(it["units"][0])
n = len(items)
res = {"n": n, "pool50_recall": pool_hit / n, "rerank_top17_recall": hit / n, "mrr": mrr / n, "missed": missed}
json.dump(res, open(".data/lab/rerank" + ("-query" if len(sys.argv) > 1 else "") + ".json", "w"), ensure_ascii=False, indent=2)
print(json.dumps(res, ensure_ascii=False))
