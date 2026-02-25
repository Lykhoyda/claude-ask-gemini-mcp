# Strategies & Examples

Get the most out of Ask Gemini MCP by leveraging its massive 1M+ token context window. Here are proven strategies and workflows.

## 🎯 The `@` File Syntax

When asking Gemini to analyze your codebase, you can explicitly target files, directories, or patterns using the `@` symbol inside your prompt.

### Single & Multiple Files
```text
Ask Gemini to explain @index.js and @src/auth.ts
```

### Entire Directories
```text
Ask Gemini to summarize the architecture in @src/
```
```text
What is the purpose of this project? Read @. (current directory)
```

### Wildcards & Globs
```text
review @routes/**/*.js for OWASP vulnerabilities
```

*Tip: Including `package.json` (`@package.json @src/`) helps Gemini understand your dependencies before analyzing your code!*

---

## 🛠️ Real-World Workflows

### 1. The "Second Opinion" Code Review
Don't just rely on one AI model. When you're about to make a major architectural change or submit a Pull Request, ask Gemini for a secondary review.

```text
"Ask Gemini to review the staged changes in @feature/new-api/*.js for security issues, performance concerns, and missing error handling."
```

### 2. Massive Codebase Analysis
Claude is excellent at writing code, but its context window gets expensive and full quickly. Offload heavy reading to Gemini's 1 Million+ token context window.

```text
# Architecture overview
"Ask Gemini to give me a high-level overview of how the frontend and backend connect based on @package.json @src/index.js @client/App.jsx"

# Dependency Analysis
"@package.json @package-lock.json are there any security vulnerabilities or outdated packages?"
```

### 3. Debugging Complex Stack Traces
When your app crashes with a cryptic error, feed the log and the relevant source code to Gemini.

```text
"@error.log @src/api.js I'm getting 500 errors on the /user endpoint after our recent deployment. What caused this crash?"
```

*(Always provide the error log alongside the source file so Gemini has full context).*

### 4. Code Generation & Sandbox Execution
If you want Gemini to write a script and actually verify it runs, ask it to use its execution sandbox.

```text
"Ask Gemini in sandbox mode to create a Python data validation script and run it against a mock dataset."
```

---

## 🛟 Best Practices

1. **Start Broad, Then Narrow**: "First analyze the architecture" → "Now focus on the authentication module" → "Write tests for the auth module."
2. **Be Specific About Intent**: Don't say *"analyze this code"*. Say *"identify performance bottlenecks and suggest optimizations targeting junior developers."*
3. **Model Selection**: The tool defaults to **Gemini 3.1 Pro**. If you just need a quick syntax check on a single file, you can explicitly ask for Flash to get a faster response: *"Use Gemini Flash to check my CSS in @styles.css"*.
