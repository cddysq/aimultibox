/**
 * 生成前端日志数据（changelog.json）
 *
 * 规则：
 * - 版本头：## [x.y.z] - YYYY-MM-DD
 * - 类型行：Type: major|minor|patch
 * - 分段：### Added / Improved / Fixed
 * - 列表：- item
 */
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(process.cwd())
const changelogDir = path.join(rootDir, 'changelog')
const outputDir = path.join(rootDir, 'frontend', 'public', 'changelog')

const changelogFiles = fs.existsSync(changelogDir)
  ? fs.readdirSync(changelogDir).filter((file) => /^CHANGELOG\.[a-zA-Z-]+\.md$/.test(file))
  : []

const mapSectionToType = (section) => {
  if (section === 'Added') return 'feature'
  if (section === 'Improved') return 'improve'
  if (section === 'Fixed') return 'fix'
  return 'improve'
}

const buildEntries = (content) => {
  const lines = content.split(/\r?\n/)
  const entries = []
  let current = null
  let currentSection = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const versionMatch = /^## \[(.+?)\] - (\d{4}-\d{2}-\d{2})$/.exec(line)
    if (versionMatch) {
      if (current) entries.push(current)
      current = {
        version: versionMatch[1],
        date: versionMatch[2],
        type: 'patch',
        title: `v${versionMatch[1]}`,
        changes: [],
      }
      currentSection = null
      continue
    }

    const typeMatch = /^Type:\s*(major|minor|patch)$/i.exec(line)
    if (typeMatch && current) {
      current.type = typeMatch[1].toLowerCase()
      continue
    }

    const sectionMatch = /^###\s+(Added|Improved|Fixed)$/i.exec(line)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      continue
    }

    const itemMatch = /^-\s+(.+)$/.exec(line)
    if (itemMatch && current && currentSection) {
      current.changes.push({
        type: mapSectionToType(currentSection),
        text: itemMatch[1],
      })
    }
  }

  if (current) entries.push(current)
  return entries
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

for (const file of changelogFiles) {
  const match = /^CHANGELOG\.([a-zA-Z-]+)\.md$/.exec(file)
  if (!match) continue
  const langCode = match[1].toLowerCase()
  const changelogPath = path.join(changelogDir, file)
  const outputPath = path.join(outputDir, `${langCode}.json`)
  const content = fs.readFileSync(changelogPath, 'utf-8')
  const data = { entries: buildEntries(content) }
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Changelog generated: ${outputPath}`)
}
