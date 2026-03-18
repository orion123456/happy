const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ResolveRequestBody {
  productUrl?: string;
}

interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
}

interface JsonLdProduct {
  '@type'?: string | string[];
  name?: string;
  image?: string | string[];
  offers?: JsonLdOffer | JsonLdOffer[];
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractMetaContent(html: string, propertyName: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${propertyName}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${propertyName}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return '';
}

function extractProductJsonLd(html: string): JsonLdProduct | null {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const rawJson = match[1]?.trim();

    if (!rawJson) {
      continue;
    }

    try {
      const payload = JSON.parse(rawJson) as JsonLdProduct | JsonLdProduct[] | { '@graph'?: JsonLdProduct[] };
      const candidates = Array.isArray(payload)
        ? payload
        : Array.isArray(payload['@graph'])
          ? payload['@graph'] ?? []
          : [payload];

      const product = candidates.find((entry) => {
        const type = entry?.['@type'];

        if (Array.isArray(type)) {
          return type.includes('Product');
        }

        return type === 'Product';
      });

      if (product) {
        return product;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractPriceFromText(html: string): number | null {
  const patterns = [
    /"price"\s*:\s*"?(?<price>\d+(?:[.,]\d+)?)"?/i,
    /"salePrice"\s*:\s*"?(?<price>\d+(?:[.,]\d+)?)"?/i,
    /"salePriceU"\s*:\s*"?(?<price>\d+)"?/i,
    /"priceU"\s*:\s*"?(?<price>\d+)"?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const rawPrice = match?.groups?.price;

    if (!rawPrice) {
      continue;
    }

    const normalizedPrice = Number(rawPrice.replace(',', '.'));

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      continue;
    }

    return normalizedPrice >= 1000 && /PriceU/i.test(pattern.source) ? normalizedPrice / 100 : normalizedPrice;
  }

  return null;
}

function normalizeImage(image: string | string[] | undefined): string {
  if (Array.isArray(image)) {
    return typeof image[0] === 'string' ? image[0] : '';
  }

  return typeof image === 'string' ? image : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const { productUrl } = (await request.json()) as ResolveRequestBody;

    if (!productUrl || typeof productUrl !== 'string') {
      return jsonResponse({ error: 'Не передана ссылка на товар.' }, 400);
    }

    const response = await fetch(productUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        Referer: 'https://www.wildberries.ru/',
      },
    });

    if (!response.ok) {
      return jsonResponse({ error: `Wildberries вернул статус ${response.status}.` }, 502);
    }

    const html = await response.text();
    const jsonLdProduct = extractProductJsonLd(html);
    const title = jsonLdProduct?.name?.trim() || extractMetaContent(html, 'og:title');
    const imageUrl = normalizeImage(jsonLdProduct?.image) || extractMetaContent(html, 'og:image');
    const offers = Array.isArray(jsonLdProduct?.offers)
      ? jsonLdProduct?.offers[0]
      : jsonLdProduct?.offers;
    const rawPrice = offers?.price;
    const parsedPrice =
      typeof rawPrice === 'number'
        ? rawPrice
        : typeof rawPrice === 'string'
          ? Number(rawPrice.replace(',', '.'))
          : null;
    const price = Number.isFinite(parsedPrice) && parsedPrice && parsedPrice > 0 ? parsedPrice : extractPriceFromText(html);
    const currency = offers?.priceCurrency || 'RUB';

    return jsonResponse({
      title: title || '',
      imageUrl: imageUrl || '',
      price: price ?? null,
      currency,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Не удалось разобрать карточку Wildberries.',
      },
      500
    );
  }
});
