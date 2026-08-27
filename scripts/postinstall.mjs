/**
 * Friendly post-install check. Never fails the install — it only nudges.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const notes = []

if (!existsSync(join(root, '.env.local')) && !existsSync(join(root, '.env'))) {
  notes.push('cp .env.example .env.local            # frontend config')
}

if (existsSync(join(root, 'backend')) && !existsSync(join(root, 'backend', '.env'))) {
  notes.push('cp backend/.env.example backend/.env  # API + database config')
}

if (notes.length > 0) {
  console.log('\n  InventoryFlow — next steps:\n')
  for (const note of notes) console.log(`    ${note}`)
  console.log('')
}
