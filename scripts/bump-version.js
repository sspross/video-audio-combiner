#!/usr/bin/env node

/**
 * Version bump script for Video Audio Combiner
 *
 * Usage:
 *   node scripts/bump-version.js [patch|minor|major|X.Y.Z]
 *
 * Examples:
 *   node scripts/bump-version.js patch  # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.js minor  # 0.1.0 -> 0.2.0
 *   node scripts/bump-version.js major  # 0.1.0 -> 1.0.0
 *   node scripts/bump-version.js 2.0.0  # Set explicit version
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.join(__dirname, '..')
const FRONTEND_PACKAGE_JSON = path.join(ROOT_DIR, 'frontend', 'package.json')
const BACKEND_PYPROJECT_TOML = path.join(ROOT_DIR, 'backend', 'pyproject.toml')

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  }
}

function bumpVersion(currentVersion, bumpType) {
  const { major, minor, patch } = parseVersion(currentVersion)

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      // Assume it's an explicit version
      parseVersion(bumpType) // Validate format
      return bumpType
  }
}

function updateFrontendPackageJson(newVersion) {
  const content = fs.readFileSync(FRONTEND_PACKAGE_JSON, 'utf-8')
  const pkg = JSON.parse(content)
  const oldVersion = pkg.version
  pkg.version = newVersion
  fs.writeFileSync(FRONTEND_PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`Updated frontend/package.json: ${oldVersion} -> ${newVersion}`)
  return oldVersion
}

function updateBackendPyprojectToml(newVersion) {
  let content = fs.readFileSync(BACKEND_PYPROJECT_TOML, 'utf-8')
  const oldVersionMatch = content.match(/version\s*=\s*"([^"]+)"/)
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown'
  content = content.replace(/version\s*=\s*"[^"]+"/, `version = "${newVersion}"`)
  fs.writeFileSync(BACKEND_PYPROJECT_TOML, content)
  console.log(`Updated backend/pyproject.toml: ${oldVersion} -> ${newVersion}`)
}

function main() {
  const args = process.argv.slice(2)

  if (args.length !== 1) {
    console.error('Usage: node scripts/bump-version.js [patch|minor|major|X.Y.Z]')
    process.exit(1)
  }

  const bumpType = args[0]

  // Read current version from frontend package.json
  const pkg = JSON.parse(fs.readFileSync(FRONTEND_PACKAGE_JSON, 'utf-8'))
  const currentVersion = pkg.version

  // Calculate new version
  let newVersion
  try {
    newVersion = bumpVersion(currentVersion, bumpType)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }

  console.log(`\nBumping version: ${currentVersion} -> ${newVersion}\n`)

  // Update files
  updateFrontendPackageJson(newVersion)
  updateBackendPyprojectToml(newVersion)

  console.log(`
Next steps:
1. Update CHANGELOG.md with release notes
2. git add -A
3. git commit -m "Release v${newVersion}"
4. git tag v${newVersion}
5. git push origin main --tags
`)
}

main()
