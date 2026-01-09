import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateOpenSCADCode(prompt: string): Promise<string> {
    const systemPrompt = `You are an expert OpenSCAD programmer. Generate valid OpenSCAD code based on user descriptions.

Rules:
- Always generate syntactically correct OpenSCAD code
- Use appropriate dimensions (in millimeters)
- Add comments explaining key design decisions
- Return ONLY the OpenSCAD code, no explanations or markdown
- Use proper module definitions when appropriate
- Ensure the code will successfully compile
- Use standard OpenSCAD primitives: cube, sphere, cylinder, etc.
- Apply transformations (translate, rotate, scale) as needed
- Use CSG operations (union, difference, intersection) when appropriate`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return this.cleanCode(content);
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
