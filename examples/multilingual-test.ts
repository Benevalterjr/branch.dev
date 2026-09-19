import {
  BranchClient,
  BRANCH_EMBEDDING_MODELS,
  configure,
  decide,
} from "../src/index.js";

async function main() {
  console.log("=================================================");
  console.log("🌍 Branch.dev - Teste com Modelo Multilingue");
  console.log(`📌 Modelo: ${BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED}`);
  console.log("=================================================\n");

  const client = new BranchClient({
    modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
  });

  const chamados = [
    {
      id: "TICKET-01",
      assunto: "Cobranca indevida no cartao",
      mensagem: "Minha assinatura veio duplicada no fechamento da fatura deste mes. Preciso de estorno urgente.",
    },
    {
      id: "TICKET-02",
      assunto: "Erro 500 ao emitir nota fiscal",
      mensagem: "O sistema esta travando quando clico em gerar XML da NF-e. Aparece erro no console do navegador.",
    },
    {
      id: "TICKET-03",
      assunto: "Como adicionar novos membros no plano Pro?",
      mensagem: "Gostaria de saber qual e o limite de usuarios e como convidar meu socio para a organizacao.",
    },
  ];

  const categorias = {
    financeiro: "questoes sobre pagamentos, faturas, estornos, cobrancas ou cartao de credito",
    tecnico: "falhas no sistema, bugs, erros de servidor 500, problemas na emissao de arquivos ou tela travada",
    onboarding: "duvidas gerais sobre uso da plataforma, convite de membros, tutoriais ou limites de planos",
  };

  console.log("⏳ Processando chamados em Portugues...\n");

  for (const chamado of chamados) {
    const start = performance.now();
    const result = await client.decide({
      state: chamado,
      choices: categorias,
      task: "identificar o departamento de atendimento adequado",
    });
    const duration = (performance.now() - start).toFixed(2);

    console.log(`📋 [${chamado.id}] ${chamado.assunto}`);
    console.log(`   🏆 Categoria: ${result.winner.toUpperCase()} (confianca: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`   ⏱️ Latencia total: ${duration} ms (inferencia pura: ${result.latencyMs.toFixed(2)} ms)`);
    console.log(`   📊 Probabilidades:`);
    for (const [cat, prob] of Object.entries(result.probabilities)) {
      const p = (Number(prob) * 100).toFixed(1);
      console.log(`      - ${cat.padEnd(12)}: ${p}%`);
    }
    console.log("");
  }

  console.log("-------------------------------------------------");
  console.log("🧪 Testando configure() global com modelo multilingue...");
  configure({ modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED });

  const globalResult = await decide({
    state: { feedback: "Adorei a velocidade da plataforma, super intuitiva e facil!" },
    choices: {
      positivo: "elogios, satisfacao do usuario e feedback favoravel",
      neutro: "observacoes gerais sem teor emocional claro",
      negativo: "reclamacoes, insatisfacao ou frustracao",
    },
    task: "analisar o sentimento do feedback do cliente",
  });

  console.log(`   🏆 Sentimento detectado: ${globalResult.winner.toUpperCase()} (${(globalResult.confidence * 100).toFixed(1)}%)`);
  console.log("\n✨ Teste concluido com sucesso!");
}

main().catch(console.error);
