import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lead = body?.lead;
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI_API_KEY is not configured. Add AI_API_KEY and AI_MODEL server-side to enable web research.' }, { status: 503 });
    }

    if (!lead?.name) return NextResponse.json({ error: 'Lead data is required.' }, { status: 400 });

    const prompt = `Research this public local business for a web-development sales workflow.
Business: ${lead.name}
City: ${lead.city || ''}
Category: ${lead.category || lead.type || ''}
Known website: ${lead.website || 'none'}
Known social: ${lead.social || 'none'}

Use public web sources only. Look for fresh, verifiable signals that can change the sales approach: recent opening/expansion, multiple locations, service mix, project/portfolio activity, public social activity, public contact channels, or an official website problem that is visibly documented.

Return a concise research brief with:
1) 3-6 verified signals
2) the source URL for each signal
3) confidence (high/medium/low)
4) one recommended sales angle
5) anything that could make this lead a poor fit.
Do not invent facts. Clearly label uncertainty. Do not collect private personal information. This output is research for human review, not an automatic outreach decision.`;

    const response = await fetch('`${process.env.AI_BASE_URL || 'https://api.openai.com/v1'}/responses`', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || '',
        tools: [{ type: 'web_search' }],
        input: prompt,
        max_output_tokens: 900,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `AI research failed (${response.status}).`, detail: detail.slice(0, 500) }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({
      mode: 'web-search',
      text: String(data?.output_text || '').trim(),
      model: process.env.AI_MODEL || '',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : 'Research failed.' }, { status: 500 });
  }
}