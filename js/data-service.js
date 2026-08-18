(function criarDataService(global) {
    'use strict';

    const defaultSupabaseUrl = 'https://aaxdcpftynjphzitigrv.supabase.co';
    const defaultSupabasePublishableKey = 'sb_publishable_qJaICKj1Ro-tO3DPqtr9TA_9cFFccCS';

    function obterConfig() {
        if (global.APP_CONFIG && typeof global.APP_CONFIG === 'object') {
            return global.APP_CONFIG;
        }
        return {
            supabaseUrl: defaultSupabaseUrl,
            supabasePublishableKey: defaultSupabasePublishableKey
        };
    }

    let client = null;
    const imageBucket = 'failure-portal-images';
    const imageTypes = Object.freeze({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    });
    const maxImageSize = 5 * 1024 * 1024;
    const loginAliases = Object.freeze({
        madrugada: 'madrugada@comunicador.invalid'
    });

    function configurado() {
        const cfg = obterConfig();
        return Boolean(
            global.supabase &&
            /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') &&
            typeof cfg.supabasePublishableKey === 'string' &&
            cfg.supabasePublishableKey.length > 20
        );
    }

    function obterClient() {
        if (!global.supabase) {
            throw new Error('Biblioteca de conexão com o banco não carregada. Verifique sua conexão ou recarregue a página.');
        }
        if (!configurado()) {
            throw new Error('Servidor não configurado. Informe a URL e a publishable key em js/config.js.');
        }
        if (!client) {
            const cfg = obterConfig();
            client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
            });
        }
        return client;
    }

    function propagarErro(error, contexto) {
        if (!error) return;
        const mensagem = error.message || String(error);
        throw new Error(`${contexto}: ${mensagem}`);
    }

    function formatarDataHora(iso) {
        if (!iso) return '';
        const data = new Date(iso);
        if (Number.isNaN(data.getTime())) return '';
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(data);
    }

    function paraIso(data, hora) {
        const valor = new Date(`${data}T${hora}:00`);
        if (Number.isNaN(valor.getTime())) throw new Error('Data ou hora inválida.');
        return valor.toISOString();
    }

    function dataBrParaIso(valor) {
        const match = String(valor || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
        if (!match) return null;
        return paraIso(`${match[3]}-${match[2]}-${match[1]}`, `${match[4]}:${match[5]}`);
    }

    function mapearFalha(row) {
        return {
            id: row.id,
            dataHora: formatarDataHora(row.occurred_at),
            dataIso: row.occurred_at,
            titulo: row.title,
            cluster: row.cluster,
            incidente: row.incident || 'N/A',
            taskOuSistema: row.task_or_system || 'N/A',
            descricao: row.description,
            reporterName: row.reporter_name || 'Equipe Madrugada',
            anexoPath: row.attachment_path || null,
            anexoNome: row.attachment_name || null,
            anexoMime: row.attachment_mime || null,
            anexoTamanho: row.attachment_size || null
        };
    }

    function mapearChamado(row) {
        return {
            id: row.id,
            dataHora: formatarDataHora(row.opened_at),
            dataIso: row.opened_at,
            numero: row.ticket_number,
            motivo: row.reason,
            dataEncerramento: formatarDataHora(row.closed_at),
            encerramentoIso: row.closed_at,
            reporterName: row.reporter_name || 'Equipe Madrugada',
            descricaoEvento: row.event_description || 'NÃO INFORMADA'
        };
    }

    const failureSelect = 'id,occurred_at,title,cluster,incident,task_or_system,description,attachment_path,attachment_name,attachment_mime,attachment_size,reporter_name';
    const ticketSelect = 'id,opened_at,closed_at,ticket_number,reason,event_description,reporter_name';

    async function sessaoAtual() {
        if (!configurado()) return null;
        const supabaseClient = obterClient();
        if (typeof supabaseClient.auth?.getSession === 'function') {
            const { data, error } = await supabaseClient.auth.getSession();
            propagarErro(error, 'Falha ao verificar a sessão');
            return data.session;
        }
        if (typeof supabaseClient.auth?.getUser === 'function') {
            const { data, error } = await supabaseClient.auth.getUser();
            propagarErro(error, 'Falha ao verificar o usuário');
            return data.user ? { user: data.user } : null;
        }
        return null;
    }

    async function entrar(identificador, senha) {
        const loginNormalizado = String(identificador || '').trim().toLowerCase();
        const email = loginAliases[loginNormalizado] || loginNormalizado;
        const { data, error } = await obterClient().auth.signInWithPassword({ email, password: senha });
        propagarErro(error, 'Não foi possível entrar');
        return data.session;
    }

    async function obterIdentidade(userId) {
        if (!userId) throw new Error('Sessão inválida para verificar o acesso.');
        const supabaseClient = obterClient();
        const [acessoResult, perfilResult] = await Promise.all([
            supabaseClient.from('failure_portal_memberships').select('role').eq('user_id', userId).maybeSingle(),
            supabaseClient.from('failure_portal_profiles').select('display_name').eq('user_id', userId).maybeSingle()
        ]);
        propagarErro(acessoResult.error, 'Falha ao verificar o acesso ao Comunicador');
        propagarErro(perfilResult.error, 'Falha ao identificar o usuário do Comunicador');
        return {
            role: acessoResult.data?.role || null,
            displayName: perfilResult.data?.display_name || null
        };
    }

    async function obterAcesso(userId) {
        return (await obterIdentidade(userId)).role;
    }

    async function sair() {
        const { error } = await obterClient().auth.signOut();
        propagarErro(error, 'Não foi possível encerrar a sessão');
    }

    function observarAuth(callback) {
        if (!configurado()) return () => {};
        const { data } = obterClient().auth.onAuthStateChange((_event, session) => callback(session));
        return () => data.subscription.unsubscribe();
    }

    async function listarTudo() {
        const supabaseClient = obterClient();
        const [falhasResult, chamadosResult] = await Promise.all([
            supabaseClient.from('failure_portal_reports').select(failureSelect).order('occurred_at', { ascending: false }),
            supabaseClient.from('failure_portal_tickets').select(ticketSelect).order('opened_at', { ascending: false })
        ]);
        propagarErro(falhasResult.error, 'Falha ao carregar os registros');
        propagarErro(chamadosResult.error, 'Falha ao carregar os chamados');
        return {
            falhas: (falhasResult.data || []).map(mapearFalha),
            chamados: (chamadosResult.data || []).map(mapearChamado)
        };
    }

    function validarImagem(file) {
        if (!file) throw new Error('Nenhum arquivo de imagem foi selecionado.');
        if (!imageTypes[file.type]) throw new Error('Formato de imagem inválido. Use JPG, PNG, WEBP ou GIF.');
        if (file.size > maxImageSize) throw new Error('A imagem deve ter no máximo 5 MB.');
    }

    function gerarCaminhoStorage(userId, reportId, file) {
        const extensao = imageTypes[file.type] || 'bin';
        const fileId = global.crypto?.randomUUID?.() || Date.now().toString(36);
        return `${userId}/${reportId}/${fileId}.${extensao}`;
    }

    async function criarFalha(falha, imagem = null) {
        const supabaseClient = obterClient();
        const reportId = global.crypto?.randomUUID?.();
        if (!reportId) throw new Error('Ambiente sem suporte a crypto.randomUUID.');

        const session = await sessaoAtual();
        const userId = session?.user?.id;
        if (!userId) throw new Error('Sessão inválida para salvar o registro.');

        let attachmentPath = null;
        let attachmentName = null;
        let attachmentMime = null;
        let attachmentSize = null;

        if (imagem) {
            validarImagem(imagem);
            attachmentPath = gerarCaminhoStorage(userId, reportId, imagem);
            attachmentName = imagem.name;
            attachmentMime = imagem.type;
            attachmentSize = imagem.size;

            const { error: uploadError } = await supabaseClient.storage
                .from(imageBucket)
                .upload(attachmentPath, imagem, {
                    contentType: imagem.type,
                    upsert: false
                });
            propagarErro(uploadError, 'Não foi possível enviar a imagem');
        }

        const payload = {
            id: reportId,
            occurred_at: falha.occurredAt,
            title: falha.titulo,
            cluster: falha.cluster,
            incident: falha.incidente && falha.incidente !== 'N/A' ? falha.incidente : null,
            task_or_system: falha.taskOuSistema && falha.taskOuSistema !== 'N/A' ? falha.taskOuSistema : null,
            description: falha.descricao,
            reporter_name: falha.reporterName || 'Equipe Madrugada',
            attachment_path: attachmentPath,
            attachment_name: attachmentName,
            attachment_mime: attachmentMime,
            attachment_size: attachmentSize
        };

        const { data, error } = await supabaseClient
            .from('failure_portal_reports')
            .insert(payload)
            .select(failureSelect)
            .single();

        if (error) {
            if (attachmentPath) {
                await supabaseClient.storage.from(imageBucket).remove([attachmentPath]);
            }
            propagarErro(error, 'Não foi possível salvar o registro');
        }

        return mapearFalha(data);
    }

    async function criarUrlAnexo(storagePath) {
        if (!storagePath) throw new Error('Caminho de anexo inválido.');
        const { data, error } = await obterClient().storage
            .from(imageBucket)
            .createSignedUrl(storagePath, 60 * 60);
        propagarErro(error, 'Não foi possível carregar a imagem');
        return data.signedUrl;
    }

    async function excluirFalha(id, anexoPath = null) {
        const supabaseClient = obterClient();
        const { error } = await supabaseClient.from('failure_portal_reports').delete().eq('id', id);
        propagarErro(error, 'Não foi possível excluir o registro');

        if (anexoPath) {
            const { error: storageError } = await supabaseClient.storage.from(imageBucket).remove([anexoPath]);
            if (storageError) {
                return {
                    deleted: true,
                    cleanupWarning: 'Registro excluído, mas o arquivo de imagem precisará de limpeza posterior.'
                };
            }
        }
        return { deleted: true };
    }

    async function criarChamado(chamado) {
        const payload = {
            opened_at: chamado.openedAt,
            ticket_number: chamado.numero,
            reason: chamado.motivo,
            event_description: chamado.descricaoEvento
        };
        const { data, error } = await obterClient()
            .from('failure_portal_tickets')
            .insert(payload)
            .select(ticketSelect)
            .single();
        propagarErro(error, 'Não foi possível salvar o chamado');
        return mapearChamado(data);
    }

    async function encerrarChamado(id, closedAt) {
        const { data, error } = await obterClient()
            .from('failure_portal_tickets')
            .update({ closed_at: closedAt })
            .eq('id', id)
            .select(ticketSelect)
            .single();
        propagarErro(error, 'Não foi possível atualizar o chamado');
        return mapearChamado(data);
    }

    async function excluirChamado(id) {
        const { error } = await obterClient().from('failure_portal_tickets').delete().eq('id', id);
        propagarErro(error, 'Não foi possível excluir o chamado');
        return { deleted: true };
    }

    global.DataService = {
        configurado,
        sessaoAtual,
        entrar,
        obterAcesso,
        obterIdentidade,
        sair,
        observarAuth,
        listarTudo,
        criarFalha,
        salvarFalha: criarFalha,
        criarUrlAnexo,
        excluirFalha,
        criarChamado,
        encerrarChamado,
        excluirChamado,
        formatarDataHora,
        paraIso,
        dataBrParaIso,
        validarImagem
    };
})(typeof window !== 'undefined' ? window : globalThis);
