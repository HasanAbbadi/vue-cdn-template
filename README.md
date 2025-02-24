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
...
import VueCDNParser from "./parser.js";
const parser = new VueCDNParser();
...
await parser.use("/src/components/counter.html");
...
</script>
```

## Quick Start

```bash
git clone https://github.com/HasanAbbadi/vue-cdn-template
python -m http.server  # or: npx http-server
```

## Limitations

Being a hacky solution, it has some limitations (for now):

- ~~No nested components~~ (fixed using imports)
- No imports in components (other than nested components)
- ~~No scoped styles~~ (fixed)
- ~~No slots~~ (already exists :P)

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
