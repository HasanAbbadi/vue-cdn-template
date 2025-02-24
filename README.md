# Vue CDN Components Template

### Why does this exist?

- Vue cdn doesn't support components, this is a temporary bandaid.
- Useful for quick prototypes / messing around
- No build step, no tooling to waste your time and storage

### Example

```html
<!-- src/components/counter.html -->
<template>
  <span>Hello {{ name }}!</span>
  <button @click="count++">Count is: {{ count }}</button>
</template>

<script>
  export default {
    props: ["name"],
    data: () => ({ count: 0 }),
  };
</script>
```

```js
// index.html

<div id="app">
    <counter name="Mark"></counter>
</div>

<script type="module">
// ...
import VueCDNParser from "./parser.js";
const parser = new VueCDNParser();
// ...
await parser.use("/src/components/counter.html");
// ...
</script>
```

## Quick Start

Clone the template and modify it to your liking:

```bash
git clone https://github.com/HasanAbbadi/vue-cdn-template
python -m http.server  # or: npx http-server
```

or add the script to your import map and use it yourself:

```html
<script type="importmap">
  {
    "imports": {
      // this shouldn't be used in production,
      // but it's fine since this is a prototyping tool
      "parser": "https://cdn.jsdelivr.net/gh/HasanAbbadi/vue-cdn-template/parser.min.js"
    }
  }
</script>
```

## Limitations

Being a hacky solution, it has some limitations (for now):

- No imports in components (other than nested components)
- Scoped styles apply to nested components
- No auto-closing tags
- ~~No nested components~~ (fixed using imports)
- ~~No scoped styles~~ (fixed)
- ~~No slots~~ (already existed :P)

## Default Project Structure

```
├── index.html               # Your app entry
├── src/
│   ├── components/*.html    # Components live here
│   └── css/                 # Your styles
└── parser.js                # What makes it work
```

## Contributing

Got ideas? PRs are appreciated.

## License

MIT
