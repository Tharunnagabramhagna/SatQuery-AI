"""VQA evaluation metrics: Exact Match, Token F1, Keyword Recall."""

from __future__ import annotations

import re
import string
from typing import Any, Dict, List, Optional, Set


def normalize_answer(text: str) -> str:
    """Lower text and remove punctuation, articles and extra whitespace."""
    def remove_articles(text: str) -> str:
        return re.sub(r"\b(a|an|the)\b", " ", text)

    def white_space_fix(text: str) -> str:
        return " ".join(text.split())

    def remove_punc(text: str) -> str:
        exclude = set(string.punctuation)
        return "".join(ch for ch in text if ch not in exclude)

    def lower(text: str) -> str:
        return text.lower()

    return white_space_fix(remove_articles(remove_punc(lower(text))))


def exact_match_score(prediction: str, reference: str) -> float:
    """Calculate normalized exact match between prediction and reference."""
    return 1.0 if normalize_answer(prediction) == normalize_answer(reference) else 0.0


def token_f1_score(prediction: str, reference: str) -> float:
    """Compute token-level precision, recall, and F1 between strings."""
    pred_tokens = normalize_answer(prediction).split()
    ref_tokens = normalize_answer(reference).split()

    if not pred_tokens or not ref_tokens:
        return 1.0 if pred_tokens == ref_tokens else 0.0

    common: Dict[str, int] = {}
    for tok in pred_tokens:
        if tok in ref_tokens:
            common[tok] = min(pred_tokens.count(tok), ref_tokens.count(tok))

    num_same = sum(common.values())
    if num_same == 0:
        return 0.0

    precision = 1.0 * num_same / len(pred_tokens)
    recall = 1.0 * num_same / len(ref_tokens)
    f1 = (2 * precision * recall) / (precision + recall)
    return round(f1, 4)


def keyword_recall_score(prediction: str, expected_keywords: List[str]) -> float:
    """Calculate proportion of expected domain keywords present in prediction."""
    if not expected_keywords:
        return 1.0

    norm_pred = normalize_answer(prediction)
    hits = sum(1 for kw in expected_keywords if normalize_answer(kw) in norm_pred)
    return round(hits / len(expected_keywords), 4)


def calculate_vqa_metrics(
    predictions: List[str],
    reference_keywords_list: List[List[str]],
    references: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Compute aggregate VQA evaluation metrics."""
    if not predictions:
        return {
            "mean_keyword_recall": 0.0,
            "mean_token_f1": 0.0,
            "mean_exact_match": 0.0,
            "total_cases": 0,
        }

    total = len(predictions)
    keyword_scores = [
        keyword_recall_score(pred, kws)
        for pred, kws in zip(predictions, reference_keywords_list)
    ]

    mean_kw = round(sum(keyword_scores) / total, 4)

    em_scores: List[float] = []
    f1_scores: List[float] = []

    if references and len(references) == total:
        for pred, ref in zip(predictions, references):
            em_scores.append(exact_match_score(pred, ref))
            f1_scores.append(token_f1_score(pred, ref))
        mean_em = round(sum(em_scores) / total, 4)
        mean_f1 = round(sum(f1_scores) / total, 4)
    else:
        mean_em = 0.0
        mean_f1 = 0.0

    return {
        "mean_keyword_recall": mean_kw,
        "mean_token_f1": mean_f1,
        "mean_exact_match": mean_em,
        "total_cases": total,
    }
