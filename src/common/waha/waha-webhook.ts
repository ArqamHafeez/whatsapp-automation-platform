export type WahaWebhookConfig = {
  url: string;
  events: string[];
};

export function getWahaWebhookConfig(): WahaWebhookConfig | null {
  const webhookPublicUrl = process.env.WEBHOOK_PUBLIC_URL?.trim();
  if (!webhookPublicUrl) {
    return null;
  }
  return {
    url: `${webhookPublicUrl.replace(/\/$/, '')}/webhook/waha`,
    events: ['message', 'message.any'],
  };
}

/** Session config block for NOWEB store + inbound webhooks. */
export function wahaSessionConfig(webhook?: WahaWebhookConfig | null): Record<string, unknown> {
  const config: Record<string, unknown> = {
    noweb: {
      store: {
        enabled: true,
        fullSync: true,
      },
    },
  };

  if (webhook) {
    config.webhooks = [
      {
        url: webhook.url,
        events: webhook.events,
      },
    ];
  }

  return config;
}
