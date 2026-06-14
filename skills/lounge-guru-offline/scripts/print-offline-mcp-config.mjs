const config = {
  mcpServers: {
    'lounge-guru-offline': {
      command: 'node',
      args: ['skills/lounge-guru-offline/scripts/run-offline-mcp.mjs'],
      cwd: process.cwd(),
    },
  },
};

console.log(JSON.stringify(config, null, 2));
