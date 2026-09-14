import { defineTool } from '@deepseek-ai/dsh-tools'
import { normalizeCampusSearchRequest, resolveCampusSearchConfig, searchCampus } from './core.js'

export const name = 'tool-ecnu-campus-search'
export const inject = ['tools', 'credentials']

async function apiKey(ctx, config) {
  const hit = config.oidcProfileId
    ? await ctx.get?.('oidcAccounts')?.resolveBoundCredential?.(config.oidcProfileId, { credentialRef: config.credentialRef, runtimeBaseURL: config.baseURL })
    : await ctx.credentials.resolve(config.credentialRef)
  if (hit === undefined || typeof hit.value !== 'string' || hit.value.trim().length === 0) {
    throw new Error('ChatECNU is not configured; sign in or add its API key in Model Services')
  }
  return hit.value
}

function boundedSignal(parent, milliseconds) {
  return AbortSignal.any([parent, AbortSignal.timeout(milliseconds)])
}

export function apply(ctx, rawConfig = {}) {
  const config = resolveCampusSearchConfig(rawConfig)
  ctx.tools.register(defineTool({
    name: 'ecnu_campus_search',
    description: 'Search the authenticated ECNU campus index for East China Normal University (华东师范大学/华师大/ECNU) services, departments, policies, people, facilities and news. Use when the request is strongly ECNU-related. Combine with web_search when public or external context and cross-checking are useful; do not use for generic education or research topics.',
    parameters: {
      keyword: { type: 'string', required: true, description: 'Non-empty campus search keywords, up to 512 characters.' },
      page: { type: 'integer', description: 'One-based result page; defaults to 1.' },
      size: { type: 'integer', description: 'Results per page, 1-50; defaults to 10.' },
      cancel_segment: { type: 'boolean', description: 'Disable query segmentation for exact titles, codes or quoted phrases; defaults to false.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true }, query: { type: 'string', required: true },
          page: { type: 'integer', required: true }, size: { type: 'integer', required: true },
          resultCount: { type: 'integer', required: true }, hasMore: { type: 'boolean', required: true },
          trust: { type: 'string', required: true }, resultsJSON: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `<untrusted_ecnu_campus_search_results query=${JSON.stringify(value.query)} page=${value.page} count=${value.resultCount}>\n${value.resultsJSON}\n</untrusted_ecnu_campus_search_results>`,
      }],
    },
    timeoutMs: Math.min(config.requestTimeoutMs + 5_000, 125_000),
    async execute(args, exec) {
      const request = normalizeCampusSearchRequest(args)
      const result = await searchCampus({
        baseURL: config.baseURL,
        apiKey: await apiKey(ctx, config),
        request,
        signal: boundedSignal(exec.signal, config.requestTimeoutMs),
      })
      return {
        id: result.id,
        query: result.query,
        page: request.page,
        size: request.size,
        resultCount: result.results.length,
        hasMore: result.results.length === request.size,
        trust: 'untrusted-institution-search-content',
        resultsJSON: JSON.stringify(result.results),
      }
    },
    presentCall: args => ({ card: 'generic', title: `搜索华东师大 · ${args.keyword ?? ''}`, kind: 'execute' }),
    presentResult: (_args, result) => result.isError ? undefined : ({ card: 'generic', title: '校内搜索结果' }),
  }))
}
