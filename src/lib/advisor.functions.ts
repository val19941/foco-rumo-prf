import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const summarySchema = z.object({
  disciplinas: z
    .array(
      z.object({
        id: z.string().max(80),
        nome: z.string().max(120),
      }).passthrough(),
    )
    .max(60),
  geral: z.record(z.unknown()),
  concentracaoSemana: z.record(z.unknown()),
});

export interface AiAdvice {
  resumo: string;
  recomendacoes: { titulo: string; texto: string; tipo: string; disciplinaId: string | null }[];
  ajustes: { disciplinaId: string; fator: number; foco: "teoria" | "pratica" | "equilibrado"; motivo: string }[];
}

const SYSTEM = `Você é o "Orientador de Estudos" do FocusStudy, um app de preparação para o concurso da PRF.
Analise somente os dados agregados enviados pelo usuário e proponha ajustes no planejamento de estudos.
Regras obrigatórias:
- Escreva em português brasileiro, de forma direta, motivadora e concreta.
- Baseie-se apenas nos números recebidos; quando houver poucos dados, diga isso.
- Apresente relações como observações, nunca como causa comprovada.
- NUNCA mencione medicamentos, doses, horários de administração, frequência de uso ou qualquer orientação médica ou de saúde. Se o assunto surgir, ignore-o.
- Foque em: desempenho nas questões, tempo de estudo, dificuldades de concentração, disciplinas com menor domínio, conteúdos atrasados, revisões pendentes, disponibilidade diária e histórico de produtividade.
- Use apenas ids de disciplinas presentes nos dados.
- fator: entre 0.5 (reduzir) e 2 (aumentar) o peso da disciplina no cronograma; 1 = manter.
- Gere de 3 a 7 recomendações e no máximo 6 ajustes.`;

export const getAiAdvice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => summarySchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; advice: AiAdvice } | { ok: false; error: string }> => {
    const { generateResponse, GatewayError, PaymentRequiredError, RateLimitError } = await import(
      "@lovable.dev/ai-gateway"
    );
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [
          {
            role: "user",
            content: `Dados de estudo (JSON). Retorne JSON conforme o esquema.\n${JSON.stringify(data)}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "orientacao",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["resumo", "recomendacoes", "ajustes"],
              properties: {
                resumo: { type: "string" },
                recomendacoes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["titulo", "texto", "tipo", "disciplinaId"],
                    properties: {
                      titulo: { type: "string" },
                      texto: { type: "string" },
                      tipo: { type: "string", enum: ["desempenho", "revisao", "concentracao", "cronograma", "dominio"] },
                      disciplinaId: { type: ["string", "null"] },
                    },
                  },
                },
                ajustes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["disciplinaId", "fator", "foco", "motivo"],
                    properties: {
                      disciplinaId: { type: "string" },
                      fator: { type: "number" },
                      foco: { type: "string", enum: ["teoria", "pratica", "equilibrado"] },
                      motivo: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const text = extractText(res);
      if (!text) return { ok: false, error: "A IA não retornou uma resposta. Tente novamente." };
      const parsed = JSON.parse(text) as AiAdvice;
      return { ok: true, advice: parsed };
    } catch (e) {
      if (e instanceof PaymentRequiredError)
        return { ok: false, error: "Os créditos de IA do workspace acabaram. Adicione créditos para usar o orientador com IA." };
      if (e instanceof RateLimitError)
        return { ok: false, error: "Muitas solicitações em pouco tempo. Aguarde um minuto e tente de novo." };
      if (e instanceof GatewayError) {
        console.error("AI gateway error", e.code, e.httpStatus);
        return { ok: false, error: "Não foi possível consultar a IA agora. Tente novamente mais tarde." };
      }
      console.error(e);
      return { ok: false, error: "Falha ao interpretar a resposta da IA." };
    }
  });

function extractText(res: unknown): string | null {
  const r = res as { output_text?: unknown; output?: unknown };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output as { type?: string; content?: { type?: string; text?: string }[] }[]) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) if (c.type === "output_text" && typeof c.text === "string") return c.text;
  }
  return null;
}
