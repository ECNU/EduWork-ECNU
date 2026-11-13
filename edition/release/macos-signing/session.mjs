import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes, X509Certificate } from 'node:crypto'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { validateContext, validateCertificate } from './policy.mjs'
const exec = promisify(execFile)

export async function signingSession({policy, work, report, env = process.env}) {
  validateContext({...env, NOTARIZE_PROBE: 'true'}, policy)
  const names = ['ECNU_MACOS_CERTIFICATE_P12','ECNU_MACOS_CERTIFICATE_PASSWORD','ECNU_APPLE_ID','ECNU_APPLE_APP_PASSWORD']
  for (const name of names) assert(env[name], `${name} missing`)
  const password = randomBytes(48).toString('base64url')
  const redactions = [...names.map(name => env[name]), password]
  const keychain = join(work, 'signing.keychain-db'), profile = 'ecnu-signing'
  let original, created = false
  async function command(label, executable, args, options = {}) {
    report.stage = label
    console.log(label)
    try { return await exec(executable, args, {maxBuffer: 8*1024*1024, ...options}) }
    catch (error) {
      let detail = String(error.stderr ?? '')
      for (const value of redactions) detail = detail.replaceAll(value, '[REDACTED]')
      throw new Error(`${label} failed (${typeof error.code === 'number' ? error.code : 'process'}): ${detail.slice(-5000)}`)
    }
  }
  async function cleanup() {
    let error
    if (original) try { await exec('/usr/bin/security', ['list-keychains','-d','user','-s',...original]) } catch { error = true }
    if (created) try { await exec('/usr/bin/security', ['delete-keychain',keychain]) } catch { error = true }
    await rm(work,{recursive:true,force:true})
    for (const name of names) delete env[name]
    report.credentialsCleanup = !error
    assert(!error, 'Temporary keychain cleanup failed')
  }
  try {
    await mkdir(work,{recursive:false,mode:0o700})
    const p12 = join(work,'identity.p12')
    await writeFile(p12,Buffer.from(env.ECNU_MACOS_CERTIFICATE_P12,'base64'),{mode:0o600})
    const {stdout:pem} = await command('Inspect certificate','/usr/bin/openssl',['pkcs12','-in',p12,'-clcerts','-nokeys','-passin','env:ECNU_MACOS_CERTIFICATE_PASSWORD'])
    const identity = validateCertificate(pem,policy)
    original = [...(await command('Read keychain list','/usr/bin/security',['list-keychains','-d','user'])).stdout.matchAll(/"([^"\n]+)"/g)].map(match=>match[1])
    assert(original.length)
    await command('Create signing keychain','/usr/bin/security',['create-keychain','-p',password,keychain]); created=true
    await command('Configure keychain','/usr/bin/security',['set-keychain-settings','-lut','21600',keychain])
    await command('Unlock keychain','/usr/bin/security',['unlock-keychain','-p',password,keychain])
    await command('Import signing identity','/usr/bin/security',['import',p12,'-k',keychain,'-P',env.ECNU_MACOS_CERTIFICATE_PASSWORD,'-T','/usr/bin/codesign','-T','/usr/bin/security'])
    await command('Set signing access','/usr/bin/security',['set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',password,keychain])
    await command('Set keychain search','/usr/bin/security',['list-keychains','-d','user','-s',keychain,...original])
    await rm(p12)
    delete env.ECNU_MACOS_CERTIFICATE_P12; delete env.ECNU_MACOS_CERTIFICATE_PASSWORD
    let valid = await command('Verify signing trust','/usr/bin/security',['find-identity','-v','-p','codesigning',keychain])
    if (!valid.stdout.includes(identity)) {
      const response = await fetch('https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer',{redirect:'error'})
      assert(response.ok)
      const der=Buffer.from(await response.arrayBuffer());assert(der.length<65536)
      const ca=new X509Certificate(der),leaf=new X509Certificate(pem)
      assert(ca.ca&&leaf.checkIssued(ca)&&leaf.verify(ca.publicKey))
      const file=join(work,'DeveloperIDG2CA.cer');await writeFile(file,der,{mode:0o600})
      await command('Import Apple intermediate','/usr/bin/security',['import',file,'-k',keychain])
      valid=await command('Verify completed signing chain','/usr/bin/security',['find-identity','-v','-p','codesigning',keychain])
    }
    assert(valid.stdout.includes(identity))
    await command('Validate Apple notarization credentials','/usr/bin/xcrun',['notarytool','store-credentials',profile,'--apple-id',env.ECNU_APPLE_ID,'--team-id',policy.teamId,'--password',env.ECNU_APPLE_APP_PASSWORD,'--keychain',keychain,'--validate'])
    delete env.ECNU_APPLE_ID;delete env.ECNU_APPLE_APP_PASSWORD
    return {identity,keychain,profile,command,cleanup}
  } catch(error) { await cleanup();throw error }
}
