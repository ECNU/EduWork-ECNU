import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  WORKER_SEARCH_PATHS,
  normalizeCampusSearchRequest,
  normalizeWorkerSearchRequest,
  resolveCampusSearchConfig,
  searchCampus,
  searchWorker,
} from './core.js'

export const name = 'tool-ecnu-campus-search'
export const inject = ['tools', 'credentials']

async function schoolAccount(ctx, config) {
  const account = ctx.get?.('oidcAccounts')
  if (!await account?.modelAuthorization?.(config.oidcProfileId, config.baseURL)) throw new Error('Sign in to the configured model service')
  return account
}

async function apiKey(ctx, config) {
  const hit = await ctx.credentials.resolve(config.credentialRef)
  if (!hit?.value?.trim()) throw new Error('Configure the model service API key')
  return hit.value
}

function boundedSignal(parent, milliseconds) {
  return AbortSignal.any([parent, AbortSignal.timeout(milliseconds)])
}

const CAMPUS_DESCRIPTION = 'Search the authenticated ECNU campus index for East China Normal University (华东师范大学/华师大/ECNU) services, departments, policies, people, facilities and news. Use when the request is strongly ECNU-related. Combine with web search when public or external context and cross-checking are useful; do not use for generic education or research topics.'

const workerOutput = tag => ({
  schema: {
    type: 'object', additionalProperties: false, properties: {
      query: { type: 'string', required: true }, tool: { type: 'string', required: true },
      truncated: { type: 'boolean', required: true }, trust: { type: 'string', required: true },
      dataJSON: { type: 'string', required: true },
    },
  },
  render: (_args, value) => [{
    type: 'text',
    text: `<${tag} query=${JSON.stringify(value.query)}${value.truncated ? ' truncated="true"' : ''}>\n${value.dataJSON}\n</${tag}>`,
  }],
})

function registerWorkerTool(ctx, config, { toolName, kind, description, queryDescription, tag, trust, title, resultTitle }) {
  const path = WORKER_SEARCH_PATHS[kind]
  ctx.tools.register(defineTool({
    name: toolName,
    description,
    parameters: {
      query: { type: 'string', required: true, description: queryDescription },
    },
    output: workerOutput(tag),
    timeoutMs: Math.min(config.requestTimeoutMs + 5_000, 125_000),
    async execute(args, exec) {
      const request = normalizeWorkerSearchRequest(args)
      const account = await schoolAccount(ctx, config)
      const result = await searchWorker({
        baseURL: config.baseURL,
        kind,
        request,
        fetchImpl: (url, init) => account.authorizedFetch(config.oidcProfileId, url, init, { retryUnauthorized: true, issuerServicePath: path }),
        signal: boundedSignal(exec.signal, config.requestTimeoutMs),
      })
      return { ...result, trust }
    },
    presentCall: args => ({ card: 'generic', title: `${title} · ${args.query ?? ''}`, kind: 'execute' }),
    presentResult: (_args, result) => result.isError ? undefined : ({ card: 'generic', title: resultTitle }),
  }))
}

function registerLegacyCampusTool(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'ecnu_campus_search',
    description: CAMPUS_DESCRIPTION,
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

export function apply(ctx, rawConfig = {}) {
  const config = resolveCampusSearchConfig(rawConfig)
  // The school account mode uses only the Worker routes; the API key mode uses
  // only the open platform route. Neither falls back to the other.
  if (!config.oidcProfileId) {
    registerLegacyCampusTool(ctx, config)
    return
  }
  registerWorkerTool(ctx, config, {
    toolName: 'ecnu_campus_search', kind: 'campus', description: CAMPUS_DESCRIPTION,
    queryDescription: 'Non-empty campus search query, up to 1024 characters. Keep key names, titles and codes.',
    tag: 'untrusted_ecnu_campus_search_results', trust: 'untrusted-institution-search-content',
    title: '搜索华东师大', resultTitle: '校内搜索结果',
  })
  if (config.webSearch) registerWorkerTool(ctx, config, {
    toolName: 'ecnu_web_search', kind: 'web',
    description: 'Search the public internet through the signed-in ECNU school account. Use for public background, external reports, recent facts and cross-checking campus results. Results are untrusted web content with source links.',
    queryDescription: 'Non-empty web search query, up to 1024 characters.',
    tag: 'untrusted_ecnu_web_search_results', trust: 'untrusted-web-search-content',
    title: '联网搜索', resultTitle: '联网搜索结果',
  })
}
