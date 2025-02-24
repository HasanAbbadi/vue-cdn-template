export default class VueCDNParser {
  constructor() {
    this.components = {};
  }

  init(app) {
    Object.entries(this.components).forEach(([name, component]) => {
      app.component(name, component);
    });
  }

  async use(pathOrObject) {
    if (typeof pathOrObject === "string") {
      await this.useComponent(pathOrObject);
    } else {
      if (this.components[pathOrObject.name]) {
        console.log(
          `Component "${pathOrObject.name}" already registered; skipping.`
        );
        return;
      }
      this.components[pathOrObject.name] = pathOrObject;
    }
  }

  async useComponent(path) {
    const response = await fetch(path);
    const htmlContent = await response.text();
    const component = this.parseComponent(
      htmlContent.replace(/<!--.*?-->/gs, ""), // Remove comments
      path
        .split("/")
        .pop()
        .replace(/\.html$/, "")
    );
    this.components[component.name] = component;
  }

  parseComponent(htmlContent, name) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const templateElement = doc.querySelector("template");
    const scriptElement = doc.querySelector("script:not([type]):not([src])");
    const styleElement = doc.querySelector("style");

    if (!templateElement || !scriptElement) {
      console.log(
        `Template or script not found in component "${name}"; using legacy parser.`
      );
      return this.parseLegacy(htmlContent, name);
    }

    // Extract and process script
    const scriptContent = scriptElement.textContent;
    const componentOptions = this.parseScript(scriptContent);

    let processedTemplate = templateElement.innerHTML;

    const isScoped = styleElement?.hasAttribute("scoped");
    const styleContent = styleElement?.textContent;

    if (styleContent) {
      if (isScoped) {
        const style = document.createElement("style");

        const uniqueId = Math.random().toString(36).substring(2, 8);
        processedTemplate = this.scopeTemplate(processedTemplate, uniqueId);
        style.textContent = this.scopeCSS(styleContent, uniqueId);

        style.setAttribute("scoped", "");
        document.head.appendChild(style);
      } else {
        document.head.appendChild(document.createElement("style")).textContent =
          styleContent;
      }
    }

    return {
      ...componentOptions,
      template: processedTemplate,
    };
  }

  parseScript(scriptContent) {
    const modifiedScript = scriptContent
      .replace(/export\s+default/, "return ")
      .replace(/import.*?from.*?;?/g, ""); // Remove imports

    try {
      return new Function(modifiedScript)();
    } catch (error) {
      throw new Error(`Error parsing component script: ${error}`);
    }
  }

  parseLegacy(htmlContent, name) {
    try {
      let template = htmlContent;

      const propMatches = [...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)];
      const propKeys = [...new Set(propMatches.map((match) => match[1]))];

      // Extract event bindings (e.g., @click="increment", @input="update")
      const methodMatches = [...template.matchAll(/\@(\w+)\s*=\s*\"(\w+)\"/g)];
      const emits = [];

      // Replace event bindings with $emit calls
      methodMatches.forEach((match) => {
        let [fullMatch, eventType, methodName] = match;
        template = template.replace(
          fullMatch,
          `@${eventType}="() => $emit('${methodName}')"`
        );
        emits.push(methodName);
      });

      return {
        name,
        template,
        props: propKeys,
        emits: [...new Set(emits)],
      };
    } catch (error) {
      console.error(this.message, error);
    }
  }

  scopeTemplate(templateContent, uniqueId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateContent, "text/html");
    const rootElements = doc.body.children;

    if (rootElements.length === 0) {
      return templateContent;
    }

    Array.from(rootElements).forEach((root) => {
      root.setAttribute(`data-v-${uniqueId}`, "");

      const descendants = root.getElementsByTagName("*");
      Array.from(descendants).forEach((descendant) => {
        descendant.setAttribute(`data-v-${uniqueId}`, "");
      });
    });

    return doc.body.innerHTML;
  }

  scopeCSS(styleContent, uniqueId) {
    const identifier = `[data-v-${uniqueId}]`;

    const rules = styleContent
      .split("}")
      .map((rule) => rule.trim())
      .filter((rule) => rule.length > 0);

    const scopedRules = rules.map((rule) => {
      const [selectorPart, declaration] = rule
        .split("{")
        .map((part) => part.trim());
      const scopedSelector = this.scopeSelector(selectorPart, identifier);
      return `${scopedSelector} { ${declaration} }`;
    });

    return scopedRules.join("\n");
  }

  scopeSelector(selector, identifier) {
    // Split selector by combinators (space, >, +, ~), preserving them
    const parts = selector.split(/(\s+|[>+~])/);

    const scopedParts = parts.map((part) => {
      if (part.trim() && !/^\s+|[>+~]$/.test(part)) {
        return `${part}${identifier}`;
      }
      return part;
    });

    return scopedParts.join("");
  }
}
