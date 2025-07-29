import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import systemPrompt from "@/lib/systemPrompt"; // ajuste se necessário

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Mensagens inválidas ou vazias" }, { status: 400 });
    }

    // Mensagem de Sistema
    const systemMessage = {
      role: "system" as const,
      content: systemPrompt,
    };

    // Garantir que o role seja exatamente "user" ou "assistant"
    const openAiMessages = messages.map((msg: { role: string; text: string }) => {
      let role: "user" | "assistant" = "user"; // default
      if (msg.role === "assistant") role = "assistant";
      if (msg.role === "user") role = "user";

      return {
        role,
        content: msg.text,
      };
    });

    const promptMessages = [systemMessage, ...openAiMessages];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: promptMessages,
    });

    const reply = completion.choices[0].message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Erro na API OpenAI:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
