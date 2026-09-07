"""CLI Entrypoint for SatQuery ML Evaluation Suite.

Usage:
    python -m evaluation.run
    python evaluation/run.py --verbose
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Ensure workspace root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evaluation.runner import EvaluationRunner


def main() -> int:
    parser = argparse.ArgumentParser(description="Run SatQuery ML Evaluation Benchmark Suite")
    parser.add_argument(
        "--dataset",
        type=str,
        default="evaluation/datasets/benchmark_cases.json",
        help="Path to benchmark JSON dataset",
    )
    parser.add_argument(
        "--results-dir",
        type=str,
        default="evaluation/results",
        help="Directory to save evaluation results and reports",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print verbose case-by-case outputs",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if not args.verbose else logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    print("=" * 72)
    print("           SatQuery AI - Machine Learning Evaluation Suite")
    print("=" * 72)
    print(f"Dataset:     {args.dataset}")
    print(f"Results Dir: {args.results_dir}")
    print("-" * 72)

    runner = EvaluationRunner(dataset_path=args.dataset, results_dir=args.results_dir)

    results = asyncio.run(runner.run_all())

    summary = results["suite_summary"]
    metrics = results["metrics"]
    clf = metrics["classification"]
    rtg = metrics["routing"]
    cd = metrics["change_detection"]
    vqa = metrics["vqa"]
    gr = metrics["grounding"]
    err = results["error_analysis"]

    print("\n" + "=" * 72)
    print("                         EVALUATION RESULTS")
    print("=" * 72)
    print(f"Total Cases Evaluated:   {summary['total_cases']}")
    print(f"Total Cases Passed:      {summary['passed_cases']}")
    print(f"Total Cases Failed:      {summary['failed_cases']}")
    print(f"Overall Success Rate:    {summary['overall_success_rate'] * 100:.1f}%")
    print(f"Execution Time:          {results['execution_time_seconds']}s")
    print("-" * 72)

    print("\n--- METRIC SCORECARDS ---")
    print(f"Intent Classification Accuracy: {clf['accuracy'] * 100:.1f}%  (Macro F1: {clf['macro_f1']:.4f})")
    print(f"Agent Routing Accuracy:         {rtg['routing_accuracy'] * 100:.1f}%  (Fallback Rate: {rtg['fallback_rate'] * 100:.1f}%)")
    print(f"Change Detection Precision:     {cd['binary_precision'] * 100:.1f}%  (Recall: {cd['binary_recall'] * 100:.1f}%)")
    print(f"VQA Mean Keyword Recall:        {vqa['mean_keyword_recall'] * 100:.1f}%")
    print(f"Grounding Semantic Match:       {gr['mean_semantic_match'] * 100:.1f}%")

    print("\n--- ERROR TAXONOMY BREAKDOWN ---")
    for cat, count in err.get("error_taxonomy", {}).items():
        print(f"  - {cat:28s}: {count} cases")

    if args.verbose:
        print("\n--- DETAILED CASE RESULTS ---")
        for res in results["case_results"]:
            status_symbol = "PASS" if res["passed"] else "FAIL"
            print(f"[{status_symbol}] {res['case_id']} ({res['category']}): {res['query'][:40]}")
            if not res["passed"]:
                print(f"       Failure: {res['failure_reason']}")

    print("\n" + "=" * 72)
    print(f"Reports Generated:")
    print(f"  - JSON Results: {args.results_dir}/eval_results.json")
    print(f"  - Markdown:     {args.results_dir}/eval_report.md")
    print("=" * 72 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
