import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import DiagramModal from "../components/DiagramModal.vue";
import SetupTabs from "../components/SetupTabs.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: Layout,
  enhanceApp({ app }) {
    app.component("DiagramModal", DiagramModal);
    app.component("SetupTabs", SetupTabs);
  },
};
