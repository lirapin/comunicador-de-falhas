let historicoFalhas = [];
let chamados = [];
let opcaoIndicadoresSelecionada = null;
let opcaoDetalheSelecionada = null;
let modoAtual = 'visualizador';
let usuarioLogado = false;

function formatarTexto(texto) {
    if (!texto) return '';
    let formatado = texto.trim();
    formatado = formatado.replace(/\s+/g, ' ');
    formatado = formatado.replace(/\s+([.,!?;:])/g, '$1');
    formatado = formatado.replace(/([!?]){2,}/g, '$1');
    formatado = formatado.replace(/(\.){2,}/g, '$1');
    formatado = formatado.replace(/,{2,}/g, ',');
    formatado = formatado.toUpperCase();
    return formatado;
}

function salvarDados() {
    localStorage.setItem('historicoFalhas', JSON.stringify(historicoFalhas));
    localStorage.setItem('chamados', JSON.stringify(chamados));
}

function carregarDados() {
    const savedHistorico = localStorage.getItem('historicoFalhas');
    const savedChamados = localStorage.getItem('chamados');
    if (savedHistorico) historicoFalhas = JSON.parse(savedHistorico);
    if (savedChamados) chamados = JSON.parse(savedChamados);
    atualizarTabelaHistorico();
    atualizarTabelaChamados();
    atualizarFiltros();
}

function atualizarFiltros() {
    const titulosUnicos = [...new Set(historicoFalhas.map(f => f.titulo))];
    const selectFiltro = document.getElementById('filtro-titulo');
    selectFiltro.innerHTML = '<option value="">Todos</option>' +
        titulosUnicos.map(t => `<option value="${t}">${t.length > 50 ? t.substring(0, 50) + '...' : t}</option>`).join('');
}

function aplicarFiltros() {
    const filtroTitulo = document.getElementById('filtro-titulo').value;
    const filtroCluster = document.getElementById('filtro-cluster').value;
    const filtroIncidente = document.getElementById('filtro-incidente').value.toLowerCase();
    const filtroTask = document.getElementById('filtro-task').value.toLowerCase();
    const filtroRec = document.getElementById('filtro-rec').value.toLowerCase();
    const filtroSistema = document.getElementById('filtro-sistema').value.toLowerCase();

    let filtrados = [...historicoFalhas];

    if (filtroTitulo) filtrados = filtrados.filter(f => f.titulo === filtroTitulo);
    if (filtroCluster) filtrados = filtrados.filter(f => f.cluster === filtroCluster);
    if (filtroIncidente) filtrados = filtrados.filter(f => f.incidente.toLowerCase().includes(filtroIncidente));
    if (filtroTask) filtrados = filtrados.filter(f => f.taskOuSistema.toLowerCase().includes(filtroTask));
    if (filtroRec) filtrados = filtrados.filter(f => f.taskOuSistema.toLowerCase().includes('rec') && f.taskOuSistema.toLowerCase().includes(filtroRec));
    if (filtroSistema) filtrados = filtrados.filter(f => f.taskOuSistema.toLowerCase().includes(filtroSistema));

    const corpo = document.getElementById('corpo-historico');
    if (filtrados.length === 0) {
        corpo.innerHTML = '<tr><td colspan="' + (modoAtual === 'admin' ? '6' : '5') + '" style="text-align: center;">Nenhum registro encontrado</td>' + (modoAtual === 'admin' ? '<td class="oculto"></td>' : '') + '</tr>';
        return;
    }

    corpo.innerHTML = filtrados.map((falha) => `
        <tr>
            <td>${falha.dataHora}</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${falha.titulo}</td>
            <td>${falha.cluster}</td>
            <td>${falha.incidente || 'N/A'}</td>
            <td>${falha.taskOuSistema}</td>
            ${modoAtual === 'admin' ? `<td><button class="btn-secundario" style="padding: 6px 10px; background: #e74c3c; color: white; border-radius: 10px;" onclick="deletarRegistro(${falha.id})"><i class="fas fa-trash"></i></button></td>` : ''}
        </tr>
    `).join('');

    const colunaAcao = document.getElementById('coluna-acao-historico');
    if (modoAtual === 'admin') colunaAcao.classList.remove('oculto');
    else colunaAcao.classList.add('oculto');
}

