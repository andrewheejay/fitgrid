import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  groupCode,
  imageCandidates,
  isErrorPage,
  jsonLdProducts,
  metaTags,
  normaliseUrl,
  parseMicrolink,
  parseProductHtml,
  stripSiteSuffix,
} from './listing';

const PAGE_URL = 'https://www.pacsun.com/fear-of-god-essentials/jet-black-hoodie.html';

/** The shape PacSun actually serves: OpenGraph plus a schema.org Product. */
const PRODUCT_PAGE = `
<!doctype html><html><head>
<title>Fear of God ESSENTIALS Jet Black Classic Fleece Hoodie | Pacsun</title>
<meta property="og:site_name" content="Pacsun">
<meta property="og:title" content="Fear of God ESSENTIALS Jet Black Classic Fleece Hoodie | Pacsun">
<meta property="og:image" content="//images.pacsun.com/hoodie.jpg">
<meta name="twitter:image" content="https://images.pacsun.com/fallback.jpg">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product",
 "name":"Jet Black Classic Fleece Hoodie",
 "brand":{"@type":"Brand","name":"Fear of God Essentials"},
 "sku":"0192250500815861","color":"Jet Black","material":"80% cotton, 20% polyester",
 "image":["https://images.pacsun.com/hoodie-front.jpg"],
 "offers":{"@type":"Offer","price":"90.00","priceCurrency":"USD"}}
</script>
</head><body></body></html>`;

describe('parseProductHtml', () => {
  const fields = parseProductHtml(PRODUCT_PAGE, PAGE_URL);

  it('prefers the schema.org name over the decorated page title', () => {
    expect(fields.name).toBe('Jet Black Classic Fleece Hoodie');
  });

  it('reads the catalogue fields the wardrobe has room for', () => {
    expect(fields).toMatchObject({
      brand: 'Fear of God Essentials',
      styleCode: '0192250500815861',
      colourway: 'Jet Black',
      composition: '80% cotton, 20% polyester',
      retail: '$90',
    });
  });

  it('takes the product image ahead of the social preview', () => {
    expect(fields.imageUrl).toBe('https://images.pacsun.com/hoodie-front.jpg');
  });

  it('falls back to OpenGraph when there is no structured product', () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Nike">
      <meta property="og:title" content="Sportswear Club Fleece Hoodie. Nike.com">
      <meta property="og:image" content="//static.nike.com/hoodie.png">
      <meta property="product:price:amount" content="65">
      <meta property="product:price:currency" content="USD">
      <meta property="product:brand" content="Nike">
    </head></html>`;

    expect(parseProductHtml(html, 'https://www.nike.com/t/hoodie')).toEqual({
      name: 'Sportswear Club Fleece Hoodie. Nike.com',
      imageUrl: 'https://static.nike.com/hoodie.png',
      brand: 'Nike',
      retail: '$65',
    });
  });

  it('leaves the style code empty when the page only offers an internal handle', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type":"ProductGroup","name":"Club Fleece Hoodie","productGroupID":"Gw4Nwq",
       "image":"https://static.nike.com/h.png","brand":{"name":"Nike"}}
      </script></head></html>`;

    expect(parseProductHtml(html, 'https://www.nike.com/t/hoodie')).toEqual({
      name: 'Club Fleece Hoodie',
      imageUrl: 'https://static.nike.com/h.png',
      brand: 'Nike',
    });
  });

  it('returns nothing at all for a page with no metadata', () => {
    expect(parseProductHtml('<html><body>hi</body></html>', PAGE_URL)).toEqual({});
  });

  it('survives a page whose JSON-LD block is malformed', () => {
    const html = `<html><head><title>Wool Jumper | Arket</title>
      <script type="application/ld+json">{ not json </script>
      <meta property="og:image" content="https://arket.com/j.jpg"></head></html>`;

    expect(parseProductHtml(html, 'https://www.arket.com/p/jumper')).toEqual({
      name: 'Wool Jumper',
      imageUrl: 'https://arket.com/j.jpg',
    });
  });
});

describe('metaTags', () => {
  it('keeps the first value when a page repeats a property', () => {
    const html = `<meta property="og:image" content="one.jpg">
                  <meta property="og:image" content="two.jpg">`;
    expect(metaTags(html).get('og:image')).toBe('one.jpg');
  });

  it('reads a content value containing an angle bracket', () => {
    const html = `<meta name="description" content="a > b"><meta name="x" content="y">`;
    const tags = metaTags(html);
    expect(tags.get('description')).toBe('a > b');
    expect(tags.get('x')).toBe('y');
  });

  it('decodes entities', () => {
    expect(metaTags(`<meta property="og:title" content="Levi&#39;s &amp; Co">`).get('og:title'))
      .toBe("Levi's & Co");
  });
});

