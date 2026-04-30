# Hybrid AI Validation Report

**Status:** Active architecture uses **OpenRouter as primary** and **Gemini as fallback**.

## Current Provider Policy

- Primary provider: OpenRouter
- Preferred OpenRouter model: `anthropic/claude-3.5-sonnet`
- OpenRouter backups: `openai/gpt-4o`, `meta-llama/llama-3.1-70b-instruct`
- Fallback provider: Gemini
- Gemini fallback model: `gemini-1.5-pro`

## Notes

- Ollama removed - using OpenRouter.
- Chat responses should target complete markdown-formatted answers with a minimum `2048` token budget.
- Environment validation should ensure both `OPENROUTER_API_KEY` and `GEMINI_API_KEY` are present.
