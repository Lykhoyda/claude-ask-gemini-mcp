<template>
  <div class="setup-tabs-container">
    <div class="setup-tabs">
      <div class="tab-header">
        <div class="mac-dots"><span></span><span></span><span></span></div>
        <div class="tab-buttons">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      <div class="tab-content relative-container">
        <transition name="fade" mode="out-in">
          <div
            v-if="activeTab === 'claude-code'"
            class="tab-panel"
            key="claude-code"
          >
            <div class="panel-inner">
              <p class="config-hint">Run in your terminal:</p>
              <div class="language-bash vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">bash</span>
                <pre
                  class="shiki"
                ><code><span class="line"><span class="comment"># Project scope (current project only)</span></span>
<span class="line"><span>claude mcp add gemini-cli -- npx -y ask-gemini-mcp</span></span>
<span class="line"></span>
<span class="line"><span class="comment"># User scope (all projects)</span></span>
<span class="line"><span>claude mcp add --scope user gemini-cli -- npx -y ask-gemini-mcp</span></span></code></pre>
              </div>
            </div>
          </div>
          <div
            v-else-if="activeTab === 'claude-desktop'"
            class="tab-panel"
            key="claude-desktop"
          >
            <div class="panel-inner">
              <p class="config-hint">
                Add to <code>claude_desktop_config.json</code>:
              </p>
              <div class="language-json vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">json</span>
                <pre class="shiki"><code><span class="line">{</span>
<span class="line">  <span class="string">"mcpServers"</span>: {</span>
<span class="line">    <span class="string">"gemini-cli"</span>: {</span>
<span class="line">      <span class="string">"command"</span>: <span class="string">"npx"</span>,</span>
<span class="line">      <span class="string">"args"</span>: [<span class="string">"-y"</span>, <span class="string">"ask-gemini-mcp"</span>]</span>
<span class="line">    }</span>
<span class="line">  }</span>
<span class="line">}</span></code></pre>
              </div>
            </div>
          </div>
          <div
            v-else-if="activeTab === 'cursor'"
            class="tab-panel"
            key="cursor"
          >
            <div class="panel-inner">
              <p class="config-hint">Add to <code>.cursor/mcp.json</code>:</p>
              <div class="language-json vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">json</span>
                <pre class="shiki"><code><span class="line">{</span>
<span class="line">  <span class="string">"mcpServers"</span>: {</span>
<span class="line">    <span class="string">"gemini-cli"</span>: {</span>
<span class="line">      <span class="string">"command"</span>: <span class="string">"npx"</span>,</span>
<span class="line">      <span class="string">"args"</span>: [<span class="string">"-y"</span>, <span class="string">"ask-gemini-mcp"</span>]</span>
<span class="line">    }</span>
<span class="line">  }</span>
<span class="line">}</span></code></pre>
              </div>
            </div>
          </div>
          <div v-else-if="activeTab === 'codex'" class="tab-panel" key="codex">
            <div class="panel-inner">
              <p class="config-hint">Run in your terminal:</p>
              <div class="language-bash vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">bash</span>
                <pre
                  class="shiki"
                ><code><span class="line">codex mcp add gemini-cli -- npx -y ask-gemini-mcp</span></code></pre>
              </div>
            </div>
          </div>
          <div
            v-else-if="activeTab === 'opencode'"
            class="tab-panel"
            key="opencode"
          >
            <div class="panel-inner">
              <p class="config-hint">Add to <code>opencode.json</code>:</p>
              <div class="language-json vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">json</span>
                <pre class="shiki"><code><span class="line">{</span>
<span class="line">  <span class="string">"mcp"</span>: {</span>
<span class="line">    <span class="string">"gemini-cli"</span>: {</span>
<span class="line">      <span class="string">"type"</span>: <span class="string">"local"</span>,</span>
<span class="line">      <span class="string">"command"</span>: [<span class="string">"npx"</span>, <span class="string">"-y"</span>, <span class="string">"ask-gemini-mcp"</span>]</span>
<span class="line">    }</span>
<span class="line">  }</span>
<span class="line">}</span></code></pre>
              </div>
            </div>
          </div>
          <div v-else class="tab-panel" key="other">
            <div class="panel-inner">
              <p class="config-hint">Standard STDIO transport config:</p>
              <div class="language-json vp-adaptive-theme">
                <button title="Copy Code" class="copy"></button>
                <span class="lang">json</span>
                <pre class="shiki"><code><span class="line">{</span>
<span class="line">  <span class="string">"command"</span>: <span class="string">"npx"</span>,</span>
<span class="line">  <span class="string">"args"</span>: [<span class="string">"-y"</span>, <span class="string">"ask-gemini-mcp"</span>]</span>
<span class="line">}</span></code></pre>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const activeTab = ref("claude-code");

