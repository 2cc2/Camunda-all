import { spawn } from 'node:child_process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  {
    name: 'camunda-message-demo',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'build-nodejs-project',
      description: 'Type-check the Camunda message demo Node.js project.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: 'describe-message-demo',
      description: 'Describe the requester and responder BPMN flow.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'build-nodejs-project') {
    const output = await runCommand('npm', ['run', 'build'])
    return {
      content: [{ type: 'text', text: output }]
    }
  }

  if (request.params.name === 'describe-message-demo') {
    return {
      content: [
        {
          type: 'text',
          text: [
            'Requester lane: prepare-request -> publish-request-message -> wait response -> handle-response.',
            'Responder lane: prepare-receiver -> wait request -> process-request -> publish-response-message.',
            'Both lanes correlate on businessKey using demo-request-message and demo-response-message.'
          ].join('\n')
        }
      ]
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`)
})

async function runCommand(command: string, args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      env: process.env
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim() || 'Command completed successfully.')
        return
      }

      reject(new Error(`Command failed with code ${code}\n${stderr}`))
    })
  })
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main()