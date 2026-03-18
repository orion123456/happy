import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PaymentRow {
  id: string;
  provider_payment_id: string;
  status: string;
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

    const { data: pendingPayments, error: pendingError } = await adminClient
      .from('donation_payments')
      .select('id, provider_payment_id, status')
      .in('status', ['pending', 'waiting_for_capture'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (pendingError) {
      return jsonResponse({ error: 'Не удалось загрузить ожидающие платежи.' }, 500);
    }

    const payments = (pendingPayments ?? []) as PaymentRow[];
    let updatedCount = 0;

    for (const payment of payments) {
      const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.provider_payment_id}`, {
        method: 'GET',
        headers: {
          Authorization: getBasicAuthHeader(yookassaShopId, yookassaSecretKey),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const nextStatus = typeof payload?.status === 'string' ? payload.status : payment.status;

      if (nextStatus === payment.status) {
        continue;
      }

      const { error: updateError } = await adminClient
        .from('donation_payments')
        .update({
          status: nextStatus,
          paid_at: nextStatus === 'succeeded' ? new Date().toISOString() : null,
          metadata: {
            yookassa_status: nextStatus,
          },
        })
        .eq('id', payment.id);

      if (!updateError) {
        updatedCount += 1;
      }
    }

    return jsonResponse({ updatedCount });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Не удалось обновить статусы платежей.',
      },
      500
    );
  }
});
