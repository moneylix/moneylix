// Temporary diagnostic - runs automatically before `npm run build` (npm's
// prebuild lifecycle hook) to show exactly what the build container's
// filesystem contains for the paths Render's build has been failing to
// resolve. Remove once the Render deploy issue is fixed.
const fs = require('fs')
const path = require('path')

console.log('=== RENDER-DEBUG START ===')
console.log('cwd:', process.cwd())
console.log('__dirname:', __dirname)
console.log('node version:', process.version)
console.log('platform:', process.platform)

const targets = [
  'src/components/ui/Button.tsx',
  'src/components/ui/Input.tsx',
  'src/components/ui/Badge.tsx',
  'src/lib/utils/format.ts',
  'tsconfig.json',
  'next.config.js',
]

for (const t of targets) {
  const full = path.join(process.cwd(), t)
  const exists = fs.existsSync(full)
  console.log(`exists(${t}):`, exists)
  if (exists) {
    const stat = fs.statSync(full)
    console.log(`  size: ${stat.size}, mode: ${stat.mode.toString(8)}`)
  }
}

console.log('--- ls src/components/ui/ ---')
try {
  console.log(fs.readdirSync(path.join(process.cwd(), 'src/components/ui')).sort().join('\n'))
} catch (e) {
  console.log('ERROR reading dir:', e.message)
}

console.log('--- ls src/lib/utils/ ---')
try {
  console.log(fs.readdirSync(path.join(process.cwd(), 'src/lib/utils')).sort().join('\n'))
} catch (e) {
  console.log('ERROR reading dir:', e.message)
}

console.log('--- tsconfig.json paths field ---')
try {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tsconfig.json'), 'utf8'))
  console.log(JSON.stringify(tsconfig.compilerOptions.paths))
} catch (e) {
  console.log('ERROR reading tsconfig:', e.message)
}

console.log('--- attempting require.resolve on the failing paths ---')
for (const t of ['./src/components/ui/Button.tsx', './src/lib/utils/format.ts']) {
  try {
    require.resolve(path.join(process.cwd(), t))
    console.log(`require.resolve OK: ${t}`)
  } catch (e) {
    console.log(`require.resolve FAILED: ${t} -- ${e.message}`)
  }
}

console.log('=== RENDER-DEBUG END ===')
