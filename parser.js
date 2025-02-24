export default class VueCDNParser {
  constructor() {
    this.components = {};
    this.nestedComponents = [];
  }

  init(app) {
    Object.entries(this.components).forEach(([name, component]) => {
      app.component(name, component);
    });
  }

  nestComponents(mainComponent) {
    mainComponent.components = this.components;
  }

  async use(pathOrObject) {
    if (typeof pathOrObject === "string") {
      return await this.useComponent(pathOrObject);
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
    const component = await this.parseComponent(
      htmlContent.replace(/<!--.*?-->/gs, ""), // Remove comments
      path
        .split("/")
        .pop()
        .replace(/\.html$/, ""),
      path
    );
    this.components[component.name] = component;
    return component;
  }

  async parseComponent(htmlContent, name, componentPath) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const templateElement = doc.querySelector("template");
    const scriptElement = doc.querySelector("script:not([type]):not([src])");
    const styleElement = doc.querySelector("style");

    if (!templateElement) {
      console.log(
        `Template not found in component "${name}"; using legacy parser.`
      );
      return this.parseLegacy(htmlContent, name);
    }

    // Extract and process script
    let componentOptions = { name };
    if (scriptElement) {
      const scriptContent = scriptElement.textContent;
      componentOptions = await this.parseScript(scriptContent, componentPath);
    }

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

  async parseScript(scriptContent, componentPath) {
    // Extract imports before removing them
    const imports = [];
    const importRegex =
      /import\s+(?:{\s*([^}]+)\s*}|\s*([^{}\s,]+)\s*)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(scriptContent)) !== null) {
      const [, namedImports, defaultImport, path] = match;
      imports.push({
        names: namedImports ? namedImports.split(",").map((s) => s.trim()) : [],
        default: defaultImport,
        path,
      });
    }

    const componentParser = new VueCDNParser();
    // Process imports as components
    for (const imp of imports) {
      if (imp.path.endsWith(".html")) {
        const componentDir = componentPath.split("/").slice(0, -1).join("/");

        let resolvedPath;
        if (imp.path.startsWith("./") || imp.path.startsWith("../")) {
          resolvedPath = this.resolvePath(componentDir + "/" + imp.path);
        } else if (imp.path.startsWith("/")) {
          resolvedPath = imp.path.slice(1);
        } else {
          resolvedPath = imp.path;
        }

        const nestedComponent = await componentParser.use(resolvedPath);
        this.nestedComponents.push(nestedComponent.name.toLowerCase());
      }
    }

    const modifiedScript = scriptContent
      .replace(/export\s+default/, "return ")
      .replace(/import.*?from.*?;?/g, ""); // Remove imports

    try {
      const component = new Function(modifiedScript)();
      componentParser.nestComponents(component);
      return component;
    } catch (error) {
      throw new Error(`Error parsing component script: ${error}`);
    }
  }

  resolvePath(path) {
    // Split the path into segments
    const segments = path.split("/");
    const resolvedSegments = [];

    for (const segment of segments) {
      if (segment === "..") {
        resolvedSegments.pop();
      } else if (segment !== "." && segment !== "") {
        resolvedSegments.push(segment);
      }
    }

    return resolvedSegments.join("/");
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
      this.setAttribute(root, uniqueId);
      const descendants = root.getElementsByTagName("*");
      Array.from(descendants).forEach((descendant) => {
        this.setAttribute(descendant, uniqueId);
      });
    });

    return doc.body.innerHTML;
  }

  setAttribute(element, uniqueId) {
    if (!this.nestedComponents.includes(element.tagName.toLowerCase())) {
      element.setAttribute(`data-v-${uniqueId}`, "");
    }
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
