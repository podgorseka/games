'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating initial block configurations and challenges for the "Block Blast" game.
 *
 * - generateBlockBlastLevel - A function that generates a new Block Blast level based on difficulty.
 * - GenerateBlockBlastLevelInput - The input type for the generateBlockBlastLevel function.
 * - GenerateBlockBlastLevelOutput - The return type for the generateBlockBlastLevel function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BlockSchema = z.object({
  row: z.number().int().min(0).describe('The row index of the block.'),
  col: z.number().int().min(0).describe('The column index of the block.'),
  type: z.string().describe('The type or color of the block (e.g., "red", "blue", "green", "square", "L-shape", "solid").'),
});

const GenerateBlockBlastLevelInputSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium').describe('The desired difficulty level for the Block Blast level generation.'),
});
export type GenerateBlockBlastLevelInput = z.infer<typeof GenerateBlockBlastLevelInputSchema>;

const GenerateBlockBlastLevelOutputSchema = z.object({
  gridRows: z.number().int().min(5).max(15).default(9).describe('The number of rows in the Block Blast grid.'),
  gridCols: z.number().int().min(5).max(15).default(9).describe('The number of columns in the Block Blast grid.'),
  initialBlocks: z.array(BlockSchema).describe('An array of blocks pre-placed on the grid at the start of the game.'),
  challengeDescription: z.string().describe('A short description of the challenge for this level, related to clearing lines or achieving specific patterns.'),
});
export type GenerateBlockBlastLevelOutput = z.infer<typeof GenerateBlockBlastLevelOutputSchema>;

export async function generateBlockBlastLevel(input: GenerateBlockBlastLevelInput): Promise<GenerateBlockBlastLevelOutput> {
  return blockBlastLevelGeneratorFlow(input);
}

const blockBlastLevelPrompt = ai.definePrompt({
  name: 'blockBlastLevelPrompt',
  input: {schema: GenerateBlockBlastLevelInputSchema},
  output: {schema: GenerateBlockBlastLevelOutputSchema},
  prompt: `You are an expert game level designer for a game called "Block Blast".
In Block Blast, players place blocks onto a grid to clear full lines.
Your task is to create a challenging and engaging initial configuration for a Block Blast level.

Based on the requested difficulty, generate a JSON object representing the initial state of the game grid and a challenge description.

The grid dimensions should be between 5x5 and 15x15. A common size is 9x9 or 10x10.
The \`initialBlocks\` array should contain objects, each with a \`row\`, \`col\`, and \`type\`.
The \`type\` can represent a color (e.g., "red", "blue", "green", "yellow") or a simple block identifier (e.g., "solid", "dotted", "striped"). Choose distinct types.
Ensure that \`row\` and \`col\` are within the specified grid dimensions and are valid (0-indexed). Do not place blocks outside the grid.
The initial blocks should not completely fill any lines or columns from the start.

Consider the following difficulty: {{{difficulty}}}

For 'easy' difficulty:
- Place a small number of blocks (e.g., 5-10) in non-obstructive positions.
- The challenge should be straightforward and encouraging.
For 'medium' difficulty:
- Place a moderate number of blocks (e.g., 10-20) that create some interesting patterns but leave plenty of space.
- The challenge should require some planning.
For 'hard' difficulty:
- Place a larger number of blocks (e.g., 20-35) in positions that might require careful consideration to clear lines.
- The challenge should be complex and demanding.

Output schema: {{json _output_schema}}`,
});

const blockBlastLevelGeneratorFlow = ai.defineFlow(
  {
    name: 'blockBlastLevelGeneratorFlow',
    inputSchema: GenerateBlockBlastLevelInputSchema,
    outputSchema: GenerateBlockBlastLevelOutputSchema,
  },
  async input => {
    const {output} = await blockBlastLevelPrompt(input);
    if (!output) {
        throw new Error('Failed to generate Block Blast level.');
    }
    return output;
  }
);
