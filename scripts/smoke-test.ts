import { readOutputs, stackOutput } from './lib/project.js'

const stage = process.argv[2] ?? 'dev'
const outputs = readOutputs(stage)
const webUrl = stackOutput(outputs, '-Web', 'WebUrl')
const checks = [webUrl, `${webUrl}/runtime-config.json`]
for (const url of checks) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url} respondió ${response.status}`)
  console.log(`OK ${response.status} ${url}`)
}
console.log('La superficie pública responde. Las APIs protegidas se prueban desde el frontend con un JWT de Cognito.')