const tabs = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex CLI" },
  { id: "opencode", label: "OpenCode" },
  { id: "other", label: "Other" },
];
</script>

<style scoped>
.setup-tabs-container {
  margin: 32px 0;
  display: flex;
  justify-content: center;
}

.setup-tabs {
  width: 100%;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider-light);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

html.dark .setup-tabs {
  background: #1a1a1c;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.06);
}

html:not(.dark) .setup-tabs {
  background: #f0f2f5;
  border-color: rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.setup-tabs:hover {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08);
}

html.dark .setup-tabs:hover {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.1);
}

.tab-header {
  display: flex;
  align-items: center;
  background: linear-gradient(
    to bottom,
    var(--vp-c-bg-soft),
    var(--vp-c-bg-mute)
  );
  border-bottom: 1px solid var(--vp-c-divider-light);
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

html:not(.dark) .tab-header {
  background: linear-gradient(to bottom, #e8eaee, #dfe1e6);
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

html.dark .tab-header {
  background: linear-gradient(to bottom, #1e1e20, #141416);
}

.tab-header::-webkit-scrollbar {
  display: none;
}

.mac-dots {
  display: flex;
  gap: 8px;
  margin-right: 24px;
  flex-shrink: 0;
}

.mac-dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.2),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);
}

html.dark .mac-dots span {
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.1),
    inset 0 -1px 2px rgba(0, 0, 0, 0.3);
}

.mac-dots span:nth-child(1) {
  background-color: #ff5f56;
  border: 1px solid #e0443e;
}
.mac-dots span:nth-child(2) {
  background-color: #ffbd2e;
  border: 1px solid #dea123;
}
.mac-dots span:nth-child(3) {
  background-color: #27c93f;
  border: 1px solid #1aab29;
}

.tab-buttons {
  display: flex;
  gap: 4px;
}

.tab-button {
  padding: 6px 14px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
  background: transparent;
  border: none;
  white-space: nowrap;
  position: relative;
}

.tab-button:hover {
  color: var(--vp-c-text-1);
  background: rgba(128, 128, 128, 0.1);
}

.tab-button.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

html.dark .tab-button.active {
  background: rgba(79, 138, 247, 0.15);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.tab-button.active::after {
  content: "";
  position: absolute;
  bottom: -13px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--vp-c-brand-1);
  border-radius: 2px 2px 0 0;
}

.relative-container {
  position: relative;
  display: flex;
  flex-direction: column;
}

.tab-panel {
  width: 100%;
}

.panel-inner {
  padding: 24px;
}

/* Vue Transitions */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.config-hint {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0 0 16px;
}

.config-hint code {
  background: var(--vp-c-bg-mute);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--vp-c-divider-light);
  color: var(--vp-c-text-1);
}

.tab-panel :deep(div[class*="language-"]) {
  margin: 0;
  border-radius: 8px;
  background: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-divider-light);
}

.tab-panel :deep(div[class*="language-"]:last-child),
.tab-panel :deep(pre) {
  margin-bottom: 0 !important;
}

html.dark .tab-panel :deep(div[class*="language-"]) {
  background: #0d0d0f;
  border-color: rgba(255, 255, 255, 0.05);
}

.comment {
  color: #8b949e;
  font-style: italic;
}
.string {
  color: #a5d6ff;
}

/* Default text color for punctuation and braces */
.tab-panel :deep(pre.shiki) {
  color: #c9d1d9;
}

/* Light mode syntax overrides — high contrast */
html:not(.dark) .tab-panel :deep(pre.shiki) {
  color: #1e2028;
}
html:not(.dark) .tab-panel :deep(pre.shiki code) {
  color: #1e2028;
}
/* Only override bare spans (no class), preserve .string and .comment colors */
html:not(.dark) .tab-panel :deep(pre.shiki .line > span:not([class])) {
  color: #1e2028;
}
/* Force syntax colors in light mode — must come after base color rules */
html:not(.dark) .tab-panel .string,
html:not(.dark) .string {
  color: #c45100 !important;
}
html:not(.dark) .tab-panel .comment,
html:not(.dark) .comment {
  color: #4b5563 !important;
  font-style: italic;
}
html:not(.dark) .tab-panel :deep(div[class*="language-"]) {
  background: #eceef2;
  border-color: rgba(0, 0, 0, 0.12);
}
html:not(.dark) .tab-panel :deep(.lang) {
  color: #6b7080;
}
</style>
