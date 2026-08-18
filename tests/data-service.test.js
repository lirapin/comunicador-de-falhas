const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'data-service.js'), 'utf8');

function carregarServico({ config = {}, client = {} } = {}) {
    let uuidCounter = 0;
    const window = {
        APP_CONFIG: config,
        location: { origin: 'https://example.test', pathname: '/comunicador/' },
        supabase: { createClient: () => client },
        crypto: { randomUUID: () => `uuid-${++uuidCounter}` }
    };
    vm.runInNewContext(source, { window, URL, Intl, Date, Error, Object, Array, String, Boolean, Promise });
    return window.DataService;
}

test('recusa inicialização sem URL e publishable key', () => {
    const service = carregarServico();
    assert.equal(service.configurado(), false);
    assert.throws(() => service.paraIso('invalida', '10:00'), /Data ou hora inválida/);
});

test('carrega falhas e chamados sem expor o identificador do autor', async () => {
    const rows = {
        failure_portal_reports: [{
            id: 'f1',
            occurred_at: '2026-08-11T12:00:00.000Z',
            title: 'FALHA SISTÊMICA',
            cluster: 'N/A',
            incident: null,
            task_or_system: 'Sistema: SIR',
            description: 'TESTE',
            attachment_path: 'u1/f1/imagem.png',
            attachment_name: 'imagem.png',
            attachment_mime: 'image/png',
            attachment_size: 1024,
            reporter_name: 'Equipe Madrugada'
        }],
        failure_portal_tickets: [{
            id: 't1',
            opened_at: '2026-08-11T11:00:00.000Z',
            closed_at: null,
            ticket_number: 'CH-1',
            reason: 'SIR',
            event_description: 'INOPERANTE',
            reporter_name: 'Kelly Lira'
        }]
    };
    const client = {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }) },
        from(table) {
            return {
                select() {
                    return { order: async () => ({ data: rows[table], error: null }) };
                }
            };
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'x'.repeat(30)}`
        },
        client
    });

    assert.equal(service.configurado(), true);
    assert.equal((await service.sessaoAtual()).user.id, 'u1');
    const dados = await service.listarTudo();
    assert.equal(dados.falhas[0].reporterName, 'Equipe Madrugada');
    assert.equal(dados.chamados[0].reporterName, 'Kelly Lira');
    assert.equal(dados.chamados[0].descricaoEvento, 'INOPERANTE');
    assert.equal(Object.hasOwn(dados.falhas[0], 'reporterId'), false);
    assert.equal(dados.falhas[0].incidente, 'N/A');
    assert.equal(dados.falhas[0].anexoPath, 'u1/f1/imagem.png');
    assert.equal(dados.falhas[0].anexoNome, 'imagem.png');
});

test('envia imagem privada e vincula o caminho ao registro', async () => {
    let upload;
    let payload;
    const client = {
        auth: {
            getUser: async () => ({ data: { user: { id: 'u1' } }, error: null })
        },
        storage: {
            from(bucket) {
                assert.equal(bucket, 'failure-portal-images');
                return {
                    upload: async (path, file, options) => {
                        upload = { path, file, options };
                        return { data: { path }, error: null };
                    },
                    remove: async () => ({ data: [], error: null }),
                    createSignedUrl: async path => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null })
                };
            }
        },
        from(table) {
            assert.equal(table, 'failure_portal_reports');
            return {
                insert(value) {
                    payload = value;
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: {
                                        ...value,
                                        reporter_name: value.reporter_name || 'Equipe Madrugada'
                                    },
                                    error: null
                                })
                            };
                        }
                    };
                }
            };
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'i'.repeat(30)}`
        },
        client
    });
    const imagem = { name: 'evidencia.png', type: 'image/png', size: 1024 };
    const falha = await service.criarFalha({
        occurredAt: '2026-08-11T12:00:00.000Z',
        titulo: 'FALHA',
        cluster: 'RJ',
        incidente: 'N/A',
        taskOuSistema: 'N/A',
        descricao: 'TESTE',
        reporterName: 'Alan'
    }, imagem);

    assert.equal(upload.path, 'u1/uuid-1/uuid-2.png');
    assert.equal(upload.file, imagem);
    assert.equal(upload.options.upsert, false);
    assert.equal(payload.id, 'uuid-1');
    assert.equal(payload.attachment_path, upload.path);
    assert.equal(payload.attachment_name, 'evidencia.png');
    assert.equal(payload.reporter_name, 'Alan');
    assert.equal(falha.anexoMime, 'image/png');
    assert.equal(await service.criarUrlAnexo(upload.path), `https://signed.test/${upload.path}`);
});

