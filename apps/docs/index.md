---
layout: home

hero:
  name: "Ask Gemini MCP"
  text: "AI-to-AI collaboration via the Gemini CLI"
  tagline: "Get a second opinion from Gemini in any MCP-compatible AI assistant"
  actions:
    - theme: brand
      text: Full Setup Guide
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Lykhoyda/ask-gemini-mcp
    - theme: alt
      text: npm package
      link: https://www.npmjs.com/package/ask-gemini-mcp
---

<div class="vp-doc home-content">

<h2 class="section-title">Installation</h2>

<SetupTabs />

  <div class="features-grid">
    <div class="feature-card">
      <div class="icon-wrapper">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feature-icon"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <h3>Quick Setup</h3>
      <p>Get started in minutes. Pick your client and add the MCP server. Requires <a href="https://nodejs.org/" target="_blank">Node.js</a> v20+ and <a href="https://github.com/google-gemini/gemini-cli" target="_blank">Gemini CLI</a> authenticated via <code>gemini login</code>.</p>
    </div>
    <div class="feature-card highlight">
      <div class="icon-wrapper">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feature-icon"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
      <h3>Verify</h3>
      <p>Ask your AI assistant: <code>Use Gemini ping to test the connection</code>. Got <em>Pong!</em> back? You're ready. See <a href="/ask-gemini-mcp/usage/how-to-ask">How to Ask Gemini</a> for usage examples.</p>
    </div>
    <div class="feature-card">
      <div class="icon-wrapper">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feature-icon"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"/></svg>
      </div>
      <h3>Seamless Integration</h3>
      <p>Works as a standard MCP tool, meaning no strange prompt hacks. Your primary LLM transparently delegates secondary research, code reviews, or brainstorming tasks to Gemini APIs.</p>
    </div>
    <div class="feature-card">
      <div class="icon-wrapper">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feature-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h3>Multi-Turn Sessions</h3>
      <p>Continue conversations with Gemini across multiple calls. Review code, then follow up for fixes — Gemini remembers the full context. See <a href="/ask-gemini-mcp/usage/multi-turn-sessions">Multi-Turn Sessions</a> for details.</p>
    </div>
  </div>

<h2 class="section-title">Explore the Docs</h2>

<div class="next-steps-grid">
  <a href="/ask-gemini-mcp/concepts/how-it-works" class="next-step-card">
    <div class="next-step-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </div>
    <span class="next-step-label">How It Works</span>
    <span class="next-step-desc">Understand the request flow</span>
  </a>
  <a href="/ask-gemini-mcp/usage/how-to-ask" class="next-step-card">
    <div class="next-step-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
    </div>
    <span class="next-step-label">How to Ask Gemini</span>
    <span class="next-step-desc">Usage patterns and examples</span>
  </a>
  <a href="/ask-gemini-mcp/concepts/models" class="next-step-card">
    <div class="next-step-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
    </div>
    <span class="next-step-label">Model Selection</span>
    <span class="next-step-desc">Pro vs Flash and when to use each</span>
  </a>
  <a href="/ask-gemini-mcp/usage/multi-turn-sessions" class="next-step-card">
    <div class="next-step-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <span class="next-step-label">Multi-Turn Sessions</span>
    <span class="next-step-desc">Continue conversations across calls</span>
  </a>
  <a href="/ask-gemini-mcp/resources/troubleshooting" class="next-step-card">
    <div class="next-step-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    </div>
    <span class="next-step-label">Troubleshooting</span>
    <span class="next-step-desc">Common issues and fixes</span>
  </a>
</div>

</div>
