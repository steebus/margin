import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: { deps: { inline: ['convex-test'] } },
    // One worker for every file (about 2 s faster). Stubs are undone after each test so a file can't leak into the next.
    isolate: false,
    unstubGlobals: true,
    unstubEnvs: true,
  },
})
