import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a medical symptoms extraction system. Your task is to thoroughly analyze medical text and extract ALL symptoms, conditions, and clinical findings, maintaining complete accuracy and detail.

EXTRACTION REQUIREMENTS:
1. Extract ALL information about:
   - Symptoms (both explicit and implicit)
   - Medical conditions
   - Clinical findings
   - Test results
   - Vital signs
   - Patient-reported experiences
   - Physical examination findings

2. For each finding, preserve:
   - Exact medical terminology
   - Precise measurements and values
   - Temporal information (when mentioned)
   - Severity descriptions
   - Related factors
   - Context of occurrence

3. Maintain accuracy by:
   - Using exact phrases from the text
   - Including all numerical values
   - Preserving medical terminology
   - Keeping all contextual details
   - Not omitting any information

DO NOT:
- Add interpretations
- Make diagnoses
- Suggest treatments
- Add information not in the text
- Summarize or condense details

FORMAT:
Present the extracted information in a clear, organized list that preserves all medical details while being easy to review.`;

const USER_PROMPT = `Extract ALL symptoms and clinical findings from the text below. Include EVERY detail mentioned, preserving exact terminology and measurements. Do not interpret or diagnose - only extract and organize the information presented.`;

export class SymptomDetector {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: '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'
        });
    }

    async detectSymptom(query: string): Promise<string> {
        try{
            const completion = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT},
                    { role: "user", content: USER_PROMPT},
                    { role: "user", content: query}
                ],
                temperature: 0.1
            });

            if (!completion.choices[0]?.message?.content) {
                throw new Error('No response content from OpenAI');
            }
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error in detectSymptom:', error);
            throw new Error(`Failed to detect symptoms: ${error instanceof Error ? error.message: 'Unknown error'}`);
        }
    }
}