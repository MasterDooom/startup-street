import { NextResponse } from 'next/server';

function fallbackMessage(lead: any, channel: string) {
  const name = lead?.name || 'there';
  const finding = lead?.findings?.find((item: any) => item?.severity === 'critical' || item?.severity === 'high') ?? lead?.findings?.[0];
  const problem = finding?.problem || lead?.evidence || 'I noticed a few opportunities to make the online experience clearer.';
  const fix = finding?.fix || lead?.opportunity || 'a cleaner, conversion-focused website';

  if (channel === 'email') {
    return `Subject: Quick idea for ${name}

Hi ${name === 'there' ? 'there' : name},

I came across ${name} and noticed ${problem.toLowerCase()}.

I build focused websites for local businesses, and I think ${fix.toLowerCase()} could make it easier for customers to take the next step.

I can put together a quick concept so you can see the direction before deciding anything.

Worth sending it over?

— Startup Street`;
  }

  if (channel === 'whatsapp') {
    return `Hey! I came across ${name}. I noticed ${problem.toLowerCase()}. I build simple, high-converting sites for local businesses and had an idea for how to fix it. Want me to send you a quick concept?`;
  }

  return `Hey, I came across ${name}. I noticed ${problem.toLowerCase()}. I build websites focused on making the next step obvious for customers. I had a quick idea for ${name} — want me to send it over?`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lead = body?.lead;
    const agency = body?.agencyProfile || {};
    const channel = ['instagram', 'email', 'whatsapp', 'followup'].includes(body?.channel) ? body.channel : 'instagram';

    if (!lead?.name) return NextResponse.json({ error: 'Lead data is required.' }, { status: 400 });

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        mode: 'rules',
        message: fallbackMessage(lead, channel),
        note: 'AI_API_KEY is not configured. This draft was generated from the verified audit findings, not an LLM.',
      });
    }

    const prompt = `You are writing one concise B2B outreach message for Startup Street, a web development agency.
Only use facts explicitly provided in the lead data. Never invent a website defect, business event, review, or compliment.
Goal: start a conversation, not close a sale.
Channel: ${channel}
Business: ${lead.name}
City: ${lead.city || ''}
Category: ${lead.type || lead.category || ''}
Website: ${lead.website || 'none'}
Evidence: ${lead.evidence || ''}
Verified findings: ${JSON.stringify(lead.findings || []).slice(0, 7000)}
Recommended service: ${lead.recommendedService || lead.opportunity || ''}
Agency: ${agency.name || 'Startup Street'}
Agency description: ${agency.description || ''}
Agency services: ${Array.isArray(agency.services) ? agency.services.join(', ') : ''}
Agency differentiators: ${Array.isArray(agency.differentiators) ? agency.differentiators.join(', ') : ''}
Write the message in a natural, human tone. Keep it concise. Mention one real issue, one relevant fix, and a low-pressure CTA. Do not use emojis unless clearly appropriate. Output only the message.`;

    const response = await fetch(`${process.env.AI_BASE_URL || 'https://api.openai.com/v1'}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || '',
        input: prompt,
        max_output_tokens: 280,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          mode: 'rules',
          message: fallbackMessage(lead, channel),
          note: `AI provider failed (${response.status}); returned a deterministic fallback.`,
          detail: detail.slice(0, 400),
        },
        { status: 200 },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      mode: 'ai',
      message: String(data?.output_text || fallbackMessage(lead, channel)).trim(),
      model: process.env.AI_MODEL || '',
    });
  } catch {
    return NextResponse.json({ error: 'Unable to generate outreach.' }, { status: 500 });
  }
}