function atualizarTabelaHistorico() {
    const corpo = document.getElementById('corpo-historico');
    const colunaAcao = document.getElementById('coluna-acao-historico');
    if (modoAtual === 'admin') colunaAcao.classList.remove('oculto');
    else colunaAcao.classList.add('oculto');

    if (historicoFalhas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="' + (modoAtual === 'admin' ? '6' : '5') + '" style="text-align: center;">Nenhum registro encontrado</td>' + (modoAtual === 'admin' ? '<td class="oculto"></td>' : '') + '</tr>';
        return;
    }

    corpo.innerHTML = historicoFalhas.map(falha => `
        <tr>
            <td>${falha.dataHora}</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${falha.titulo}</td>
            <td>${falha.cluster}</td>
            <td>${falha.incidente || 'N/A'}</td>
            <td>${falha.taskOuSistema}</td>
            ${modoAtual === 'admin' ? `<td><button class="btn-secundario" style="padding: 6px 10px; background: #e74c3c; color: white; border-radius: 10px;" onclick="deletarRegistro(${falha.id})"><i class="fas fa-trash"></i></button></td>` : ''}
        </tr>
    `).join('');
}

function deletarRegistro(id) {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
        historicoFalhas = historicoFalhas.filter(f => f.id !== id);
        salvarDados();
        atualizarTabelaHistorico();
        atualizarFiltros();
        mostrarToast('Registro excluído com sucesso!');
    }
}

/* ─────────────────────────────────────────────────────────────
   CHAMADOS — converte "DD/MM/AAAA HH:MM" ↔ inputs date/time
───────────────────────────────────────────────────────────── */

/**
 * "30/04/2026 14:30" → { date: "2026-04-30", time: "14:30" }
 * Retorna { date: '', time: '' } se vazio ou inválido.
 */
function encStringParaInputs(str) {
    if (!str) return { date: '', time: '' };
    const partes = str.split(' ');
    if (partes.length !== 2) return { date: '', time: '' };
    const dp = partes[0].split('/');
    if (dp.length !== 3) return { date: '', time: '' };
    return {
        date: `${dp[2]}-${dp[1]}-${dp[0]}`,
        time: partes[1]
    };
}

/**
 * Lê os dois inputs de um chamado e salva no objeto.
 * Chamado automaticamente no onchange dos inputs.
 */
function salvarEncerramento(id) {
    const dataInput = document.getElementById(`enc-data-${id}`);
    const horaInput = document.getElementById(`enc-hora-${id}`);
    if (!dataInput || !horaInput) return;

    const dataVal = dataInput.value;   // YYYY-MM-DD
    const horaVal = horaInput.value;   // HH:MM

    // Só salva quando ambos estiverem preenchidos
    if (!dataVal || !horaVal) return;

    const dp = dataVal.split('-');
    const dataFormatada = `${dp[2]}/${dp[1]}/${dp[0]}`;
    const dataEncerramento = `${dataFormatada} ${horaVal}`;

    const chamado = chamados.find(c => c.id === id);
    if (chamado) {
        chamado.dataEncerramento = dataEncerramento;
        salvarDados();
        mostrarToast('Encerramento salvo!');
    }
}

