export const config = {
  ipHashSalt: process.env.IP_HASH_SALT || 'default-ip-salt',
  dailyIdSalt: process.env.DAILY_ID_SALT || 'default-daily-salt',
  tripSalt: process.env.TRIP_SALT || 'default-trip-salt',
  queueUrl: process.env.QUEUE_URL || '',
};
