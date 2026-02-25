import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "Ask Gemini MCP Documentation",
    description: "Bridge Gemini models with Claude Desktop",
    base: "/ask-gemini-mcp/",

    vite: {
      build: {
        chunkSizeWarningLimit: 2600,
      },
    },

    // Force dark mode by default
    //appearance: 'dark',

    head: [
      ["link", { rel: "icon", href: "/ask-gemini-mcp/favicon.ico" }],
      [
        "link",
        {
          rel: "icon",
          type: "image/png",
          sizes: "128x128",
          href: "/ask-gemini-mcp/icon.png",
        },
      ],
      [
        "link",
        {
          rel: "apple-touch-icon",
          sizes: "128x128",
          href: "/ask-gemini-mcp/icon.png",
        },
      ],
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
          href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=swap",
          rel: "stylesheet",
        },
      ],
    ],

    themeConfig: {
      logo: "/icon.png",

      nav: [
        { text: "Home", link: "/" },
        { text: "Open Guide", link: "/getting-started" },
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
            { text: "How to Ask Gemini", link: "/usage/how-to-ask" },
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
        { icon: "github", link: "https://github.com/Lykhoyda/ask-gemini-mcp" },
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
