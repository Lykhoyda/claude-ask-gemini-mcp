# Model Selection

Choose the right Gemini model for your task.

## Available Models

### gemini-3.1-pro-preview (Default)
- **Best for**: Complex analysis, large codebases, architectural reviews
- **Context**: 1M tokens
- **Use when**: You need the strongest reasoning, code review, or architectural analysis

### gemini-3-flash-preview (Fallback)
- **Best for**: Quick responses, routine tasks, fast iteration
- **Context**: 1M tokens
- **Use when**: Speed matters more than depth, or Pro quota is exhausted

### Legacy Models
Older models (`gemini-2.5-pro`, `gemini-2.5-flash`) are still supported by the Gemini CLI. You can explicitly request them via the `model` parameter, but they are no longer the default.

## Setting Models
```bash
You need use natural language: "...using gemini flash"
```
```bash
You can also append with '-m' or ask specifically with
```

## Model Comparison

| Model | Speed | Context | Best Use Case |
|-------|-------|---------|---------------|
| `gemini-3.1-pro-preview` | Slower | 1M tokens | Complex reasoning, big ideas |
| `gemini-3-flash-preview` | Fast | 1M tokens | Quick, specific changes |

## Cost Optimization

1. **Start with Pro** (default) for most tasks — best quality
2. **Use Flash** when you need faster responses or hit Pro quota limits
3. The tool **automatically falls back** to Flash when Pro quota is exceeded

## Token Limits

- **Pro**: ~1 million tokens (~250k lines of code)
- **Flash**: ~1 million tokens (~250k lines of code)

## Recommendations

- **Code Review**: Pro (default)
- **Architecture Analysis**: Pro
- **Quick Fixes**: Flash
- **Documentation**: Flash
- **Security Audit**: Pro
