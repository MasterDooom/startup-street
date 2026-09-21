import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';

type Finding = {
  id: string;
  title: string;
  problem: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  fix: string;
};

function finding(
  id: string,
  title: string,
  problem: string,
  severity: Finding['severity'],
  evidence: string,
  confidence: Finding['confidence'],
  fix: string,
): Finding {
  return { id, title, problem, severity, evidence, confidence, fix };
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function privateIpv4(ip: string) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function privateIpv6(ip: string) {
  const value = ip.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

async function assertPublicHost(hostname: string) {
  if (blockedHost(hostname)) throw new Error('Private or local hosts cannot be audited.');
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => privateIpv4(record.address) || privateIpv6(record.address))) {
    throw new Error('The target resolves to a private or local network address.');
  }
}

async function fetchSafely(startUrl: URL, maxRedirects = 4) {
  let current = new URL(startUrl.toString());

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicHost(current.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'StartupStreetAudit/2.0' },
        cache: 'no-store',
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect response did not include a location.');
        current = new URL(location, current);
        continue;
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Too many redirects.');
}

function extractLinks(html: string, baseUrl: URL) {
  const links: string[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && links.length < 40) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    try {
      const url = new URL(raw, baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') links.push(url.toString());
    } catch {
      // Ignore malformed links.
    }
  }
  return Array.from(new Set(links));
}

async function checkLink(url: string, expectedHostname: string) {
  let current = new URL(url);
  if (!['http:', 'https:'].includes(current.protocol) || current.hostname !== expectedHostname) return 0;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    await assertPublicHost(current.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(current.toString(), {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'StartupStreetAudit/2.0' },
        cache: 'no-store',
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return 0;
        current = new URL(location, current);
        if (current.hostname !== expectedHostname) return 0;
        continue;
      }

      return response.status;
    } catch {
      return 0;
    } finally {
      clearTimeout(timeout);
    }
  }

  return 0;
}

