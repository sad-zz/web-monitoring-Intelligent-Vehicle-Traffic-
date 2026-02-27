/**
 * PM2 ecosystem config — TC Manager
 * Usage:
 *   First time:    pm2 start ecosystem.config.js
 *   Update/Restart: pm2 restart tc-manager --update-env
 */
module.exports = {
    apps: [{
        name: "tc-manager",
        script: "server/index.js",
        cwd: "/opt/tc-manager",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "300M",
        restart_delay: 3000,
        min_uptime: 3000,
        kill_timeout: 6000,
        env: {
            NODE_ENV: "production",
            TZ: "Asia/Tehran"
        }
    }]
};
