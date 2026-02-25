# Sandbox Mode

Run Gemini CLI in sandbox mode for safer code execution.

## What is Sandbox Mode?

Sandbox mode passes the `-s` flag to Gemini CLI, enabling its built-in sandbox environment for code execution. This lets Gemini write and run code in an isolated context.

## Usage

Set the `sandbox` parameter to `true` when using `ask-gemini`:

```
ask gemini in sandbox mode to create and run a Python script that sorts a list
```

Or use natural language:

```
use gemini sandbox to test this code safely
```

## When to Use Sandbox Mode

- **Testing code snippets**: Let Gemini run code to verify it works
- **Proof of concepts**: Quickly prototype ideas
- **Learning**: See code execute with real output
- **Safe experimentation**: Run code without affecting your system

## How It Works

1. Your prompt is sent to Gemini CLI with the `-s` flag
2. Gemini executes code in its sandboxed environment
3. Results (including execution output) are returned

## Limitations

Sandbox capabilities depend on the Gemini CLI version and your Gemini account. Refer to the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli) for current sandbox features and constraints.