export async function POST(request: Request) {
  const started = Date.now();

  try {
    const body = await request.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) return NextResponse.json({ error: 'A website URL is required.' }, { status: 400 });

    let target: URL;
    try {
      target = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    } catch {
      return NextResponse.json({ error: 'That is not a valid public URL.' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(target.protocol) || blockedHost(target.hostname)) {
      return NextResponse.json({ error: 'Only public HTTP(S) websites can be audited.' }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetchSafely(target);
    } catch (error) {
      return NextResponse.json(
        {
          url: target.toString(),
          finalUrl: target.toString(),
          reachable: false,
          findings: [finding('network-guard', 'Website could not be safely fetched', error instanceof Error ? error.message : 'Network safety check failed.', 'critical', 'SSRF/private-network guard rejected the request.', 'high', 'Verify that the public website resolves to a publicly routable address.')],
          score: 0,
        },
        { status: 400 },
      );
    }

    if (!response.ok) {
      return NextResponse.json({
        url: target.toString(),
        finalUrl: response.url,
        reachable: false,
        httpStatus: response.status,
        elapsedMs: Date.now() - started,
        findings: [
          finding('unreachable', 'Website unreachable', 'The public page did not return a successful HTTP response.', 'critical', `HTTP ${response.status}`, 'high', 'Verify the domain, hosting, and SSL configuration before proposing a redesign.'),
        ],
        score: 25,
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json({
        url: target.toString(),
        finalUrl: response.url,
        reachable: true,
        httpStatus: response.status,
        elapsedMs: Date.now() - started,
        findings: [
          finding('non-html', 'Non-HTML landing page', 'The URL responds, but it is not an HTML page that can be evaluated for customer experience.', 'high', contentType, 'high', 'Point the main business domain to a proper customer-facing web page.'),
        ],
        score: 30,
      });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 6_000_000) {
      return NextResponse.json({
        url: target.toString(),
        finalUrl: response.url,
        reachable: true,
        httpStatus: response.status,
        responseMs: Date.now() - started,
        findings: [finding('page-size', 'Page is unusually large', 'The returned document is larger than the lightweight audit budget.', 'medium', contentLength + ' bytes reported by the server.', 'high', 'Reduce HTML payload and defer non-essential content.')],
        score: 86,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const html = new TextDecoder().decode(arrayBuffer.slice(0, 2_500_000));
    const lower = html.toLowerCase();
    const findings: Finding[] = [];

    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<[^>]*>/g, '').trim();
    const viewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
    const h1Count = (html.match(/<h1\b/gi) ?? []).length;
    const textLength = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
    const hasMenu = /(menu|our menu|food|price list|services|portfolio)/i.test(html);
    const hasPdfMenu = /href=["'][^"']*(menu|price)[^"']*\.pdf/i.test(html);
    const hasImageMenu = /(menu|price)[^<]{0,100}<[^>]*img|<img[^>]+(menu|price)/i.test(html);
    const hasPhone = /(?:tel:|\+?91[ -]?\d{10}|call us|phone us)/i.test(html);
    const hasWhatsApp = /(wa\.me|whatsapp)/i.test(lower);
    const hasBooking = /(book (a )?table|book now|appointment|schedule|reserve|reservation)/i.test(lower);
    const hasOrder = /(order online|order now|delivery|takeaway|request a quote|get a quote|enquire|enquiry)/i.test(lower);
    const hasHours = /(opening hours|business hours|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)/i.test(lower);
    const hasMap = /(google\.com\/maps|maps\/search|maps\.google)/i.test(lower);
    const hasCatering = /(catering|events|weddings|corporate|party orders)/i.test(lower);
    const socialLinks = (html.match(/https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com|youtube\.com|tiktok\.com)/gi) ?? []).length;
    const links = extractLinks(html, new URL(response.url));
    const responseHost = new URL(response.url).hostname;
    const internalLinks = links.filter(link => {
      try { return new URL(link).hostname === responseHost; } catch { return false; }
    }).slice(0, 6);

    if (!viewport) findings.push(finding('viewport', 'No mobile viewport tag detected', 'The document does not declare the standard responsive viewport meta tag.', 'high', 'No <meta name="viewport"> detected.', 'high', 'Implement a responsive mobile layout and viewport configuration.'));
    if (!title) findings.push(finding('title', 'Missing page title', 'Search engines and users have less context about the page.', 'medium', 'No usable <title> was found.', 'high', 'Add a concise title matching the business and location.'));
    if (h1Count === 0) findings.push(finding('h1', 'No primary heading detected', 'The page lacks an obvious primary content heading in its HTML.', 'medium', '0 <h1> elements detected.', 'medium', 'Add one clear value proposition or primary heading.'));
    if (textLength < 450) findings.push(finding('thin', 'Very little crawlable page content', 'The page contains unusually little text content for a business site.', 'medium', `${textLength} characters of visible-ish text detected.`, 'medium', 'Add clear service, location, proof, and contact content.'));
    if (!hasPhone) findings.push(finding('phone', 'No obvious phone CTA', 'A customer may not have a fast path to call the business.', 'high', 'No tel link or obvious phone/call text found.', 'medium', 'Add a persistent click-to-call CTA on mobile.'));
    if (!hasWhatsApp) findings.push(finding('whatsapp', 'No WhatsApp CTA detected', 'No WhatsApp link was found in the page HTML.', 'medium', 'No wa.me or WhatsApp marker detected.', 'medium', 'Add WhatsApp for quick enquiries where appropriate.'));
    if (!hasBooking && !hasOrder) findings.push(finding('cta', 'No obvious booking, order, quote, or enquiry CTA', 'The page does not expose a clear next-step action for a prospect.', 'critical', 'No booking/order/quote/enquiry phrases detected.', 'medium', 'Create one primary CTA and repeat it at key decision points.'));
    if (!hasHours) findings.push(finding('hours', 'Opening hours not detected', 'Prospective customers may have to search elsewhere for availability.', 'low', 'No common opening-hours signals detected.', 'medium', 'Show hours and holiday updates clearly.'));
    if (!hasMap) findings.push(finding('map', 'Location/map not detected', 'Local customers may need another step to find the business.', 'medium', 'No Google Maps link detected.', 'medium', 'Add a map link and full local address.'));
    if (hasPdfMenu) findings.push(finding('pdf-menu', 'PDF menu detected', 'The menu appears to depend on a PDF asset, which can add friction on mobile.', 'medium', 'A menu/price PDF link was detected.', 'high', 'Create a fast, searchable HTML menu and keep the PDF as an optional download.'));
    if (hasImageMenu) findings.push(finding('image-menu', 'Image-based menu signal detected', 'A menu may be presented primarily as an image rather than readable HTML.', 'medium', 'Menu/price image pattern detected in HTML.', 'medium', 'Convert menu content to accessible HTML with responsive typography.'));
    if (!hasMenu) findings.push(finding('menu', 'Menu/services content not obvious', 'The page does not expose a clear menu or service/portfolio section.', 'high', 'No common menu/service/portfolio terms detected.', 'medium', 'Make the core offer visible above the fold with dedicated details.'));
    if (socialLinks === 0) findings.push(finding('social', 'No social profile links detected', 'The site does not visibly connect visitors to public social proof.', 'low', 'No common social links detected.', 'medium', 'Add social links selectively where they strengthen trust.'));
    if (hasCatering === false && /(interior|design|renovation|event|solar|home service)/i.test(lower)) findings.push(finding('proof', 'No dedicated project/service proof signal', 'The page appears service-led but lacks an obvious portfolio/case-study or project proof section.', 'medium', 'No strong project-proof keywords detected.', 'low', 'Add before/after work, projects, process, testimonials, or case studies.'));

    const linkStatuses = await Promise.all(internalLinks.map((link) => checkLink(link, responseHost)));
    const brokenLinks = linkStatuses.filter((status) => status >= 400 || status === 0).length;
    if (brokenLinks > 0) findings.push(finding('broken-links', 'Broken internal links detected', `${brokenLinks} internal link(s) failed a lightweight availability check.`, 'high', `Checked up to ${internalLinks.length} internal links; ${brokenLinks} failed.`, 'medium', 'Repair dead links and remove stale navigation paths.'));

    // "Visual freshness" and true mobile performance require a browser/Lighthouse provider.
    findings.push(finding('visual', 'Visual freshness requires a browser pass', 'Static HTML cannot reliably judge typography, spacing, visual hierarchy, or real mobile rendering.', 'info', 'Browser/Lighthouse/visual AI not configured in this audit.', 'high', 'Connect a browser performance/screenshot provider for visual scoring.'));

    const penalties: Record<Finding['severity'], number> = { critical: 22, high: 14, medium: 7, low: 3, info: 0 };
    const penalty = findings.reduce((sum, item) => sum + penalties[item.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    return NextResponse.json({
      url: target.toString(),
      finalUrl: response.url,
      reachable: true,
      httpStatus: response.status,
      responseMs: Date.now() - started,
      title,
      metrics: {
        hasViewport: viewport,
        h1Count,
        textLength,
        internalLinksChecked: internalLinks.length,
        brokenLinks,
        hasMenu,
        hasPhone,
        hasWhatsApp,
        hasBooking,
        hasOrder,
        hasHours,
        hasMap,
        hasCatering,
        socialLinks,
        hasPdfMenu,
        hasImageMenu,
      },
      findings,
      score,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed.';
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 });
  }
}
