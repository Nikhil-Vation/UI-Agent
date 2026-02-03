LLM-enabled Orchestrator
======================

This folder runs the UI accessibility orchestrator.

Environment
-----------
- `PORT` - server port (defaults to `3000`).
- `LLM_API_URL` - optional. If set to an HTTP(S) inference endpoint (e.g., GLM-4.5-Air or Hugging Face endpoint), the orchestrator will POST prompts to it and store the returned analysis in `artifacts/{id}-analysis.json`.
- `LLM_API_TOKEN` - optional. If your LLM endpoint requires an Authorization header, set this and the `llmClient` will send it as `Authorization: Bearer <token>`.

Usage
-----
Start the server:
```
cd orchestrator
npm install
npm start
```

Run an audit (example):
```
curl -X POST http://localhost:3000/run -H "Content-Type: application/json" -d '{"url":"http://localhost:8000/demo.html"}'
```

Notes
-----
- The repo includes a simple rule-based fallback analyzer when `LLM_API_URL` is not configured. To use a hosted LLM, set `LLM_API_URL` and `LLM_API_TOKEN` (if required). See `../templates/llm-prompts.md` for the prompt template used.

Running with a free local LLM (text-generation-webui)
-----------------------------------------------

If you want a completely free/local LLM (no credits) you can run `text-generation-webui` locally and point the orchestrator at it.

1. Install `text-generation-webui` and a small ggml/quantized model following its instructions: https://github.com/oobabooga/text-generation-webui
2. Start the web UI/server (default port 7860). Example (after installation):

```bash
# start webui (adjust per webui docs)
python server.py --model <your-installed-model>
```

3. Configure the orchestrator to use the webui by setting environment variables in `.env` or exporting them:

```bash
export LLM_API_URL="http://localhost:7860"
export LLM_API_MODE=webui
export LLM_MODEL_NAME="<model_name>"
```

4. Run the orchestrator as usual. The orchestrator will POST to `http://localhost:7860/api/generate` and attempt to parse the returned `generated_text`.

Notes:
- You must install a model into `text-generation-webui` — the orchestrator will not download model files for you.
- If you prefer deterministic, fast, and credit-free outputs for UI development, you can also set `LLM_USE_LOCAL=true` to run the built-in rule-based `localAnalyze(report)` (no model required).

Running with Ollama (recommended free local server)
-------------------------------------------------

Ollama runs a local daemon that serves models over an HTTP API (default port 11434). It's a convenient way to run models locally without cloud credits.

1. Install Ollama following the guide: https://ollama.ai/docs
2. Pull or install a model with Ollama (check model licensing). Example:

```bash
# install a model using ollama CLI (example)
ollama pull llama2
```

3. Start Ollama (the daemon runs automatically after install) and configure the orchestrator:

```bash
export LLM_API_URL="http://localhost:11434"
export LLM_API_MODE=ollama
export LLM_MODEL_NAME="<model-name>"
```

4. Run the orchestrator. The orchestrator will POST prompts to `http://localhost:11434/api/generate` and parse the response.

Notes:
- Ollama itself is free software for running locally; ensure any model you pull is permitted for your use (some models require licenses).
- If you explicitly want to avoid model downloads, continue using `LLM_USE_LOCAL=true` to use the built-in rule-based analyzer.
