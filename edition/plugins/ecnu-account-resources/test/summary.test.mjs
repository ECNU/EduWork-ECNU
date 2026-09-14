import test from 'node:test'
import assert from 'node:assert/strict'
import { quotaSummary, remainingPercent } from '../lib/summary.js'
test('quota summary prefers the weekly allowance and excludes expired or disabled packs',()=>{
 const result=quotaSummary({windows:[{type:'fixed_24h',remaining:5,limit:10},{type:'fixed_168h',remaining:92,limit:100}],resourcePacks:[{remaining:82,total:100,status:'active'},{remaining:100,total:100,status:'expired'},{remaining:100,total:100,expiresAt:'2020-01-01'}]},Date.parse('2026-09-10'))
 assert.equal(result.windowPercent,92);assert.equal(result.poolPercent,82)
})
test('unknown denominators never become a fabricated percentage',()=>{
 assert.equal(quotaSummary({resourcePacks:[{remaining:7,total:null}]}).poolPercent,null)
 assert.equal(quotaSummary({resourcePacks:[]}).poolRemaining,null)
 assert.equal(remainingPercent(null,100),null)
 assert.equal(remainingPercent(5,0),null)
})
