import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "Ask LLM",
    description:
      "MCP servers for AI-to-AI collaboration — Gemini, Codex, Ollama",
    base: "/ask-llm/",

    appearance: "force-dark",

    vite: {
      build: {
        chunkSizeWarningLimit: 2600,
      },
    },

    head: [
      ["meta", { name: "theme-color", content: "#0a0a0b" }],
      ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap",
          rel: "stylesheet",
        },
      ],
    ],

    themeConfig: {
      siteTitle: "Ask LLM",

      nav: [
        { text: "Home", link: "/" },
        { text: "Guide", link: "/getting-started" },
        {
          text: "Providers",
          items: [
            { text: "Gemini", link: "/providers/gemini" },
            { text: "Codex", link: "/providers/codex" },
            { text: "Ollama", link: "/providers/ollama" },
            { text: "Unified", link: "/providers/unified" },
          ],
        },
        { text: "Claude Plugin", link: "/plugin/overview" },
      ],

      sidebar: [
        {
          text: "Getting Started",
          collapsed: false,
          items: [
            { text: "Overview", link: "/" },
            { text: "Quick Start", link: "/getting-started" },
          ],
        },
        {
          text: "Providers",
          collapsed: false,
          items: [
            { text: "Gemini", link: "/providers/gemini" },
            { text: "Codex", link: "/providers/codex" },
            { text: "Ollama", link: "/providers/ollama" },
            { text: "Unified (ask-llm)", link: "/providers/unified" },
          ],
        },
        {
          text: "Claude Plugin",
          collapsed: false,
          items: [
            { text: "Overview", link: "/plugin/overview" },
            { text: "Skills", link: "/plugin/skills" },
            { text: "Hooks", link: "/plugin/hooks" },
            { text: "Agents", link: "/plugin/agents" },
          ],
        },
        {
          text: "Core Concepts",
          collapsed: false,
          items: [
            { text: "How It Works", link: "/concepts/how-it-works" },
            { text: "Model Selection", link: "/concepts/models" },
            { text: "Sandbox Mode", link: "/concepts/sandbox" },
          ],
        },
        {
          text: "User Guide",
          collapsed: false,
          items: [
            { text: "How to Ask", link: "/usage/how-to-ask" },
            {
              text: "Multi-Turn Sessions",
              link: "/usage/multi-turn-sessions",
            },
            {
              text: "Strategies & Examples",
              link: "/usage/strategies-and-examples",
            },
          ],
        },
        {
          text: "Resources",
          collapsed: true,
          items: [
            { text: "Troubleshooting", link: "/resources/troubleshooting" },
            { text: "FAQ", link: "/resources/faq" },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/Lykhoyda/ask-llm" },
      ],

      footer: {
        message: "Released under the MIT License.",
        copyright: "Making AI collaboration simple, one tool at a time.",
      },

      search: {
        provider: "local",
      },
    },
  }),
);
