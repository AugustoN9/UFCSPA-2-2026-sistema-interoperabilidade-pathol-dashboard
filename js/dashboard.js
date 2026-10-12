import { ApiService } from './apiService.js';

const api = new ApiService();
let chartCidInstance = null;
let chartHpyloriInstance = null;

// Mapeamento interno de segurança para resposta instantânea dos CIDs da instituição
const DICIONARIO_LOCAL_CIDS = {
    'K29.5': 'Gastrite Crônica Não Especificada',
    'K29.3': 'Gastroduodenite Crônica',
    'K29.1': 'Outras Gastrites Agudas',
    'K29.7': 'Gastrite Não Especificada',
    'C43.5': 'Melanoma Maligno do Tronco',
    'C43.9': 'Melanoma Maligno Não Especificado'
};

const cacheCidDescricoes = {};

/**
 * Consulta a descrição do CID-10 priorizando o dicionário local e utilizando API da NLM como fallback.
 */
async function buscarDescricaoCid(cid) {
    if (!cid || cid === "N/I") return "Não Informado";
    if (cacheCidDescricoes[cid]) return cacheCidDescricoes[cid];

    // 1. Tenta obter do mapeamento local de alta performance
    if (DICIONARIO_LOCAL_CIDS[cid]) {
        cacheCidDescricoes[cid] = DICIONARIO_LOCAL_CIDS[cid];
        return DICIONARIO_LOCAL_CIDS[cid];
    }

    // 2. Consulta a API pública da NLM (Clinical Tables) se o código for inédito
    try {
        const response = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?terms=${encodeURIComponent(cid)}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data[3] && data[3].length > 0) {
                const descricaoApi = data[3][0][1]; // Retorna descrição oficial
                cacheCidDescricoes[cid] = descricaoApi;
                return descricaoApi;
            }
        }
    } catch (error) {
        console.warn(`Erro ao consultar API externa para o CID ${cid}:`, error);
    }

    return "Diagnóstico Histopatológico";
}

