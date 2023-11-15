/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable camelcase */
require("dotenv").config();

const args = [];
if (process.env.WSS_BRIDGE_SSL_KEY) {
  args.push("--ssl-key", process.env.WSS_BRIDGE_SSL_KEY);

  if (process.env.WSS_BRIDGE_SSL_CERT) {
    args.push("--ssl-cert", process.env.WSS_BRIDGE_SSL_CERT);
  }
}

module.exports = {
  apps: [
    {
      name: `${(process.env.BRANCH_NAME || "unknown")}.wss-bridge`,
      script: "api/index.js",
      ...(args.length > 0 && {
        args: args.join(" "),
      }),
      env_develop: {
        SERVER_PORT: "15200",
        DEBUG: "*"
      },
      env_main: {
        SERVER_PORT: "5200",
        DEBUG: "(http|ws)*"
      },
    },
  ],
};
