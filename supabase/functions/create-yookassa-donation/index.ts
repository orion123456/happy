import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateDonationBody {
  campaignId?: string;
  amount?: string | number;
  returnUrl?: string;
}

interface DonationCampaignRow {
  id: string;
  title: string;
  currency: string;
  is_active: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function parseAmount(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value.replace(',', '.'));
  }

  return Number.NaN;
}

function getBasicAuthHeader(shopId: string, secretKey: string): string {
  return `Basic ${btoa(`${shopId}:${secretKey}`)}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const yookassaShopId = Deno.env.get('YOOKASSA_SHOP_ID');
  const yookassaSecretKey = Deno.env.get('YOOKASSA_SECRET_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Не заданы переменные Supabase для Edge Function.' }, 500);
  }

  if (!yookassaShopId || !yookassaSecretKey) {
    return jsonResponse({ error: 'Не заданы секреты ЮKassa для тестового режима.' }, 500);
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse({ error: 'Пользователь не авторизован.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Не удалось определить текущего пользователя.' }, 401);
    }

    const { campaignId, amount, returnUrl } = (await request.json()) as CreateDonationBody;
    const parsedAmount = parseAmount(amount);

    if (!campaignId || typeof campaignId !== 'string') {
      return jsonResponse({ error: 'Не передан идентификатор сбора.' }, 400);
    }

    if (!returnUrl || typeof returnUrl !== 'string') {
      return jsonResponse({ error: 'Не передан return URL.' }, 400);
    }

    try {
      new URL(returnUrl);
    } catch {
      return jsonResponse({ error: 'Передан некорректный return URL.' }, 400);
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return jsonResponse({ error: 'Сумма платежа должна быть больше нуля.' }, 400);
    }

    const { data: campaign, error: campaignError } = await adminClient
      .from('donation_campaigns')
      .select('id, title, currency, is_active')
      .eq('id', campaignId)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      return jsonResponse({ error: 'Активный сбор не найден.' }, 404);
    }

    const activeCampaign = campaign as DonationCampaignRow;
    const paymentResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(yookassaShopId, yookassaSecretKey),
        'Content-Type': 'application/json',
        'Idempotence-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: {
          value: parsedAmount.toFixed(2),
          currency: activeCampaign.currency || 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: returnUrl,
        },
        description: `Сбор на подарок: ${activeCampaign.title}`,
        metadata: {
          campaign_id: activeCampaign.id,
          user_id: user.id,
        },
      }),
    });

    const paymentPayload = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return jsonResponse(
        {
          error:
            typeof paymentPayload?.description === 'string'
              ? paymentPayload.description
              : 'ЮKassa не приняла запрос на создание платежа.',
        },
        502
      );
    }

    const providerPaymentId = typeof paymentPayload.id === 'string' ? paymentPayload.id : '';
    const confirmationUrl =
      typeof paymentPayload?.confirmation?.confirmation_url === 'string'
        ? paymentPayload.confirmation.confirmation_url
        : '';
    const paymentStatus = typeof paymentPayload.status === 'string' ? paymentPayload.status : 'pending';

    if (!providerPaymentId || !confirmationUrl) {
      return jsonResponse({ error: 'ЮKassa вернула неполный ответ для redirect-платежа.' }, 502);
    }

    const { error: insertError } = await adminClient.from('donation_payments').insert({
      campaign_id: activeCampaign.id,
      user_id: user.id,
      provider: 'yookassa',
      provider_payment_id: providerPaymentId,
      amount: parsedAmount.toFixed(2),
      currency: activeCampaign.currency || 'RUB',
      status: paymentStatus,
      confirmation_url: confirmationUrl,
      return_url: returnUrl,
      paid_at: paymentStatus === 'succeeded' ? new Date().toISOString() : null,
      metadata: {
        yookassa_status: paymentStatus,
      },
    });

    if (insertError) {
      return jsonResponse({ error: 'Не удалось сохранить созданный платёж в базе.' }, 500);
    }

    return jsonResponse({
      confirmationUrl,
      paymentId: providerPaymentId,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Не удалось создать платёж ЮKassa.',
      },
      500
    );
  }
});
