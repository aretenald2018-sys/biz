import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

interface Contract {
  id: string;
  region: string;
  country: string;
  entity_code: string;
  brand: string;
  entity_name: string;
  data_domain_vehicle: string;
  data_domain_customer: string;
  data_domain_sales: string;
  data_domain_quality: string;
  data_domain_production: string;
  contract_status: string | null;
  transfer_purpose: string | null;
  transferable_data: string | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query } = body;

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const db = getDb();
  const contracts = db.prepare('SELECT * FROM contracts ORDER BY region, country, entity_code').all() as Contract[];

  if (contracts.length === 0) {
    return NextResponse.json({ result: '등록된 계약 데이터가 없습니다.' });
  }

  const contractContext = contracts
    .map(
      (c, i) =>
        `--- Contract ${i + 1} ---\nRegion: ${c.region}\nCountry: ${c.country}\nEntity Code: ${c.entity_code}\nBrand: ${c.brand}\nEntity Name: ${c.entity_name}\nVehicle: ${c.data_domain_vehicle}\nCustomer: ${c.data_domain_customer}\nSales: ${c.data_domain_sales}\nQuality: ${c.data_domain_quality}\nProduction: ${c.data_domain_production}\nContract Status: ${c.contract_status || 'N/A'}\nTransfer Purpose: ${c.transfer_purpose || 'N/A'}\nTransferable Data: ${c.transferable_data || 'N/A'}`
    )
    .join('\n\n');

  const systemPrompt =
    'You are a contract database assistant. Answer questions about contracts in Korean. Focus on transfer_purpose and transferable_data fields when answering about data transfer possibilities. The user\'s question is about contract data. Respond concisely.';

  const provider = process.env.AI_PROVIDER || 'claude';

  try {
    if (provider === 'claude') {
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `다음은 계약 데이터입니다:\n\n${contractContext}\n\n질문: ${query}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return NextResponse.json({ result: textBlock?.text || 'No response generated.' });
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\n다음은 계약 데이터입니다:\n\n${contractContext}\n\n질문: ${query}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      return NextResponse.json({
        result: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.',
      });
    }

    return NextResponse.json({ result: 'AI provider not configured. Set AI_PROVIDER in .env' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `AI search failed: ${message}` }, { status: 500 });
  }
}
