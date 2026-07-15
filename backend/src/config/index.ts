import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
let cachedConfig: any = null;

export async function getConfig() {
  if (cachedConfig) return cachedConfig;
  
  const getParam = async (name: string | undefined, defaultVal: string) => {
    if (!name) return defaultVal;
    try {
      const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
      return res.Parameter?.Value || defaultVal;
    } catch (e) {
      console.error(`Failed to get parameter ${name}`, e);
      return defaultVal;
    }
  };

  cachedConfig = {
    ipHashSalt: await getParam(process.env.IP_HASH_SALT_PARAM, 'default-ip-salt'),
    dailyIdSalt: await getParam(process.env.DAILY_ID_SALT_PARAM, 'default-daily-salt'),
    tripSalt: await getParam(process.env.TRIP_SALT_PARAM, 'default-trip-salt'),
    queueUrl: process.env.QUEUE_URL || '',
  };

  return cachedConfig;
}
