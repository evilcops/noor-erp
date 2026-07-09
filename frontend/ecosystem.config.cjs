/** PM2 — run from frontend/: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "noor-erp",
      cwd: ".next/standalone",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
