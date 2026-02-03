Remote API Usage (no local model downloads)

Why use a remote/API workflow
- Avoid downloading multi-GB model weights locally.
- Treat the model as an HTTP service (Ollama, hosted Ollama, Hugging Face Inference API, OpenAI, etc.).
- Useful for development, CI, or low-disk machines.

Options
1) Remote Ollama server (recommended if you can run Ollama on another host)
- Someone (or you) runs Ollama on a separate machine or cloud VM and `pull`s the model there.
- Your local orchestrator points to that host's HTTP API at port 11434.

Example env (remote Ollama):

```bash
LLM_API_MODE=ollama
LLM_API_URL=http://REMOTE_HOST:11434   # replace REMOTE_HOST with the host or IP
LLM_MODEL_NAME="llama3.1:8b"          # model name present on the remote host
LLM_USE_LOCAL=false
```

Quick test (replace REMOTE_HOST and model):

```bash
curl -s -X POST 'http://REMOTE_HOST:11434/api/generate' \
  -H "Content-Type: application/json" \
  -d '{
    "model":"llama3.1:8b",
    "prompt":"Say hello in JSON: {\"ok\":true}",
    "max_tokens":64
  }' | jq .
```

2) Hosted inference APIs (Hugging Face Inference, OpenAI, Anthropic, etc.)
- These are true API-first providers and require no local model files.
- They generally charge per request but some offer free tiers.

Example env (Hugging Face Inference / Router):

```bash
LLM_API_MODE=hf
LLM_API_URL="https://api-inference.huggingface.co/models/<owner>/<model>"  # for HF inference
LLM_API_TOKEN="hf_xxx"                                                      # your token
LLM_MODEL_NAME="<owner>/<model>"
LLM_USE_LOCAL=false
```

Quick test (Hugging Face inference):

```bash
curl -s -X POST "https://api-inference.huggingface.co/models/<owner>/<model>" \
  -H "Authorization: Bearer $HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs":"Say hello in JSON: {\"ok\":true}", "parameters":{"max_new_tokens":64}}' | jq .
```

3) Point to any compatible text-generation HTTP API
- If you already have a remote `text-generation-webui` instance, or other HTTP-compatible service, set `LLM_API_MODE=webui` and `LLM_API_URL` to that host.

Orchestrator configuration and testing
- Set the env variables (temporarily in shell) and restart the orchestrator. Example:

```bash
cd /path/to/UI-Agent/orchestrator
export LLM_API_MODE=ollama
export LLM_API_URL="http://REMOTE_HOST:11434"
export LLM_MODEL_NAME="llama3.1:8b"
export LLM_USE_LOCAL=false
nohup npm start > out.log 2>&1 & echo $! > orchestrator.pid
tail -f out.log
```

- Run a `/run` using `curl` or the demo to exercise the pipeline. Artifacts are written to `orchestrator/artifacts/` and the parsed result is saved as `*-analysis-parsed.json`.

Troubleshooting
- If the remote API returns model-not-found, run `ollama list` (on the remote host) or `ollama images` to check names and update `LLM_MODEL_NAME` accordingly.
- If you see non-200 HTTP codes, inspect the orchestrator logs (`out.log`) and the `*-analysis-parsed.json` file — it will include `fetchStatus` and `fetchBody` with diagnostic details.

Quick fallbacks
- If you need zero downloads and zero remote setup right now, use the local rule-based analyzer (no model):

```bash
export LLM_USE_LOCAL=true
```

- This returns deterministic, development-friendly analysis and writes the same `*-analysis-parsed.json` file shape for the UI.

If you'd like, I can also update the `orchestrator/README.md` with a short snippet pointing to this guide.