describe('jsonLdProducts', () => {
  it('finds a product nested inside an @graph', () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":["Product"],"name":"Boxy tee"}]}</script>`;
    expect(jsonLdProducts(html)[0]?.['name']).toBe('Boxy tee');
  });

  it('ignores blocks that hold no product', () => {
    const html = `<script type="application/ld+json">{"@type":"Organization"}</script>`;
    expect(jsonLdProducts(html)).toEqual([]);
  });
});

describe('stripSiteSuffix', () => {
  it('drops the shop name', () => {
    expect(stripSiteSuffix('Classic Fleece Hoodie | Pacsun', PAGE_URL)).toBe(
      'Classic Fleece Hoodie',
    );
  });

  it('drops a section and a shop in one title', () => {
    expect(stripSiteSuffix('Wool Jumper - Navy - Knitwear - Arket', 'https://www.arket.com/p'))
      .toBe('Wool Jumper - Navy - Knitwear');
  });

  it('keeps a suffix that is part of the garment name', () => {
    expect(stripSiteSuffix('Hoodie - Jet Black', PAGE_URL)).toBe('Hoodie - Jet Black');
  });

  it('never returns an empty name', () => {
    expect(stripSiteSuffix('Pacsun', PAGE_URL)).toBe('Pacsun');
  });
});

describe('groupCode', () => {
  it('accepts an article number', () => {
    expect(groupCode('0192250500815861')).toBe('0192250500815861');
    expect(groupCode('BV2654-410')).toBe('BV2654-410');
  });

  it('rejects an internal handle that is not a code a label would carry', () => {
    expect(groupCode('Gw4Nwq')).toBeUndefined();
    expect(groupCode('12345')).toBeUndefined();
    expect(groupCode(undefined)).toBeUndefined();
  });
});

describe('formatPrice', () => {
  it('renders a known currency with its symbol', () => {
    expect(formatPrice('90.00', 'USD')).toBe('$90');
    expect(formatPrice(49.9, 'EUR')).toBe('€49.90');
  });

  it('falls back to the currency code', () => {
    expect(formatPrice(1200, 'SEK')).toBe('1200 SEK');
  });

  it('rejects prices that are not numbers', () => {
    expect(formatPrice('Call for price', 'USD')).toBeUndefined();
    expect(formatPrice(0, 'USD')).toBeUndefined();
    expect(formatPrice(undefined)).toBeUndefined();
  });
});

describe('isErrorPage', () => {
  it.each([
    '404 Not Found',
    'Page Not Found | Everlane',
    'Access to this page has been denied',
    'Access Denied',
    'Attention Required! | Cloudflare',
    'Just a moment...',
    '403 Forbidden',
  ])('rejects %s', (title) => {
    expect(isErrorPage(title)).toBe(true);
  });

  it.each([
    'Jet Black Classic Fleece Hoodie',
    '501 Original Fit Jeans',
    'Error Cotton Tee',
  ])('keeps %s', (title) => {
    expect(isErrorPage(title)).toBe(false);
  });
});

describe('parseMicrolink', () => {
  it('reads the flat metadata payload', () => {
    const payload = {
      status: 'success',
      data: {
        title: 'Nike Sportswear Club Fleece Hoodie',
        publisher: 'Nike',
        image: { url: 'https://static.nike.com/hoodie.png' },
      },
    };
    expect(parseMicrolink(payload, 'https://www.nike.com/t/hoodie')).toEqual({
      name: 'Nike Sportswear Club Fleece Hoodie',
      imageUrl: 'https://static.nike.com/hoodie.png',
      brand: 'Nike',
    });
  });

  it('returns nothing when the reader answered with an error', () => {
    expect(parseMicrolink({ status: 'fail' }, PAGE_URL)).toEqual({});
  });

  it('returns nothing when the shop answered 404 behind the reader', () => {
    const payload = {
      status: 'success',
      data: {
        statusCode: 404,
        title: '404 Not Found',
        publisher: 'Everlane',
        image: { url: 'https://everlane.com/logo.png' },
      },
    };
    expect(parseMicrolink(payload, 'https://www.everlane.com/products/gone')).toEqual({});
  });
});

describe('normaliseUrl', () => {
  it('assumes https when the scheme is missing', () => {
    expect(normaliseUrl('  pacsun.com/hoodie ')).toBe('https://pacsun.com/hoodie');
  });

  it('rejects anything that is not a web address', () => {
    expect(() => normaliseUrl('javascript:alert(1)')).toThrow();
    expect(() => normaliseUrl('not a url at all')).toThrow();
  });
});

describe('imageCandidates', () => {
  it('tries the origin first, then the CORS proxies', () => {
    const [origin, weserv, proxy] = imageCandidates('https://img.example.com/a.jpg?w=2000');
    expect(origin).toBe('https://img.example.com/a.jpg?w=2000');
    expect(weserv).toContain('images.weserv.nl');
    expect(weserv).toContain(encodeURIComponent('img.example.com/a.jpg?w=2000'));
    expect(proxy).toContain('allorigins.win');
  });
});
