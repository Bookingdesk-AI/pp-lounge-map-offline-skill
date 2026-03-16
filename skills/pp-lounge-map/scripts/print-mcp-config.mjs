const endpoint = process.argv[2] || process.env.PP_LOUNGE_MAP_MCP_URL;

if (!endpoint) {
  console.error('Provide the MCP endpoint URL as an argument or PP_LOUNGE_MAP_MCP_URL.');
  process.exitCode = 1;
} else {
  const url = new URL(endpoint);
  const config = {
    mcpServers: {
      'pp-lounge-map': {
        url: url.toString(),
        transport: 'streamable-http',
      },
    },
  };

  console.log(JSON.stringify(config, null, 2));
}
