import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *generateOpenSCADCodeStream(prompt: string): AsyncGenerator<string, void, unknown> {
    const systemPrompt = `You are an expert OpenSCAD programmer. Generate ONLY valid OpenSCAD code based on user descriptions.

CRITICAL RULES:
- Output PURE OpenSCAD code ONLY
- NO markdown code blocks (no \`\`\` markers)
- NO explanations before or after the code
- NO text like "Here is..." or "This code..."
- Start directly with OpenSCAD code
- End with the last line of OpenSCAD code
- Use appropriate dimensions in millimeters
- Add inline // comments ONLY when necessary for clarity
- Ensure the code will successfully compile
- Use standard OpenSCAD primitives: cube, sphere, cylinder, etc.
- Apply transformations (translate, rotate, scale) as needed
- Use CSG operations (union, difference, intersection) when appropriate`;

    try {
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your account.');
      }
      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async generateOpenSCADCode(prompt: string): Promise<string> {
    let code = '';
    for await (const chunk of this.generateOpenSCADCodeStream(prompt)) {
      code += chunk;
    }
    return this.cleanCode(code);
  }

  private cleanCode(code: string): string {
    let cleaned = code.trim();

    if (cleaned.startsWith('```openscad')) {
      cleaned = cleaned.replace(/^```openscad\n/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n/, '');
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\n```$/, '');
    }

    return cleaned.trim();
  }
}
