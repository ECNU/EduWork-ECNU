import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { PersistentVisionEvidenceStore } from './evidence-store.js'
import {
  VisionEvidenceCache,
  VISION_OBSERVATION_PROMPT,
  VISION_PROMPT_VERSION,
  rewriteProviderMessages,
  resolveVisionConfig,
  understandImage,
} from './vision.js'

export const name = 'provider-vision-fallback'
export const inject = ['enterpriseTransforms', 'attachments', 'credentials']

async function apiKey(ctx, config) {
  const hit = config.oidcProfileId
    ? await ctx.get?.('oidcAccounts')?.resolveBoundCredential?.(config.oidcProfileId, { credentialRef: config.credentialRef, runtimeBaseURL: config.baseURL })
    : await ctx.credentials.resolve(config.credentialRef)
  if (hit === undefined || hit.value.trim().length === 0) {
    throw new Error('ChatECNU is not configured; sign in or add its API key in Model Services')
  }
  return hit.value
}

function timeoutSignal(signal) {
  const timeout = AbortSignal.timeout(180_000)
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout])
}

export function apply(ctx, rawConfig = {}) {
  const config = resolveVisionConfig(rawConfig)
  if (!config.enabled) return
  const cache = new VisionEvidenceCache()
  const evidenceStore = new PersistentVisionEvidenceStore(
    join(resolveDshHome(config.dshHome), 'derived', 'provider-vision-fallback', 'v1'),
    ctx.logger,
  )

  ctx.effect(() => ctx.enterpriseTransforms.register({
    provider: config.provider,
    inputModalities: ['image'],
    // This is deliberately provider-wide.  Model ids change; the native
    // capability declaration is the only source of truth.
    when: ({ inputModalities }) => !inputModalities.includes('image'),
    transform: async options => {
      const messages = await rewriteProviderMessages(options.messages, {
        cache,
        evidenceStore,
        specialistProvider: config.provider,
        specialistModel: config.model,
        promptVersion: VISION_PROMPT_VERSION,
        maxAnalysisTokens: config.maxAnalysisTokens,
        maxEvidenceChars: config.maxEvidenceChars,
        maxRequestEvidenceChars: config.maxRequestEvidenceChars,
        onAnalyzeStart: async ref => {
          const name = typeof ref?.name === 'string' && ref.name.trim().length > 0 ? ref.name.trim() : '图片'
          // DSH user/message events are part of the model-visible surface.
          // Keep operational progress in the log until a dedicated client-only
          // event contract exists; never turn it into a later user instruction.
          ctx.logger?.info?.(`provider-vision-fallback: analyzing ${name} with ${config.model}`)
        },
        readImage: ref => ctx.attachments.readImage(ref, options.signal),
        analyze: async imageBytes => (await understandImage({
          baseURL: config.baseURL,
          apiKey: await apiKey(ctx, config),
          model: config.model,
          prompt: VISION_OBSERVATION_PROMPT,
          imageBytes,
          maxAnalysisTokens: config.maxAnalysisTokens,
          signal: timeoutSignal(options.signal),
        })).analysis,
      })
      return {
        ...options,
        messages,
      }
    },
  }), `provider-vision-fallback: ${config.provider} text-only models`)
}
