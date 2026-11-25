import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8089', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3308/zong_sub_unsub',
  expectedServiceId: process.env.EXPECTED_SERVICE_ID || '1',
  allowedChannels: (process.env.ALLOWED_CHANNELS || '18,19').split(',').map((c) => c.trim()),
};
