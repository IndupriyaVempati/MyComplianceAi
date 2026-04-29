# Local Model Benchmarking

Use this project-level benchmark to compare the Ollama models used by the app.
It measures latency, first-token time, output speed, Ollama token counts, and
basic instruction-following checks.

## Run All Installed Models

```powershell
.\backend\.venv312\Scripts\python.exe .\tools\benchmark_ollama_models.py
```

The script discovers models from:

```powershell
ollama list
```

## Run Specific Models

```powershell
.\backend\.venv312\Scripts\python.exe .\tools\benchmark_ollama_models.py --models qwen3:8b,gemma3:4b,glm4:9b
```

## More Stable Results

For a stronger benchmark, run each scenario multiple times:

```powershell
.\backend\.venv312\Scripts\python.exe .\tools\benchmark_ollama_models.py --repeat 3 --num-predict 256
```

By default the script sends Ollama `think=false`, so thinking models such as
Qwen3 return visible chat answers instead of spending the whole token budget in
their hidden reasoning stream. To compare thinking mode explicitly, run:

```powershell
.\backend\.venv312\Scripts\python.exe .\tools\benchmark_ollama_models.py --models qwen3:8b --think true
```

## Main Metrics

- `success_rate`: model completed without an API/runtime error.
- `check_pass_rate`: response passed simple instruction checks such as valid JSON.
- `avg_wall_ms`: total wall-clock time seen by the client.
- `avg_first_token_ms`: time until the first generated token arrived.
- `avg_first_any_token_ms`: time until the first content or thinking token arrived.
- `avg_prompt_eval_ms`: time Ollama spent processing the prompt.
- `avg_eval_ms`: time Ollama spent generating output.
- `avg_output_tokens`: average generated token count.
- `avg_tokens_per_sec`: generation throughput from Ollama's `eval_count / eval_duration`.

## Output Files

Results are written to `benchmark-results/`:

- `ollama_benchmark_summary_*.csv`
- `ollama_benchmark_runs_*.csv`
- `ollama_benchmark_runs_*.json`
- `ollama_benchmark_report_*.md`

Use the summary CSV for charts and the run CSV/JSON for detailed analysis.
