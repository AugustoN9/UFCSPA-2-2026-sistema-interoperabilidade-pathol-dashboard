import { ApiService } from './apiService.js';

const api = new ApiService();
let chartCidInstance = null;
let chartHpyloriInstance = null;

export async function carregarDashboard() {
    const statusEl = document.getElementById("status-api");
    try {
        statusEl.innerText = "Sincronizando com PatholAPI...";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";

        const exames = await api.buscarTodosExames();

        statusEl.innerText = "API Conectada";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";

        atualizarKPIsETabela(exames);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        statusEl.innerText = "Erro na API";
        statusEl.className = "px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
}

function atualizarKPIsETabela(exames) {
    document.getElementById("kpi-total").innerText = exames.length;

    const contagemCid = {};
    let hpyloriPos = 0;
    let hpyloriNeg = 0;

    exames.forEach(exame => {
        // Contagem de CIDs
        const cid = exame.cidSugerido || "N/I";
        contagemCid[cid] = (contagemCid[cid] || 0) + 1;

        // Análise de negatividade/positividade de H. pylori no Laudo
        const laudo = (exame.diagnosticoSugerido || "").toLowerCase();
        
        if (laudo.includes("pylori") || laudo.includes("giemsa") || laudo.includes("bacilos")) {
            if (laudo.includes("negativ") || laudo.includes("ausente") || laudo.includes("não detectad")) {
                hpyloriNeg++;
            } else if (laudo.includes("associad") || laudo.includes("positiv") || laudo.includes("presente")) {
                hpyloriPos++;
            }
        }
    });

    document.getElementById("kpi-gastrite").innerText = contagemCid["K29.5"] || 0;
    document.getElementById("kpi-melanoma").innerText = contagemCid["C43.5"] || 0;
    
    const totalPesquisados = hpyloriPos + hpyloriNeg;
    const taxaHpylori = totalPesquisados > 0 ? ((hpyloriPos / totalPesquisados) * 100).toFixed(0) : 0;
    document.getElementById("kpi-hpylori").innerText = `${taxaHpylori}%`;

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

    renderizarGraficos(contagemCid, hpyloriPos, hpyloriNeg);
}

function renderizarGraficos(cidsData, hpyloriPos, hpyloriNeg) {
    const ctxCid = document.getElementById('chartCid').getContext('2d');
    if (chartCidInstance) chartCidInstance.destroy();

    chartCidInstance = new Chart(ctxCid, {
        type: 'bar',
        data: {
            labels: Object.keys(cidsData),
            datasets: [{
                label: 'Exames',
                data: Object.values(cidsData),
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#334155' } }
            }
        }
    });

    const ctxHpylori = document.getElementById('chartHpylori').getContext('2d');
    if (chartHpyloriInstance) chartHpyloriInstance.destroy();

    chartHpyloriInstance = new Chart(ctxHpylori, {
        type: 'doughnut',
        data: {
            labels: ['Positivo (Giemsa)', 'Negativo'],
            datasets: [{
                data: [hpyloriPos, hpyloriNeg],
                backgroundColor: ['#10b981', '#64748b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
    });
}