export async function carregarDashboard() {
    const statusEl = document.getElementById("status-api");
    try {
        statusEl.innerText = "Sincronizando com PatholAPI...";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";

        const exames = await api.buscarTodosExames();

        statusEl.innerText = "API Conectada";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";

        await atualizarKPIsETabela(exames);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        statusEl.innerText = "Erro na API";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
}

function obterIntervaloDatas(exames) {
    const anos = exames
        .map(e => e.dataLiberacaoLaudo ? new Date(e.dataLiberacaoLaudo).getFullYear() : null)
        .filter(ano => ano !== null);

    if (anos.length === 0) return "Período Não Informado";
    const minAno = Math.min(...anos);
    const maxAno = Math.max(...anos);
    return minAno === maxAno ? `${minAno}` : `${minAno} – ${maxAno}`;
}

async function atualizarKPIsETabela(exames) {
    document.getElementById("kpi-total").innerText = exames.length;

    const contagemCid = {};
    let hpyloriPos = 0;
    let hpyloriNeg = 0;

    exames.forEach(exame => {
        const cid = exame.cidSugerido || "N/I";
        contagemCid[cid] = (contagemCid[cid] || 0) + 1;

        const laudo = (exame.diagnosticoSugerido || "").toLowerCase();
        
        if (laudo.includes("pylori") || laudo.includes("giemsa") || laudo.includes("bacilos")) {
            if (laudo.includes("negativ") || laudo.includes("ausente") || laudo.includes("não detectad")) {
                hpyloriNeg++;
            } else if (laudo.includes("associad") || laudo.includes("positiv") || laudo.includes("presente")) {
                hpyloriPos++;
            }
        }
    });

    // Resolve as descrições dos CIDs para os tooltips
    const listaCids = Object.keys(contagemCid);
    await Promise.all(listaCids.map(cid => buscarDescricaoCid(cid)));

    document.getElementById("kpi-gastrite").innerText = contagemCid["K29.5"] || 0;
    document.getElementById("kpi-melanoma").innerText = contagemCid["C43.5"] || 0;
    
    const totalPesquisados = hpyloriPos + hpyloriNeg;
    const taxaHpylori = totalPesquisados > 0 ? ((hpyloriPos / totalPesquisados) * 100).toFixed(0) : 0;
    document.getElementById("kpi-hpylori").innerText = `${taxaHpylori}%`;

    const periodoTexto = obterIntervaloDatas(exames);

    const contextoEl = document.getElementById("contexto-amostra");
    if (contextoEl) {
        contextoEl.innerHTML = `
            <div><span class="text-slate-400 block text-xs">UNIDADE</span><strong class="text-white">Patologia - UFCSPA</strong></div>
            <div><span class="text-slate-400 block text-xs">PERÍODO</span><strong class="text-white">${periodoTexto}</strong></div>
            <div><span class="text-slate-400 block text-xs">COORTE</span><strong class="text-white">Pediátrica (PED) & Dermatológica (DERM)</strong></div>
            <div><span class="text-slate-400 block text-xs">ABRANGÊNCIA GEOGRÁFICA</span><strong class="text-white">Porto Alegre / RS</strong></div>
        `;
    }

    const tbody = document.getElementById("tabela-corpo");
    tbody.innerHTML = exames.map(exame => `
        <tr class="hover:bg-slate-700/30 border-b border-slate-700/50">
            <td class="p-3 font-mono text-indigo-300 font-medium">${exame.numeroExame}</td>
            <td class="p-3 font-semibold text-slate-200">${exame.pacienteProntuario}</td>
            <td class="p-3"><span class="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-mono">${exame.cidSugerido}</span></td>
            <td class="p-3 text-slate-300 truncate max-w-xs" title="${exame.diagnosticoSugerido}">${exame.diagnosticoSugerido}</td>
            <td class="p-3 text-slate-400">${exame.frascos ? exame.frascos.length : 0} amostra(s)</td>
            <td class="p-3 text-slate-400">${exame.dataLiberacaoLaudo ? new Date(exame.dataLiberacaoLaudo).toLocaleDateString('pt-BR') : 'Pendente'}</td>
        </tr>
    `).join('');

    renderizarGraficos(contagemCid, hpyloriPos, hpyloriNeg, periodoTexto);
}

function renderizarGraficos(cidsData, hpyloriPos, hpyloriNeg, periodoTexto) {
    // 1. Gráfico de CIDs (Bar Chart)
    const ctxCid = document.getElementById('chartCid').getContext('2d');
    if (chartCidInstance) chartCidInstance.destroy();

    chartCidInstance = new Chart(ctxCid, {
        type: 'bar',
        data: {
            labels: Object.keys(cidsData),
            datasets: [{
                label: 'Nº de Casos',
                data: Object.values(cidsData),
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Prevalência Diagnóstica (${periodoTexto}) — Coorte Integrada UFCSPA`,
                    color: '#94a3b8',
                    font: { size: 12, weight: 'normal' }
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            if (!tooltipItems.length) return '';
                            const cid = tooltipItems[0].label;
                            const descricao = cacheCidDescricoes[cid] || 'Diagnóstico Histopatológico';
                            return `${cid} — ${descricao}`;
                        },
                        label: function(context) {
                            return ` Total: ${context.raw} caso(s)`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } }
            }
        }
    });

    // 2. Gráfico H. Pylori (Doughnut Chart)
    const ctxHpylori = document.getElementById('chartHpylori').getContext('2d');
    if (chartHpyloriInstance) chartHpyloriInstance.destroy();

    const totalHpylori = hpyloriPos + hpyloriNeg;
    const pctPos = totalHpylori > 0 ? ((hpyloriPos / totalHpylori) * 100).toFixed(1) : "0.0";
    const pctNeg = totalHpylori > 0 ? ((hpyloriNeg / totalHpylori) * 100).toFixed(1) : "0.0";

    chartHpyloriInstance = new Chart(ctxHpylori, {
        type: 'doughnut',
        data: {
            labels: [
                `Positivo (Giemsa): ${hpyloriPos} (${pctPos}%)`,
                `Negativo: ${hpyloriNeg} (${pctNeg}%)`
            ],
            datasets: [{
                data: [hpyloriPos, hpyloriNeg],
                backgroundColor: ['#10b981', '#64748b'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', font: { size: 13, weight: '500' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const pct = totalHpylori > 0 ? ((val / totalHpylori) * 100).toFixed(1) : 0;
                            const status = context.dataIndex === 0 ? "Positivo (Giemsa)" : "Negativo";
                            return ` ${status}: ${val} casos (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}