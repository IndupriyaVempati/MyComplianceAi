#!/usr/bin/env python3
"""Benchmark local Ollama chat models.

The script talks to Ollama's native API so it can collect server-side timing
metrics such as prompt eval time, eval time, token counts, and load time.
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


NS_PER_MS = 1_000_000
NS_PER_SEC = 1_000_000_000


@dataclass(frozen=True)
class Scenario:
    name: str
    prompt: str
    expect_contains: str | None = None
    expect_json_keys: tuple[str, ...] = ()


SCENARIOS = [
    Scenario(
        name="compliance_summary",
        prompt=(
            "You are reviewing a compliance report. In exactly 5 bullet points, "
            "summarize the major compliance risks, missing controls, and next actions."
        ),
        expect_contains="risk",
    ),
    Scenario(
        name="json_risk_extract",
        prompt=(
            "Return valid JSON only. Extract compliance findings from this text: "
            "'The vendor has no audit trail, access reviews are overdue, and backup "
            "restore testing is undocumented.' Use keys: risk_count, top_risk, actions."
        ),
        expect_json_keys=("risk_count", "top_risk", "actions"),
    ),
    Scenario(
        name="policy_decision",
        prompt=(
            "A user wants to upload a customer file containing email addresses to a "
            "third-party service. Give a concise compliance decision with sections: "
            "Decision, Reason, Required Safeguards."
        ),
        expect_contains="Decision",
    ),
]


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def iter_stream(url: str, payload: dict[str, Any]):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=None) as response:
        for raw_line in response:
            line = raw_line.decode("utf-8").strip()
            if line:
                yield json.loads(line)


def list_models(base_url: str) -> list[dict[str, Any]]:
    payload = request_json("GET", f"{base_url}/api/tags")
    models = payload.get("models", [])
    return sorted(models, key=lambda item: item.get("name", ""))


def ms(value_ns: int | float | None) -> float | None:
    if value_ns is None:
        return None
    return round(float(value_ns) / NS_PER_MS, 2)


def tokens_per_second(tokens: int | None, duration_ns: int | None) -> float | None:
    if not tokens or not duration_ns:
        return None
    return round(tokens / (duration_ns / NS_PER_SEC), 2)


def check_response(text: str, scenario: Scenario) -> tuple[bool, str]:
    if scenario.expect_json_keys:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            return False, f"invalid_json:{exc.msg}"
        missing = [key for key in scenario.expect_json_keys if key not in parsed]
        if missing:
            return False, "missing_keys:" + ",".join(missing)
    if scenario.expect_contains and scenario.expect_contains.lower() not in text.lower():
        return False, "missing_text:" + scenario.expect_contains
    return True, ""


def run_once(
    *,
    base_url: str,
    model: str,
    scenario: Scenario,
    repeat_index: int,
    num_predict: int,
    temperature: float,
    think: str,
) -> dict[str, Any]:
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "user", "content": scenario.prompt}],
        "options": {"temperature": temperature, "num_predict": num_predict},
    }
    if think != "auto":
        payload["think"] = think == "true"

    started = time.perf_counter()
    first_content_at: float | None = None
    first_any_token_at: float | None = None
    content_parts: list[str] = []
    thinking_parts: list[str] = []
    final_chunk: dict[str, Any] = {}
    error = ""

    try:
        for chunk in iter_stream(f"{base_url}/api/chat", payload):
            message = chunk.get("message") or {}
            piece = message.get("content") or ""
            thinking_piece = message.get("thinking") or ""
            if (piece or thinking_piece) and first_any_token_at is None:
                first_any_token_at = time.perf_counter()
            if piece and first_content_at is None:
                first_content_at = time.perf_counter()
            if piece:
                content_parts.append(piece)
            if thinking_piece:
                thinking_parts.append(thinking_piece)
            if chunk.get("done"):
                final_chunk = chunk
                break
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        error = str(exc)

    ended = time.perf_counter()
    text = "".join(content_parts).strip()
    thinking_text = "".join(thinking_parts).strip()
    passed, check_error = check_response(text, scenario) if not error else (False, error)

    prompt_tokens = final_chunk.get("prompt_eval_count")
    output_tokens = final_chunk.get("eval_count")
    eval_duration = final_chunk.get("eval_duration")

    return {
        "model": model,
        "scenario": scenario.name,
        "repeat": repeat_index,
        "success": not error,
        "check_passed": passed,
        "check_error": check_error,
        "wall_ms": round((ended - started) * 1000, 2),
        "first_token_ms": round((first_content_at - started) * 1000, 2)
        if first_content_at
        else None,
        "first_any_token_ms": round((first_any_token_at - started) * 1000, 2)
        if first_any_token_at
        else None,
        "load_ms": ms(final_chunk.get("load_duration")),
        "prompt_eval_ms": ms(final_chunk.get("prompt_eval_duration")),
        "eval_ms": ms(eval_duration),
        "total_api_ms": ms(final_chunk.get("total_duration")),
        "prompt_tokens": prompt_tokens,
        "output_tokens": output_tokens,
        "tokens_per_sec": tokens_per_second(output_tokens, eval_duration),
        "chars": len(text),
        "thinking_chars": len(thinking_text),
        "preview": (text or thinking_text).replace("\n", " ")[:180],
    }


def average(values: list[float | int | None]) -> float | None:
    clean = [float(value) for value in values if value is not None]
    if not clean:
        return None
    return round(statistics.mean(clean), 2)


def summarize(rows: list[dict[str, Any]], model_info: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    summaries = []
    for model in sorted({row["model"] for row in rows}):
        model_rows = [row for row in rows if row["model"] == model]
        success_rows = [row for row in model_rows if row["success"]]
        info = model_info.get(model, {})
        summaries.append(
            {
                "model": model,
                "size_gb": round((info.get("size") or 0) / (1024**3), 2),
                "runs": len(model_rows),
                "success_rate": round(len(success_rows) / len(model_rows), 3)
                if model_rows
                else 0,
                "check_pass_rate": round(
                    sum(1 for row in model_rows if row["check_passed"]) / len(model_rows), 3
                )
                if model_rows
                else 0,
                "avg_wall_ms": average([row["wall_ms"] for row in success_rows]),
                "avg_first_token_ms": average([row["first_token_ms"] for row in success_rows]),
                "avg_first_any_token_ms": average(
                    [row["first_any_token_ms"] for row in success_rows]
                ),
                "avg_prompt_eval_ms": average([row["prompt_eval_ms"] for row in success_rows]),
                "avg_eval_ms": average([row["eval_ms"] for row in success_rows]),
                "avg_output_tokens": average([row["output_tokens"] for row in success_rows]),
                "avg_tokens_per_sec": average([row["tokens_per_sec"] for row in success_rows]),
            }
        )
    return summaries


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, summaries: list[dict[str, Any]], rows: list[dict[str, Any]]) -> None:
    headers = [
        "model",
        "size_gb",
        "runs",
        "success_rate",
        "check_pass_rate",
        "avg_wall_ms",
        "avg_first_token_ms",
        "avg_tokens_per_sec",
    ]
    lines = ["# Ollama Model Benchmark", ""]
    lines.append(f"Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in summaries:
        lines.append("| " + " | ".join(str(row.get(header, "")) for header in headers) + " |")
    lines.append("")
    lines.append("## Run Details")
    lines.append("")
    for row in rows:
        status = "pass" if row["check_passed"] else "fail"
        lines.append(
            f"- `{row['model']}` `{row['scenario']}` repeat {row['repeat']}: "
            f"{status}, wall={row['wall_ms']}ms, first_token={row['first_token_ms']}ms, "
            f"tok/s={row['tokens_per_sec']}, preview={row['preview']!r}"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def print_table(rows: list[dict[str, Any]]) -> None:
    if not rows:
        print("No benchmark rows generated.")
        return
    headers = [
        "model",
        "runs",
        "success_rate",
        "check_pass_rate",
        "avg_wall_ms",
        "avg_first_token_ms",
        "avg_tokens_per_sec",
    ]
    widths = {
        header: max(len(header), *(len(str(row.get(header, ""))) for row in rows))
        for header in headers
    }
    print("  ".join(header.ljust(widths[header]) for header in headers))
    print("  ".join("-" * widths[header] for header in headers))
    for row in rows:
        print("  ".join(str(row.get(header, "")).ljust(widths[header]) for header in headers))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark installed Ollama models.")
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--models", help="Comma-separated model names. Defaults to all installed models.")
    parser.add_argument("--repeat", type=int, default=1, help="Runs per scenario per model.")
    parser.add_argument("--num-predict", type=int, default=256, help="Maximum generated tokens.")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument(
        "--think",
        choices=("auto", "false", "true"),
        default="false",
        help="Ollama native thinking mode. Default false gives visible chat answers.",
    )
    parser.add_argument(
        "--output-dir",
        default="benchmark-results",
        help="Directory for CSV, JSON, and Markdown reports.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/")
    output_dir = Path(args.output_dir)

    try:
        installed = list_models(base_url)
    except Exception as exc:
        print(f"Could not reach Ollama at {base_url}: {exc}", file=sys.stderr)
        return 1

    installed_by_name = {item["name"]: item for item in installed}
    models = (
        [model.strip() for model in args.models.split(",") if model.strip()]
        if args.models
        else list(installed_by_name)
    )
    missing = [model for model in models if model not in installed_by_name]
    if missing:
        print("These models are not installed in Ollama: " + ", ".join(missing), file=sys.stderr)
        return 1

    rows: list[dict[str, Any]] = []
    total_runs = len(models) * len(SCENARIOS) * args.repeat
    current = 0
    for model in models:
        for scenario in SCENARIOS:
            for repeat_index in range(1, args.repeat + 1):
                current += 1
                print(f"[{current}/{total_runs}] {model} - {scenario.name} repeat {repeat_index}")
                rows.append(
                    run_once(
                        base_url=base_url,
                        model=model,
                        scenario=scenario,
                        repeat_index=repeat_index,
                        num_predict=args.num_predict,
                        temperature=args.temperature,
                        think=args.think,
                    )
                )

    summaries = summarize(rows, installed_by_name)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    write_csv(output_dir / f"ollama_benchmark_runs_{stamp}.csv", rows)
    write_csv(output_dir / f"ollama_benchmark_summary_{stamp}.csv", summaries)
    (output_dir / f"ollama_benchmark_runs_{stamp}.json").write_text(
        json.dumps(rows, indent=2),
        encoding="utf-8",
    )
    write_markdown(output_dir / f"ollama_benchmark_report_{stamp}.md", summaries, rows)

    print()
    print_table(summaries)
    print()
    print(f"Reports written to: {output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
