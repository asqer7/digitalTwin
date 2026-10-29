// Copies runtime libraries into src/vendor so the packaged app has no node_modules dependency.
// electron-builder drops "examples" folders from node_modules, which is where three.js keeps its addons.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'src', 'vendor');
const nm = (...p) => path.join(root, 'node_modules', ...p);

fs.rmSync(out, { recursive: true, force: true });
const copy = (from, to) => fs.cpSync(from, path.join(out, to), { recursive: true });

copy(nm('three', 'build', 'three.module.js'), 'three/three.module.js');
if (fs.existsSync(nm('three', 'build', 'three.core.js'))) copy(nm('three', 'build', 'three.core.js'), 'three/three.core.js');
for (const dir of ['controls', 'postprocessing', 'shaders']) copy(nm('three', 'examples', 'jsm', dir), `three/addons/${dir}`);
for (const font of ['manrope', 'jetbrains-mono']) {
  const src = nm('@fontsource-variable', font);
  copy(path.join(src, 'index.css'), `fonts/${font}/index.css`);
  copy(path.join(src, 'files'), `fonts/${font}/files`);
}
console.log('vendor ready');
