import Anthropic from "@anthropic-ai/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { FdLearnedProfile } from "@paperclipai/db";
import { closeSession, getMessages, getProfile, updateLearned, type Session } from "../store.js";

const MODEL = "claude-opus-4-8";
const useDirectApi = Boolean(process.env.ANTHROPIC_API_KEY);

interface LearningResult {
  interestsAdd: string[];
  prioritiesAdd: string[];
  communicationStyle: string;
  noteAdd: string;
  sessionSummary: string;
}

const LEARNING_SCHEMA = {
  type: "object",
  properties: {
    interestsAdd: { type: "array", items: { type: "string" }, description: "New durable interests revealed this session" },
    prioritiesAdd: { type: "array", items: { type: "string" }, description: "Current work priorities mentioned this session" },
    communicationStyle: { type: "string", description: "Updated one-line description of how this person likes to communicate; empty string if no new signal" },
    noteAdd: { type: "string", description: "One durable note worth remembering for future sessions; empty string if none" },
    sessionSummary: { type: "string", description: "Two-sentence summary of what happened this session" },
  },
  required: ["interestsAdd", "prioritiesAdd", "communicationStyle", "noteAdd", "sessionSummary"],
  additionalProperties: false,
} as const;

function buildExtractionPrompt(displayName: string, learned: FdLearnedProfile, transcript: string): string {
  return (
    `You maintain a learning profile for a HonorHealth employee who chats with a digital agency. ` +
    `Extract only durable, useful facts (not one-off task details).\n\n` +
    `Current profile:\nInterests: ${learned.interests.join("; ") || "(none)"}\n` +
    `Priorities: ${learned.priorities.join("; ") || "(none)"}\n` +
    `Communication style: ${learned.communicationStyle || "(unknown)"}\n\n` +
    `Session transcript:\n${transcript}`
  );
}

function extractJson(text: string): LearningResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in learning output");
  return JSON.parse(text.slice(start, end + 1)) as LearningResult;
}

async function summarizeApi(prompt: string): Promise<LearningResult> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { format: { type: "json_schema", schema: LEARNING_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return extractJson(textBlock && textBlock.type === "text" ? textBlock.text : "{}");
}

async function summarizeCli(prompt: string): Promise<LearningResult> {
  let output = "";
  for await (const message of query({
    prompt,
    options: {
      systemPrompt:
        "You extract structured facts. Respond with ONLY a minified JSON object matching this schema, " +
        "no prose, no code fences:\n" +
        JSON.stringify(LEARNING_SCHEMA),
      maxTurns: 1,
    },
  })) {
    if (message.type === "result") {
      if (message.subtype === "success") output = message.result;
      break;
    }
  }
  return extractJson(output);
}

function mergeCapped(existing: string[], additions: string[], cap = 10): string[] {
  const merged = [...existing];
  for (const item of additions) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!merged.some((e) => e.toLowerCase() === trimmed.toLowerCase())) merged.push(trimmed);
  }
  return merged.slice(-cap);
}

/**
 * The learning loop: summarize a finished session into durable profile facts,
 * merge them into the employee's `learned` jsonb, and close the session.
 * The next session's system prompt picks the updated profile up automatically.
 */
export async function learnFromSession(session: Session): Promise<{ summary: string }> {
  const [messages, profile] = await Promise.all([getMessages(session.id), getProfile(session.profileId)]);
  if (!profile) throw new Error("Profile not found for session");

  const transcript = messages
    .map((m) => {
      if (m.role === "user") return `${profile.displayName}: ${m.body}`;
      if (m.role === "agent") return `${m.agentSlug}: ${m.body}`;
      return `[${m.kind}] ${m.body}`;
    })
    .join("\n");

  const prompt = buildExtractionPrompt(profile.displayName, profile.learned, transcript);
  const parsed = useDirectApi ? await summarizeApi(prompt) : await summarizeCli(prompt);

  const learned: FdLearnedProfile = {
    interests: mergeCapped(profile.learned.interests, parsed.interestsAdd ?? []),
    priorities: mergeCapped(profile.learned.priorities, parsed.prioritiesAdd ?? []),
    communicationStyle: parsed.communicationStyle?.trim() || profile.learned.communicationStyle,
    notes: mergeCapped(profile.learned.notes, parsed.noteAdd ? [parsed.noteAdd] : []),
  };

  await updateLearned(profile.id, learned);
  await closeSession(session.id, parsed.sessionSummary ?? null);
  return { summary: parsed.sessionSummary ?? "" };
}
