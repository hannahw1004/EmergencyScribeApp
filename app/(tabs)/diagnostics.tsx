import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a medical condition probability analyzer. Analyze given symptoms and return the three most probable conditions in exact specified format.

INPUT PROCESSING:
- Accept list of symptoms, signs, and clinical findings
- Process symptom patterns and relationships
- Consider severity and duration if provided

OUTPUT FORMAT:
Must exactly match this format:
< Disease Candidates >
[Medical Term], Chance: [X]%
[Medical Term], Chance: [X]%
[Medical Term], Chance: [X]%

Where:
- [Medical Term] = precise medical terminology
- [X] = integer 0-100
- Maintain exact spacing and formatting
- Include exact characters "<", ">", "%"
- No extra lines or spaces

CONSTRAINTS:
- Must follow exact output format
- Use precise medical terminology
- Confidence must be integer 0-100
- No additional text or explanations`;

const USER_PROMPT = `Analyze these symptoms and list the top 3 most probable conditions in exact format:`;

export class DiseasePredictor {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: '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' // Use environment variable for API key
        });
    }

    async predictDisease(symptoms: string): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                model: "gpt-4o", // Corrected model name
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `${USER_PROMPT}\n\n${symptoms}` }
                ],
                temperature: 0.1
            });

            if (!completion.choices[0]?.message?.content) {
                throw new Error('No response content from OpenAI');
            }
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error in predictDisease:', error);
            throw new Error(`Failed to predict diseases: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}