function atualizarTabelaChamados() {
    const corpo = document.getElementById('corpo-chamados');
    const colunaAcao = document.getElementById('coluna-acao-chamados');
    if (modoAtual === 'admin') colunaAcao.classList.remove('oculto');
    else colunaAcao.classList.add('oculto');

    if (chamados.length === 0) {
        corpo.innerHTML = '<tr><td colspan="' + (modoAtual === 'admin' ? '5' : '4') + '" style="text-align: center;">Nenhum chamado registrado</td></tr>';
        return;
    }

    corpo.innerHTML = chamados.map(chamado => {
        // Converte valor armazenado para os inputs nativos
        const enc = encStringParaInputs(chamado.dataEncerramento);

        return `
        <tr>
            <td>${chamado.dataHora}</td>
            <td>${chamado.numero}</td>
            <td>${chamado.motivo}</td>
            <td>
                <div class="enc-wrapper">
                    <input type="date"
                           id="enc-data-${chamado.id}"
                           class="enc-data-input"
                           value="${enc.date}"
                           onchange="salvarEncerramento(${chamado.id})">
                    <input type="time"
                           id="enc-hora-${chamado.id}"
                           class="enc-hora-input"
                           value="${enc.time}"
                           onchange="salvarEncerramento(${chamado.id})">
                    <button class="btn-grafico-icone"
                            onclick="verRelatorioChamado(${chamado.id})"
                            title="Ver relatório">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                </div>
            </td>
            ${modoAtual === 'admin' ? `<td><button class="btn-secundario" style="padding: 6px 10px; background: #e74c3c; color: white; border-radius: 10px;" onclick="deletarChamado(${chamado.id})"><i class="fas fa-trash"></i></button></td>` : ''}
        </tr>`;
    }).join('');
}

function verRelatorioChamado(id) {
    const chamado = chamados.find(c => c.id === id);
    if (!chamado || !chamado.dataEncerramento) {
        mostrarToast('Defina a data de encerramento do chamado primeiro!');
        return;
    }

    const dataAbertura = converterStringParaData(chamado.dataHora);
    const dataEncerramento = converterStringParaData(chamado.dataEncerramento);

    if (!dataAbertura || !dataEncerramento) {
        mostrarToast('Erro ao converter datas!');
        return;
    }

    const falhasNoPeriodo = historicoFalhas.filter(falha => {
        const dataFalha = converterStringParaData(falha.dataHora);
        return dataFalha >= dataAbertura && dataFalha <= dataEncerramento;
    });

    const modal = document.getElementById('modal-relatorio');
    document.getElementById('periodo-datas').innerHTML =
        `<strong>Abertura:</strong> ${chamado.dataHora}<br><strong>Encerramento:</strong> ${chamado.dataEncerramento}`;
    document.getElementById('contagem-falhas').textContent = falhasNoPeriodo.length;
    modal.style.display = 'flex';
}

function converterStringParaData(dataStr) {
    const partes = dataStr.split(' ');
    const dataPartes = partes[0].split('/');
    const horaPartes = partes[1].split(':');
    return new Date(
        parseInt(dataPartes[2]),
        parseInt(dataPartes[1]) - 1,
        parseInt(dataPartes[0]),
        parseInt(horaPartes[0]),
        parseInt(horaPartes[1])
    );
}

function deletarChamado(id) {
    if (confirm('Tem certeza que deseja excluir este chamado?')) {
        chamados = chamados.filter(c => c.id !== id);
        salvarDados();
        atualizarTabelaChamados();
        mostrarToast('Chamado excluído com sucesso!');
    }
}

function mostrarToast(mensagem) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${mensagem}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function mudarTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    if (tab === 'registro') {
        tabs[0].classList.add('active');
        document.getElementById('tab-registro').classList.add('active');
    } else if (tab === 'chamados') {
        tabs[1].classList.add('active');
        document.getElementById('tab-chamados').classList.add('active');
        atualizarTabelaChamados();
    } else {
        tabs[2].classList.add('active');
        document.getElementById('tab-historico').classList.add('active');
        aplicarFiltros();
    }
}

