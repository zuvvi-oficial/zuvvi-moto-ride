// O vite-plugin-pwa escreve sw.js/workbox-*.js em "dist" (outDir configurado
// em vite.config.ts), mas cada preset do Nitro usado por este projeto
// publica de um diretório final diferente — e ao menos para o preset
// "vercel", o Nitro já moveu o conteúdo real de "dist" para o destino final
// ANTES do hook do vite-plugin-pwa rodar, deixando "dist" com só os arquivos
// do próprio service worker no fim do build. Não há hook de Vite/Nitro
// confiável para ordenar isso corretamente dentro de uma única invocação de
// `vite build` sem depender de detalhes internos do pacote gerenciado
// @lovable.dev/vite-tanstack-config — por isso este passo roda DEPOIS que
// `vite build` (incluindo todo o empacotamento do Nitro) já terminou por
// completo, e copia os arquivos para qualquer diretório de publicação final
// que exista.
//
// Sem isso, o navegador pedia /sw.js, esse caminho não existia nos
// estáticos publicados, a requisição caía no fallback para o servidor SSR
// (que devolve HTML), e o navegador rejeitava o registro do service worker
// — quebrando push e instalação como PWA silenciosamente, sem nenhum erro
// visível no build.
//
// JavaScript puro executado via `node` (não `bun scripts/....ts`): a
// plataforma de deploy que executa `bun run build` pode rodar esse comando
// composto num ambiente onde só o binário "node" (não "bun") está
// garantido no PATH depois que o passo `vite build` termina — usar Node
// aqui evita depender disso.

import { existsSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Mesma condição usada em vite.config.ts para o outDir do vite-plugin-pwa —
// precisa ficar em sincronia com aquele arquivo, porque é lá que a decisão
// real de onde os arquivos são escritos acontece. Dentro do sandbox de build
// do Lovable, @lovable.dev/vite-tanstack-config força o publicDir do Nitro
// para "dist/client" (tanto no preset "cloudflare-module" quanto no
// "lovable-fetch-bundle"); em todo outro alvo (Vercel, Netlify, CI sem
// preset) o publicDir real é "dist".
const SOURCE_DIR = process.env["LOVABLE_SANDBOX"] === "1" ? "dist/client" : "dist";
const SERVICE_WORKER_FILE_PATTERN = /^(sw\.js|workbox-.*\.js)$/;

// Um diretório de destino por preset do Nitro que este projeto realmente usa
// (Vercel em produção, Cloudflare/generic como padrão local e do CI). O
// preset Netlify publica "dist" diretamente, e o sandbox do Lovable publica
// "dist/client" diretamente (ambos já cobertos por SOURCE_DIR acima) — nos
// dois casos já é a origem, nada a copiar.
const TARGET_DIRS = [".vercel/output/static", ".output/public"];

function encontrarArquivosDoServiceWorker(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => SERVICE_WORKER_FILE_PATTERN.test(name));
}

const arquivos = encontrarArquivosDoServiceWorker(SOURCE_DIR);

if (arquivos.length === 0) {
  console.warn(
    `[publicar-service-worker] Nenhum arquivo de service worker encontrado em "${SOURCE_DIR}" — nada para publicar. Se o PWA está habilitado, isso é inesperado.`,
  );
  process.exit(0);
}

let publicadoEmAlgumDestino = false;
for (const targetDir of TARGET_DIRS) {
  if (!existsSync(targetDir)) continue;
  for (const arquivo of arquivos) {
    copyFileSync(join(SOURCE_DIR, arquivo), join(targetDir, arquivo));
  }
  console.log(`[publicar-service-worker] Copiado para ${targetDir}/: ${arquivos.join(", ")}`);
  publicadoEmAlgumDestino = true;
}

if (!publicadoEmAlgumDestino) {
  console.log(
    `[publicar-service-worker] Nenhum diretório de publicação conhecido (${TARGET_DIRS.join(", ")}) existe neste build — assumindo preset Netlify ou local, onde "${SOURCE_DIR}" já é o diretório final.`,
  );
}
