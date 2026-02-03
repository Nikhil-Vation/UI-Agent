#!/usr/bin/env bash
# Simple helper to install Ollama (macOS) and show quick verification commands.
# This script does NOT automatically pull large models. It installs the Ollama CLI
# via Homebrew if available, or prints the manual installer command otherwise.

set -euo pipefail

echo "\n=== Ollama Install Helper ===\n"

if command -v ollama >/dev/null 2>&1; then
  echo "Ollama is already installed: $(ollama --version 2>/dev/null || echo 'version unknown')"
  echo "Run: ollama pull <model-name> to install a model (e.g. llama2)."
  exit 0
fi

if command -v brew >/dev/null 2>&1; then
  echo "Homebrew detected. Installing ollama via brew..."
  echo "You may be prompted for your password."
  brew install ollama
  echo "\nInstalled ollama. Verify with: ollama --version"
  echo "\nNext, pull a model: ollama pull <model-name> (e.g. ollama pull llama2)"
  exit 0
fi

echo "Homebrew not found. To install Ollama manually, run the official installer:" 
echo "  curl -s https://ollama.ai/install.sh | sh"
echo "After install, run: ollama pull <model-name>"

echo "\nVerification commands you should run after installing and pulling a model:" 
echo "  # list models\n  curl -s http://localhost:11434/v1/models | jq . || curl -s http://localhost:11434/v1/models"
echo "  # quick generate (replace <model-name>)\n  curl -s -X POST \"http://localhost:11434/api/generate\" -H \"Content-Type: application/json\" -d '{\"model\":\"<model-name>\",\"prompt\":\"Say hello in JSON: {\\\"ok\\\":true}\",\"max_tokens\":64}' | jq ."

echo "\nIf you want, run this script then paste the output of the verification commands here and I'll run the orchestrator end-to-end."