module.exports = {
  apps: [
    {
      name: 'zong-reverse-flow',
      script: './dist/index.js',
      instances: 'max', // Uses all available CPU cores in cluster mode
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8089,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
