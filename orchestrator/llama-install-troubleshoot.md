# Llama3.1:8b Install Troubleshooting

This document lists targeted checks and exact `zsh` commands to run on macOS to diagnose a failing `ollama pull llama3.1:8b` (e.g. "max retries exceeded"). Run commands and capture outputs (or `tee` to logs) and paste them here for analysis.

---

## 1) Verify `ollama` CLI and PATH
```zsh
ollama --version
command -v ollama || echo "ollama not on PATH"
```

## 2) Check whether the Ollama HTTP service is listening (port 11434)
```zsh
# Try lsof (macOS), fall back to netstat/ss
lsof -nP -iTCP:11434 -sTCP:LISTEN || netstat -an | grep 11434 || ss -ltnp | grep 11434
```

## 3) Query the Ollama HTTP API for available models/tags
```zsh
# human-friendly if you have jq installed
curl -sS http://localhost:11434/api/tags | jq . || curl -sS http://localhost:11434/api/tags
# If your Ollama host is remote, replace the host:port accordingly
# curl -sS http://<OLLAMA_HOST>:11434/api/tags | jq . || curl -sS http://<OLLAMA_HOST>:11434/api/tags
```

## 4) Attempt manual model pull (capture full output)
```zsh
# Pull the model and save full log
ollama pull llama3.1:8b 2>&1 | tee ~/ollama-pull-llama3.1-8b.log
# After it finishes or fails, inspect the end of the log for errors
tail -n 200 ~/ollama-pull-llama3.1-8b.log
```

## 5) Stream/inspect Ollama logs while pulling
```zsh
# Run in a separate terminal while pulling
ollama logs --follow 2>&1 | tee ~/ollama-logs-follow.log
# After reproducing the error, inspect the tail
tail -n 300 ~/ollama-logs-follow.log
```

## 6) Network & verbose HTTP checks
```zsh
# Verbose curl to see connection/HTTP details
curl -v http://localhost:11434/api/tags 2>&1 | tee ~/ollama-curl-tags-v.log
# If you suspect registry reachability
ping -c 3 registry.ollama.com || true
```

## 7) Disk space and model cache size checks
```zsh
# Disk usage
df -h
# Typical Ollama directories (adjust if configured differently)
du -sh ~/.ollama 2>/dev/null || du -sh ~/Library/Application\ Support/ollama 2>/dev/null || echo "No standard ollama folder found"
```

## 8) Proxy and environment variables that might affect downloads
```zsh
env | egrep -i 'proxy|http_proxy|https_proxy|no_proxy' || true
```

## 9) Orchestrator health, env, and warmup logs
```zsh
# Query orchestrator health (default port 3000)
curl -sS http://localhost:3000/health | jq . || curl -sS http://localhost:3000/health

# Show orchestrator-related environment variables (from repo root)
cd /Users/nikhil/Desktop/Code\ Space/UI-Agent/orchestrator
env | egrep 'LLM|OLLAMA|HF|API' || true

# Start orchestrator manually and capture warmup logs
node index.js 2>&1 | tee ~/orchestrator-warmup.log
# After start, inspect warmup lines
tail -n 200 ~/orchestrator-warmup.log
```

## 10) Cleanup & retry (if partial/corrupt image present)
```zsh
# Remove possibly-broken model, then retry pull
ollama rm llama3.1:8b || true
ollama pull llama3.1:8b 2>&1 | tee ~/ollama-pull-llama3.1-8b-retry.log
tail -n 200 ~/ollama-pull-llama3.1-8b-retry.log
```

## 11) If `ollama` CLI is not available / using remote host
```zsh
# Test a remote Ollama host by replacing <HOST>
curl -sS http://<HOST>:11434/api/tags | jq . || curl -sS http://<HOST>:11434/api/tags
# If using a hosted provider requiring a token, ensure env var is set
# export LLM_API_TOKEN="your_token_here"
```

---

## What to paste back here for fastest diagnosis
- Full stdout/stderr of `ollama pull llama3.1:8b` (the `tee` log if used).
- Tail of `ollama logs --follow` captured during a pull.
- Output of `curl http://localhost:11434/api/tags` (or verbose `curl -v` output).
- Orchestrator warmup logs from `node index.js` (`orchestrator-warmup.log`).
- `df -h` and `env | egrep -i 'proxy|http_proxy|https_proxy|no_proxy'` results.

If you want, I can also prepare a small, safe patch to the orchestrator to add a retry loop and longer warmup. Reply "patch orchestrator" and I'll add it.
