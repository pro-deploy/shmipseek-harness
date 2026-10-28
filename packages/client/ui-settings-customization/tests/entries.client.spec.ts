/** Text-control conversions and mcpServers JSON import for the customization pages. */

import { describe, expect, it } from 'vitest'
import {
  emptyServer, importMcpServers, linesOf, listOf, mergeServers, pairsOf, pairsText, serverNameValid, skillNameValid,
} from '../src/client/entries.ts'
import { settingsListField } from '../src/client/controllers.ts'

describe('customization entries', () => {
  it('reads lines and pairs, and writes pairs back', () => {
    expect(linesOf(' -y \n\n @scope/server \n')).toEqual(['-y', '@scope/server'])
    expect(pairsOf('TOKEN=abc=def\nbroken\n=x\nMODE = fast', '=')).toEqual({ TOKEN: 'abc=def', MODE: 'fast' })
    expect(pairsOf('Authorization: Bearer x:y', ':')).toEqual({ Authorization: 'Bearer x:y' })
    expect(pairsText({ A: '1' }, '=')).toBe('A=1')
    expect(pairsText({ A: '1' }, ':')).toBe('A: 1')
  })

  it('imports the wrapper and the bare map, and rejects anything else', () => {
    expect(importMcpServers('{"mcpServers": {"files": {"command": "npx", "args": ["-y", "server-files", 3], "env": {"K": "v", "N": 1}}, "web": {"url": "http://127.0.0.1:3000/mcp", "headers": {"A": "b"}, "disabled": true}}}'))
      .toEqual([
        { ...emptyServer(), name: 'files', command: 'npx', args: ['-y', 'server-files'], env: { K: 'v' } },
        { ...emptyServer(), name: 'web', transport: 'streamable-http', url: 'http://127.0.0.1:3000/mcp', headers: { A: 'b' }, enabled: false },
      ])
    expect(importMcpServers('{"files": {"command": "uvx"}}')).toEqual([{ ...emptyServer(), name: 'files', command: 'uvx' }])
    for (const text of ['not json', '[]', '{}', '{"x": 1}', '{"x": {"args": []}}']) expect(importMcpServers(text)).toBeUndefined()
  })

  it('merges imported servers by name and validates names', () => {
    const a = { ...emptyServer(), name: 'a', command: 'one' }
    const b = { ...emptyServer(), name: 'b', command: 'two' }
    expect(mergeServers([a, b], [{ ...a, command: 'three' }, { ...b, name: 'c' }]).map(server => [server.name, server.command]))
      .toEqual([['a', 'three'], ['b', 'two'], ['c', 'two']])
    expect([serverNameValid([a, a], 0), serverNameValid([a, a], 1), serverNameValid([{ ...a, name: 'bad name' }], 0)]).toEqual([true, false, false])
    const skill = { name: 'code-review', enabled: true, description: 'd', content: '' }
    expect([skillNameValid([skill], 0), skillNameValid([{ ...skill, name: 'Code' }], 0), skillNameValid([skill, skill], 1)]).toEqual([true, false, false])
  })

  it('stages lists as JSON and refuses a draft that is not a list', () => {
    const spec = settingsListField('servers')
    expect(spec.format(undefined)).toBe('[]')
    expect(spec.parse('[{"name":"a"}]')).toEqual({ kind: 'set', value: [{ name: 'a' }] })
    expect(spec.parse('{}')).toBeUndefined()
    expect(spec.parse('nope')).toBeUndefined()
    expect(listOf('nope')).toEqual([])
  })
})