function criarAbaDinamica() {
    const container = document.getElementById('container-aba-dinamica');
    container.innerHTML = '';
    opcaoIndicadoresSelecionada = null;
    opcaoDetalheSelecionada = null;
    container.innerHTML = `
        <div class="indicadores-container">
            <div class="indicador-coluna" id="coluna-indicador">
                <div class="indicador-card">
                    <div class="indicador-titulo">Tipo de indicador</div>
                    <div class="opcoes-container">
                        <div class="opcao-radio" onclick="selecionarIndicador(this, 'Etit')">
                            <input type="radio" name="indicador" value="Etit"><label>Etit</label>
                        </div>
                        <div class="opcao-radio" onclick="selecionarIndicador(this, 'Chat')">
                            <input type="radio" name="indicador" value="Chat"><label>Chat</label>
                        </div>
                        <div class="opcao-radio" onclick="selecionarIndicador(this, 'Tarefa cancelada')">
                            <input type="radio" name="indicador" value="Tarefa cancelada"><label>Tarefa cancelada</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="indicador-coluna" id="coluna-detalhe">
                <div class="indicador-card" style="background: #f0f0f0;">
                    <div class="indicador-titulo">Selecione o detalhamento</div>
                    <div class="opcoes-container" id="opcoes-detalhe-container">
                        <div style="padding: 10px; text-align: center; color: var(--text-light); font-size: 12px;">Selecione um tipo de indicador primeiro</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function selecionarIndicador(element, valor) {
    const radios = document.querySelectorAll('#coluna-indicador input[name="indicador"]');
    radios.forEach(radio => {
        radio.checked = false;
        radio.parentElement.style.background = 'white';
        radio.parentElement.classList.remove('selected');
    });
    const radio = element.querySelector('input');
    radio.checked = true;
    element.style.background = 'var(--secondary-color)';
    element.classList.add('selected');
    opcaoIndicadoresSelecionada = valor;

    let opcoesDetalhe = [];
    if (valor === 'Tarefa cancelada') {
        opcoesDetalhe = ['Erro de abertura', 'Alarme improcedente', 'Agrupamento de incidente', 'Normalizado sem intervenção'];
    } else if (valor === 'Chat' || valor === 'Etit') {
        opcoesDetalhe = ['Alta demanda', 'Ferramenta inoperante', 'Falta de energia/internet na residência'];
    }

    const containerDetalhe = document.getElementById('opcoes-detalhe-container');
    if (opcoesDetalhe.length > 0) {
        containerDetalhe.innerHTML = opcoesDetalhe.map(op => `
            <div class="opcao-radio" onclick="selecionarDetalhe(this, '${op}')">
                <input type="radio" name="detalhe" value="${op}"><label>${op}</label>
            </div>
        `).join('');
        opcaoDetalheSelecionada = null;
    } else {
        containerDetalhe.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-light); font-size: 12px;">Opções indisponíveis</div>';
    }
}

function selecionarDetalhe(element, valor) {
    const radios = document.querySelectorAll('#opcoes-detalhe-container input[name="detalhe"]');
    radios.forEach(radio => {
        radio.checked = false;
        radio.parentElement.style.background = 'white';
        radio.parentElement.classList.remove('selected');
    });
    const radio = element.querySelector('input');
    radio.checked = true;
    element.style.background = 'var(--secondary-color)';
    element.classList.add('selected');
    opcaoDetalheSelecionada = valor;
}

function alternarTaskSistema(tituloSelecionado) {
    const taskContainer = document.getElementById('campo-task-container');
    const sistemaContainer = document.getElementById('campo-sistema-container');
    const taskLabel = document.getElementById('task-label');
    const clusterSelect = document.getElementById('cluster');

    if (tituloSelecionado === 'Falha sistêmica') {
        clusterSelect.value = 'N/A';
        clusterSelect.disabled = true;
        taskContainer.classList.add('oculto');
        sistemaContainer.classList.remove('oculto');
    } else {
        clusterSelect.disabled = false;
        if (tituloSelecionado === 'Rec em dp') {
            taskContainer.classList.remove('oculto');
            sistemaContainer.classList.add('oculto');
            taskLabel.textContent = 'Rec';
            document.getElementById('task').placeholder = '';
        } else {
            taskContainer.classList.remove('oculto');
            sistemaContainer.classList.add('oculto');
            taskLabel.textContent = 'Task';
            document.getElementById('task').placeholder = '';
        }
    }
}

function isTaskObrigatoria(titulo) {
    const titulosSemTask = ['Ocorrência não encerrada', 'Falha no escalonamento', 'Falha na atualização', 'Abrangência', 'Outros'];
    return !titulosSemTask.includes(titulo);
}

function isIncidenteObrigatorio(titulo, indicador) {
    if (titulo === 'Falha sistêmica') return false;
    if (titulo === 'Indicadores') {
        if (indicador === 'Etit') return true;
        if (indicador === 'Tarefa cancelada') return true;
        return false;
    }
    return true;
}

document.getElementById('titulo-falha').addEventListener('change', function() {
    const campoOutros = document.getElementById('campo-outros-titulo');
    const containerAba = document.getElementById('container-aba-dinamica');
    const containerTitulo = document.getElementById('container-titulo-falha');
    const espacador = document.getElementById('espacador-titulo');
    const valorSelecionado = this.value;

    if (valorSelecionado === 'Indicadores') {
        containerTitulo.classList.remove('form-group-duas-colunas');
        containerTitulo.classList.add('form-group-tres-colunas');
        espacador.classList.add('oculto');
    } else {
        containerTitulo.classList.remove('form-group-tres-colunas');
        containerTitulo.classList.add('form-group-duas-colunas');
        espacador.classList.remove('oculto');
    }

    if (valorSelecionado === 'Outros') {
        campoOutros.classList.remove('oculto');
        campoOutros.classList.add('campo-outros-duas-colunas');
    } else {
        campoOutros.classList.add('oculto');
        campoOutros.classList.remove('campo-outros-duas-colunas');
        document.getElementById('outro-titulo').value = '';
    }

    if (valorSelecionado === 'Indicadores') {
        criarAbaDinamica();
    } else {
        containerAba.innerHTML = '';
        opcaoIndicadoresSelecionada = null;
        opcaoDetalheSelecionada = null;
    }

    alternarTaskSistema(valorSelecionado);
});

document.getElementById('sistema-afetado').addEventListener('change', function() {
    const campoOutros = document.getElementById('campo-outros-sistema');
    if (this.value === 'OUTROS') campoOutros.classList.remove('oculto');
    else {
        campoOutros.classList.add('oculto');
        document.getElementById('outro-sistema').value = '';
    }
});

document.getElementById('motivo-chamado').addEventListener('change', function() {
    const campoOutros = document.getElementById('campo-outros-motivo');
    if (this.value === 'OUTROS') campoOutros.classList.remove('oculto');
    else {
        campoOutros.classList.add('oculto');
        document.getElementById('outro-motivo').value = '';
    }
});

document.getElementById('descricao-falha').addEventListener('input', function() {
    const cursorPos = this.selectionStart;
    const formatted = formatarTexto(this.value);
    if (formatted !== this.value) {
        this.value = formatted;
        this.setSelectionRange(cursorPos, cursorPos);
    }
});

document.getElementById('botao-registrar-falha').addEventListener('click', function() {
    let titulo = document.getElementById('titulo-falha').value;
    if (!titulo) { mostrarToast('Por favor, selecione o título da falha!'); return; }

    if (titulo === 'Outros') {
        const outroTitulo = document.getElementById('outro-titulo').value;
        if (!outroTitulo) { mostrarToast('Por favor, especifique o tipo de falha!'); return; }
        titulo = outroTitulo;
    }

    const isIndicadores = document.getElementById('titulo-falha').value === 'Indicadores';
    if (isIndicadores) {
        if (!opcaoIndicadoresSelecionada) { mostrarToast('Por favor, selecione uma opção de indicador!'); return; }
        if (!opcaoDetalheSelecionada) { mostrarToast('Por favor, selecione o detalhamento da falha!'); return; }
        titulo = `Indicadores - ${opcaoIndicadoresSelecionada} - ${opcaoDetalheSelecionada}`;
    }

    const cluster = document.getElementById('cluster').value;
    const incidente = document.getElementById('incidente').value;
    let taskOuSistema = '';
    const isFalhasSistemicas = document.getElementById('titulo-falha').value === 'Falha sistêmica';
    const isRecEmDp = document.getElementById('titulo-falha').value === 'Rec em dp';
    const taskValue = document.getElementById('task').value;

    const taskObrigatoria = isTaskObrigatoria(document.getElementById('titulo-falha').value);
    if (!isFalhasSistemicas && !isRecEmDp && taskObrigatoria && !taskValue) {
        mostrarToast('Por favor, informe o número da task!');
        return;
    }

    const incidenteObrigatorio = isIncidenteObrigatorio(document.getElementById('titulo-falha').value, opcaoIndicadoresSelecionada);
    if (incidenteObrigatorio && !incidente) {
        mostrarToast('Por favor, informe o número do incidente!');
        return;
    }

    if (isFalhasSistemicas) {
        let sistema = document.getElementById('sistema-afetado').value;
        if (!sistema) { mostrarToast('Por favor, selecione o sistema afetado!'); return; }
        if (sistema === 'OUTROS') {
            const outroSistema = document.getElementById('outro-sistema').value;
            if (!outroSistema) { mostrarToast('Por favor, especifique o sistema afetado!'); return; }
            sistema = outroSistema;
        }
        taskOuSistema = `Sistema: ${sistema}`;
    } else if (isRecEmDp) {
        if (!taskValue) { mostrarToast('Por favor, informe o número do rec!'); return; }
        taskOuSistema = `Rec: ${taskValue}`;
    } else {
        taskOuSistema = taskObrigatoria ? `Task: ${taskValue}` : (taskValue ? `Task: ${taskValue}` : 'N/A');
    }

    if (!cluster) { mostrarToast('Por favor, selecione o cluster!'); return; }
    let descricao = document.getElementById('descricao-falha').value;
    if (!descricao) { mostrarToast('Por favor, preencha a descrição da falha!'); return; }
    descricao = formatarTexto(descricao);

    const data = document.getElementById('data-ocorrencia').value;
    const hora = document.getElementById('hora-ocorrencia').value;
    if (!data || !hora) { mostrarToast('Por favor, preencha data e hora da ocorrência!'); return; }
    const dataFormatada = new Date(data).toLocaleDateString('pt-BR');
    const dataHora = `${dataFormatada} ${hora}`;

    const novaFalha = {
        id: Date.now(),
        dataHora: dataHora,
        titulo: titulo,
        cluster: cluster,
        incidente: incidente || 'N/A',
        taskOuSistema: taskOuSistema,
        descricao: descricao
    };
    historicoFalhas.unshift(novaFalha);
    salvarDados();

    document.getElementById('titulo-falha').value = '';
    document.getElementById('cluster').value = '';
    document.getElementById('cluster').disabled = false;
    document.getElementById('incidente').value = '';
    document.getElementById('task').value = '';
    document.getElementById('sistema-afetado').value = '';
    document.getElementById('descricao-falha').value = '';
    document.getElementById('container-aba-dinamica').innerHTML = '';
    document.getElementById('campo-outros-titulo').classList.add('oculto');
    document.getElementById('campo-outros-sistema').classList.add('oculto');
    document.getElementById('campo-task-container').classList.remove('oculto');
    document.getElementById('campo-sistema-container').classList.add('oculto');
    document.getElementById('task-label').textContent = 'Task';
    document.getElementById('task').placeholder = '';
    opcaoIndicadoresSelecionada = null;
    opcaoDetalheSelecionada = null;

    const containerTitulo = document.getElementById('container-titulo-falha');
    containerTitulo.classList.remove('form-group-tres-colunas');
    containerTitulo.classList.add('form-group-duas-colunas');

    mostrarToast('Registro concluído! ✓');
    atualizarTabelaHistorico();
    atualizarFiltros();
    mudarTab('historico');
});

document.getElementById('botao-registrar-chamado').addEventListener('click', function() {
    const numero = document.getElementById('numero-chamado').value;
    let motivo = document.getElementById('motivo-chamado').value;
    if (!numero) { mostrarToast('Por favor, informe o número do chamado!'); return; }
    if (!motivo) { mostrarToast('Por favor, selecione o motivo!'); return; }
    if (motivo === 'OUTROS') {
        const outroMotivo = document.getElementById('outro-motivo').value;
        if (!outroMotivo) { mostrarToast('Por favor, especifique o motivo!'); return; }
        motivo = outroMotivo;
    }
    const data = document.getElementById('data-ocorrencia').value;
    const hora = document.getElementById('hora-ocorrencia').value;
    const dataFormatada = new Date(data).toLocaleDateString('pt-BR');
    const dataHora = `${dataFormatada} ${hora}`;
    const novoChamado = { id: Date.now(), dataHora: dataHora, numero: numero, motivo: motivo, dataEncerramento: '' };
    chamados.unshift(novoChamado);
    salvarDados();
    document.getElementById('numero-chamado').value = '';
    document.getElementById('motivo-chamado').value = '';
    document.getElementById('campo-outros-motivo').classList.add('oculto');
    document.getElementById('outro-motivo').value = '';
    mostrarToast('Chamado registrado! ✓');
    atualizarTabelaChamados();
});

document.getElementById('btn-modo-visualizador').addEventListener('click', function() {
    modoAtual = 'visualizador';
    usuarioLogado = false;
    document.getElementById('btn-modo-visualizador').classList.add('ativo');
    document.getElementById('btn-modo-adm').classList.remove('ativo');
    document.getElementById('btn-logout').classList.add('oculto');
    atualizarTabelaHistorico();
    atualizarTabelaChamados();
    mostrarToast('Modo visualizador ativado');
});

const modal = document.getElementById('modal-login');
document.getElementById('btn-modo-adm').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('btn-fechar-modal').addEventListener('click', () => modal.style.display = 'none');
document.getElementById('btn-login').addEventListener('click', function() {
    const usuario = document.getElementById('login-usuario').value;
    const senha = document.getElementById('login-senha').value;
    if (usuario === 'claro123' && senha === 'claro123') {
        modal.style.display = 'none';
        modoAtual = 'admin';
        usuarioLogado = true;
        document.getElementById('btn-modo-adm').classList.add('ativo');
        document.getElementById('btn-modo-visualizador').classList.remove('ativo');
        document.getElementById('btn-logout').classList.remove('oculto');
        atualizarTabelaHistorico();
        atualizarTabelaChamados();
        mostrarToast('Modo administrador ativado');
    } else alert('Usuário ou senha incorretos!');
});

document.getElementById('btn-logout').addEventListener('click', function() {
    modoAtual = 'visualizador';
    usuarioLogado = false;
    document.getElementById('btn-modo-visualizador').classList.add('ativo');
    document.getElementById('btn-modo-adm').classList.remove('ativo');
    document.getElementById('btn-logout').classList.add('oculto');
    atualizarTabelaHistorico();
    atualizarTabelaChamados();
    mostrarToast('Logout realizado com sucesso!');
});

document.getElementById('aplicar-filtros').addEventListener('click', aplicarFiltros);

document.getElementById('limpar-filtros').addEventListener('click', function() {
    document.getElementById('filtro-titulo').value = '';
    document.getElementById('filtro-cluster').value = '';
    document.getElementById('filtro-incidente').value = '';
    document.getElementById('filtro-task').value = '';
    document.getElementById('filtro-sistema').value = '';
    document.getElementById('filtro-rec').value = '';
    aplicarFiltros();
    mostrarToast('Filtros limpos');
});

document.getElementById('btn-relatorio').addEventListener('click', function() {
    mostrarToast('Funcionalidade de gráfico em desenvolvimento!');
});

document.getElementById('btn-fechar-relatorio').addEventListener('click', function() {
    document.getElementById('modal-relatorio').style.display = 'none';
});

function inicializarDataHora() {
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date();
    const horas = agora.getHours().toString().padStart(2, '0');
    const minutos = agora.getMinutes().toString().padStart(2, '0');
    document.getElementById('data-ocorrencia').value = hoje;
    document.getElementById('hora-ocorrencia').value = `${horas}:${minutos}`;
}

inicializarDataHora();
carregarDados();
document.getElementById('btn-modo-visualizador').classList.add('ativo');
