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

    // // Process template and events
    // const { processedTemplate, emits } = this.processTemplate(
    //   templateElement.innerHTML,
    //   componentOptions.methods || {}
    // );

    const processedTemplate = templateElement.innerHTML;

    const styleContent = styleElement?.textContent;
    if (styleContent) {
      document.head.appendChild(document.createElement("style")).textContent =
        styleContent;
    }

    return {
      ...componentOptions,
      template: processedTemplate,
      // emits: Array.from(emits),
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

  // processTemplate(templateContent, methods) {
  //   const methodNames = new Set(Object.keys(methods));
  //   const emits = new Set();
  //   const eventRegex = /@([\w-]+)=["']([^"']*)["']/g;

  //   const processedTemplate = templateContent.replace(
  //     eventRegex,
  //     (match, event, expr) => {
  //       if (/^[a-zA-Z_$][\w$]*$/.test(expr) && !methodNames.has(expr)) {
  //         emits.add(expr);
  //         return `@${event}="$emit('${expr}')"`;
  //       }
  //       return match;
  //     }
  //   );

  //   return { processedTemplate, emits };
  // }
}
