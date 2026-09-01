import { describe, expect, it } from 'vitest';
import { checkOutboundUrl, isBlockedAddress, isIpLiteral } from './guard';

describe('checkOutboundUrl', () => {
  it('allows an ordinary product page', () => {
    const verdict = checkOutboundUrl('https://www.pacsun.com/p/hoodie.html?q=1');
    expect(verdict.ok).toBe(true);
  });

  it.each([
    ['file:///etc/passwd', 'only http and https'],
    ['gopher://example.com/', 'only http and https'],
    ['http://user:pw@example.com/', 'credentials in url'],
    ['http://example.com:22/', 'port not allowed'],
    ['http://localhost/admin', 'internal host'],
    ['http://redis.internal/', 'internal host'],
    ['http://metadata.google.internal/computeMetadata/v1/', 'internal host'],
    ['http://169.254.169.254/latest/meta-data/', 'private address'],
    ['http://127.0.0.1:80/', 'private address'],
    ['http://10.0.0.5/', 'private address'],
    ['not a url', 'not a url'],
  ])('refuses %s', (url, reason) => {
    const verdict = checkOutboundUrl(url);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toBe(reason);
  });

  it.each([
    // Every spelling of the cloud metadata address that URL will accept.
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:169.254.169.254]/',
    'http://[0:0:0:0:0:ffff:a9fe:a9fe]/',
    'http://[::169.254.169.254]/',
    // URL canonicalises these to 127.0.0.1 before the guard ever sees them,
    // which is worth a test precisely because it is the parser's doing and
    // not ours.
    'http://2130706433/',
    'http://0177.0.0.1/',
    'http://0x7f.1/',
  ])('refuses %s', (url) => {
    expect(checkOutboundUrl(url).ok).toBe(false);
  });
});

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::',
    'fc00::1', 'fe80::1', '::ffff:127.0.0.1', 'nonsense',
    // The hex form URL rewrites a mapped address to, and the deprecated
    // IPv4-compatible spelling, both of which reach the same four octets.
    '::ffff:a9fe:a9fe', '::a9fe:a9fe', '::169.254.169.254',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '93.184.216.34', '8.8.8.8', '172.32.0.1', '192.169.0.1', '2606:4700::1111',
  ])('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('does not mistake 172.15 or 172.32 for the private range', () => {
    expect(isBlockedAddress('172.15.0.1')).toBe(false);
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
    expect(isBlockedAddress('172.32.0.1')).toBe(false);
  });
});

describe('isIpLiteral', () => {
  it('separates literals from hostnames', () => {
    expect(isIpLiteral('1.2.3.4')).toBe(true);
    expect(isIpLiteral('::1')).toBe(true);
    expect(isIpLiteral('pacsun.com')).toBe(false);
  });
});