test('recusa anexos fora dos formatos e do limite permitido', () => {
    const service = carregarServico();
    assert.throws(
        () => service.validarImagem({ name: 'arquivo.svg', type: 'image/svg+xml', size: 100 }),
        /Formato de imagem inválido/
    );
    assert.throws(
        () => service.validarImagem({ name: 'grande.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }),
        /no máximo 5 MB/
    );
});

test('propaga erro de leitura do servidor com contexto', async () => {
    const client = {
        auth: {},
        from() {
            return {
                select() {
                    return { order: async () => ({ data: null, error: { message: 'RLS bloqueou' } }) };
                }
            };
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'y'.repeat(30)}`
        },
        client
    });
    await assert.rejects(service.listarTudo(), /Falha ao carregar os registros: RLS bloqueou/);
});

test('não expõe cadastro público no serviço do navegador', () => {
    const service = carregarServico();
    assert.equal(service.cadastrar, undefined);
});

test('converte o usuário compartilhado madrugada para a identidade técnica', async () => {
    let credenciais;
    const client = {
        auth: {
            signInWithPassword: async value => {
                credenciais = value;
                return { data: { session: { user: { id: 'equipe-madrugada' } } }, error: null };
            }
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'m'.repeat(30)}`
        },
        client
    });

    const sessao = await service.entrar('  MADRUGADA  ', 'senha-compartilhada');
    assert.equal(sessao.user.id, 'equipe-madrugada');
    assert.equal(credenciais.email, 'madrugada@comunicador.invalid');
    assert.equal(credenciais.password, 'senha-compartilhada');
});

test('consulta papel e nome do usuário da sessão', async () => {
    const filtros = [];
    const client = {
        from(table) {
            return {
                select(columns) {
                    return {
                        eq(column, value) {
                            filtros.push({ table, columns, column, value });
                            return {
                                maybeSingle: async () => ({
                                    data: table === 'failure_portal_memberships'
                                        ? { role: 'admin' }
                                        : { display_name: 'Nelson Soares' },
                                    error: null
                                })
                            };
                        }
                    };
                }
            };
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'a'.repeat(30)}`
        },
        client
    });

    const identidade = await service.obterIdentidade('usuario-nelson');
    assert.equal(identidade.role, 'admin');
    assert.equal(identidade.displayName, 'Nelson Soares');
    assert.deepEqual(filtros, [
        { table: 'failure_portal_memberships', columns: 'role', column: 'user_id', value: 'usuario-nelson' },
        { table: 'failure_portal_profiles', columns: 'display_name', column: 'user_id', value: 'usuario-nelson' }
    ]);
    await assert.rejects(service.obterAcesso(), /Sessão inválida/);
});

test('salva múltiplos motivos e a descrição copiável do chamado', async () => {
    let payload;
    const client = {
        from(table) {
            assert.equal(table, 'failure_portal_tickets');
            return {
                insert(value) {
                    payload = value;
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: { id: 't2', closed_at: null, reporter_name: 'Equipe Madrugada', ...value },
                                    error: null
                                })
                            };
                        }
                    };
                }
            };
        }
    };
    const service = carregarServico({
        config: {
            supabaseUrl: 'https://projeto.supabase.co',
            supabasePublishableKey: `sb_publishable_${'t'.repeat(30)}`
        },
        client
    });

    const chamado = await service.criarChamado({
        openedAt: '2026-08-13T10:30:00.000Z',
        numero: 'CH-2',
        motivo: 'TOA / SGO',
        descricaoEvento: 'INTERMITENTE'
    });

    assert.equal(payload.reason, 'TOA / SGO');
    assert.equal(payload.event_description, 'INTERMITENTE');
    assert.equal(chamado.motivo, 'TOA / SGO');
    assert.equal(chamado.descricaoEvento, 'INTERMITENTE');
});
