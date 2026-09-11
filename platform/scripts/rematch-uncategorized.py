#!/usr/bin/env python3
"""Audit or rematch legacy upstream products whose source API returned cid=0."""
import argparse
import collections
import hashlib
import math
import os
import re
import subprocess


def mysql(sql: str) -> str:
    env = os.environ.copy()
    env["MYSQL_PWD"] = env["MYSQL_PASSWORD"]
    command = [
        "mysql", "-h", env["DB_HOST"], "-P", env.get("DB_PORT", "3306"),
        "-u", env["MYSQL_USER"], env["MYSQL_DATABASE"], "--batch", "--raw",
        "--skip-column-names",
    ]
    return subprocess.run(command, input=sql, text=True, capture_output=True, env=env, check=True).stdout


def features(title: str, brand: str) -> collections.Counter:
    text = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", title.lower())
    result = collections.Counter()
    for size in (2, 3, 4):
        result.update(f"N{size}:{text[i:i+size]}" for i in range(max(0, len(text)-size+1)))
    brand = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", (brand or "").lower())
    if brand and brand != "无品牌":
        result[f"B:{brand}"] += 3
    return result


def build_model(rows):
    totals = collections.defaultdict(collections.Counter)
    counts = collections.Counter()
    for _, title, brand, category in rows:
        category = int(category)
        totals[category].update(features(title, brand))
        counts[category] += 1
    document_frequency = collections.Counter()
    for values in totals.values():
        document_frequency.update(values.keys())
    class_count = max(1, len(totals))
    idf = {key: math.log((class_count + 1) / (frequency + 1)) + 1 for key, frequency in document_frequency.items()}
    model = {}
    for category, values in totals.items():
        weighted = {key: value * idf.get(key, 1) / counts[category] for key, value in values.items()}
        norm = math.sqrt(sum(value * value for value in weighted.values())) or 1
        model[category] = {key: value / norm for key, value in weighted.items()}
    return model, idf


def predict(model, idf, title, brand):
    query = {key: value * idf.get(key, 1) for key, value in features(title, brand).items()}
    norm = math.sqrt(sum(value * value for value in query.values())) or 1
    scores = sorted(((sum((value / norm) * centroid.get(key, 0) for key, value in query.items()), category)
                     for category, centroid in model.items()), reverse=True)
    best_score, best = scores[0]
    second_score = scores[1][0] if len(scores) > 1 else 0
    return best, best_score, best_score - second_score


def load_rows():
    training_sql = """
      SELECT p.id,REPLACE(REPLACE(p.title,'\\t',' '),'\\n',' '),REPLACE(REPLACE(IFNULL(b.name,''),'\\t',' '),'\\n',' '),p.category_id
      FROM upstream_product_mapping m JOIN product_spu p ON p.id=m.product_id
      JOIN category c ON c.id=p.category_id AND c.deleted_at IS NULL
      LEFT JOIN brand b ON b.id=p.brand_id
      WHERE m.provider='miniapps' AND p.deleted_at IS NULL AND p.category_id<>64
        AND c.parent_id IS NOT NULL;
    """
    target_sql = """
      SELECT p.id,REPLACE(REPLACE(p.title,'\\t',' '),'\\n',' '),REPLACE(REPLACE(IFNULL(b.name,''),'\\t',' '),'\\n',' '),p.category_id
      FROM upstream_product_mapping m JOIN product_spu p ON p.id=m.product_id LEFT JOIN brand b ON b.id=p.brand_id
      WHERE m.provider='miniapps' AND p.deleted_at IS NULL AND p.category_id=64
        AND JSON_UNQUOTE(JSON_EXTRACT(m.raw_json,'$.cid'))='0';
    """
    def parse(text):
        rows=[]
        for line in text.splitlines():
            fields=line.split("\t")
            if len(fields)>=4:
                rows.append([fields[0],fields[1]," ".join(fields[2:-1]),fields[-1]])
        return rows
    return parse(mysql(training_sql)), parse(mysql(target_sql))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--min-score", type=float, default=.09)
    parser.add_argument("--min-margin", type=float, default=.012)
    args = parser.parse_args()
    training, targets = load_rows()
    train, validation = [], []
    for row in training:
        (validation if int(hashlib.sha1(row[0].encode()).hexdigest(), 16) % 10 == 0 else train).append(row)
    model, idf = build_model(train)
    evaluated = [(*predict(model, idf, row[1], row[2]), int(row[3])) for row in validation]
    accepted = [row for row in evaluated if row[1] >= args.min_score and row[2] >= args.min_margin]
    accuracy = sum(predicted == actual for predicted, _, _, actual in accepted) / max(1, len(accepted))
    full_model, full_idf = build_model(training)
    assignments = []
    for row in targets:
        category, score, margin = predict(full_model, full_idf, row[1], row[2])
        if score >= args.min_score and margin >= args.min_margin:
            assignments.append((int(row[0]), category, score, margin))
    print(f"training={len(training)} validation={len(validation)} accepted_validation={len(accepted)} accuracy={accuracy:.4f}")
    print(f"targets={len(targets)} matched={len(assignments)} pending={len(targets)-len(assignments)}")
    distribution = collections.Counter(category for _, category, _, _ in assignments)
    names = dict(line.split("\t", 1) for line in mysql("SELECT id,name FROM category WHERE deleted_at IS NULL;").splitlines())
    for category, count in distribution.most_common():
        print(f"{category}\t{names.get(str(category),'')}\t{count}")
    if args.apply and assignments:
        statements = ["START TRANSACTION;"]
        statements.extend(f"UPDATE product_spu SET category_id={category} WHERE id={product} AND category_id=64;" for product, category, _, _ in assignments)
        statements.append("COMMIT;")
        mysql("\n".join(statements))
        print(f"updated={len(assignments)}")


if __name__ == "__main__":
    main()
