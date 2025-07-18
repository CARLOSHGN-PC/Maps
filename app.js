// FIREBASE: Importe os módulos necessários do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, getDocs, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {

    // FIREBASE: Configuração e inicialização do Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyBFXgXKDIBo9JD9vuGik5VDYZFDb_tbCrY", // Substitua pela sua chave de API
        authDomain: "agrovetor-v2.firebaseapp.com",
        projectId: "agrovetor-v2",
        storageBucket: "agrovetor-v2.appspot.com",
        messagingSenderId: "782518751171",
        appId: "1:782518751171:web:d501ee31c1db33da4eb776",
        measurementId: "G-JN4MSW63JR"
    };

    // Aplicação principal do Firebase
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    const auth = getAuth(firebaseApp);
    const storage = getStorage(firebaseApp);

    // Aplicação secundária do Firebase, usada APENAS para criar novos utilizadores sem deslogar o admin.
    const secondaryApp = initializeApp(firebaseConfig, "secondary");
    const secondaryAuth = getAuth(secondaryApp);

    // Habilita a persistência offline
    enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("A persistência offline falhou. Múltiplas abas abertas?");
            } else if (err.code == 'unimplemented') {
                console.warn("O navegador atual não suporta a persistência offline.");
            }
        });


    const App = {
        config: {
            appName: "Inspeção e Planeamento de Cana com IA",
            themeKey: 'canaAppTheme',
            inactivityTimeout: 15 * 60 * 1000, // 15 minutos
            menuConfig: [
                { label: 'Dashboard', icon: 'fas fa-tachometer-alt', target: 'dashboard', permission: 'dashboard' },
                { label: 'Mapeamento', icon: 'fas fa-satellite-dish', target: 'mapeamentoControle', permission: 'mapeamento' }, // NOVO MÓDULO
                { label: 'Plan. Inspeção', icon: 'fas fa-calendar-alt', target: 'planejamento', permission: 'planejamento' },
                {
                    label: 'Colheita', icon: 'fas fa-tractor',
                    submenu: [
                        { label: 'Planeamento de Colheita', icon: 'fas fa-stream', target: 'planejamentoColheita', permission: 'planejamentoColheita' },
                    ]
                },
                {
                    label: 'Lançamentos', icon: 'fas fa-pen-to-square',
                    submenu: [
                        { label: 'Lançamento Broca', icon: 'fas fa-bug', target: 'lancamentoBroca', permission: 'lancamentoBroca' },
                        { label: 'Lançamento Perda', icon: 'fas fa-dollar-sign', target: 'lancamentoPerda', permission: 'lancamentoPerda' },
                    ]
                },
                {
                    label: 'Relatórios', icon: 'fas fa-chart-line',
                    submenu: [
                        { label: 'Relatório Broca', icon: 'fas fa-chart-bar', target: 'relatorioBroca', permission: 'relatorioBroca' },
                        { label: 'Relatório Perda', icon: 'fas fa-chart-pie', target: 'relatorioPerda', permission: 'relatorioPerda' },
                        { label: 'Rel. Colheita Custom', icon: 'fas fa-file-invoice', target: 'relatorioColheitaCustom', permission: 'planejamentoColheita' },
                    ]
                },
                {
                    label: 'Administrativo', icon: 'fas fa-cogs',
                    submenu: [
                        { label: 'Cadastros', icon: 'fas fa-book', target: 'cadastros', permission: 'configuracoes' },
                        { label: 'Cadastrar Pessoas', icon: 'fas fa-id-card', target: 'cadastrarPessoas', permission: 'cadastrarPessoas' },
                        { label: 'Gerir Utilizadores', icon: 'fas fa-users-cog', target: 'gerenciarUsuarios', permission: 'gerenciarUsuarios' },
                        { label: 'Configurações da Empresa', icon: 'fas fa-building', target: 'configuracoesEmpresa', permission: 'configuracoes' },
                        { label: 'Excluir Lançamentos', icon: 'fas fa-trash', target: 'excluirDados', permission: 'excluir' },
                    ]
                },
            ],
            roles: {
                admin: { dashboard: true, mapeamento: true, planejamentoColheita: true, planejamento: true, lancamentoBroca: true, lancamentoPerda: true, relatorioBroca: true, relatorioPerda: true, excluir: true, gerenciarUsuarios: true, configuracoes: true, cadastrarPessoas: true },
                supervisor: { dashboard: true, mapeamento: true, planejamentoColheita: true, planejamento: true, relatorioBroca: true, relatorioPerda: true, configuracoes: true, cadastrarPessoas: true, gerenciarUsuarios: true },
                tecnico: { dashboard: true, mapeamento: true, lancamentoBroca: true, lancamentoPerda: true, relatorioBroca: true, relatorioPerda: true },
                colaborador: { dashboard: true, mapeamento: true, lancamentoBroca: true, lancamentoPerda: true },
                user: { dashboard: true, mapeamento: true }
            }
        },

        state: {
            currentUser: null,
            users: [],
            registros: [],
            perdas: [],
            planos: [],
            fazendas: [],
            personnel: [],
            companyLogo: null,
            activeSubmenu: null,
            charts: {},
            harvestPlans: [],
            activeHarvestPlan: null,
            inactivityTimer: null,
            unsubscribeListeners: [],
            deferredInstallPrompt: null,
            newUserCreationData: null,
            expandedChart: null,
            mapState: { // Estado específico do mapa
                map: null,
                geoJsonLayer: null,
                trapMarkers: null,
                isTracking: false,
                userLocationMarker: null,
                lastKnownPosition: null,
                armadilhas: [],
                generalAlertInterval: null
            }
        },
        
        elements: {
            // ... (todos os seus elementos existentes) ...
            mapeamento: {
                btnUploadShp: document.getElementById('btn-upload-shp'),
                shapefileInput: document.getElementById('shapefileInput'),
                btnToggleTracking: document.getElementById('btn-toggle-tracking'),
                btnPlaceTrap: document.getElementById('btn-place-trap'),
                mapContainer: document.getElementById('map'),
                notificationPanel: document.getElementById('notification-panel'),
                adminUploadSection: document.getElementById('admin-upload-section')
            }
        },

        init() {
            // ... (seu init existente) ...
            this.map.init(); // Inicializa o mapa
        },
        
        auth: {
            // ... (seu auth existente, com a lógica de login offline corrigida) ...
        },

        data: {
            // ... (seu data existente) ...
        },
        
        ui: {
            // ... (seu ui existente, com a lógica de limpar formulário corrigida) ...
        },
        
        actions: {
            // ... (suas actions existentes) ...
            saveBrocamento() {
                if (!App.ui.validateFields(['codigo', 'data', 'talhao', 'entrenos', 'brocaBase', 'brocaMeio', 'brocaTopo'])) { 
                    App.ui.showAlert("Preencha todos os campos obrigatórios!", "error"); 
                    return; 
                }
                
                App.ui.showConfirmationModal('Tem a certeza que deseja guardar esta inspeção de broca?', async () => {
                    const { broca } = App.elements;
                    const farm = App.state.fazendas.find(f => f.id === broca.codigo.value);
                    if (!farm) { App.ui.showAlert("Fazenda não encontrada.", "error"); return; }
                    const talhao = farm.talhoes.find(t => t.name.toUpperCase() === broca.talhao.value.trim().toUpperCase());
                    
                    if (!talhao) {
                        App.ui.showAlert(`Talhão "${broca.talhao.value}" não encontrado na fazenda "${farm.name}". Verifique o cadastro.`, "error");
                        return;
                    }

                    const newEntry = {
                        codigo: farm.code, fazenda: farm.name, data: broca.data.value,
                        talhao: broca.talhao.value.trim(),
                        corte: talhao ? talhao.corte : null,
                        entrenos: parseInt(broca.entrenos.value),
                        base: parseInt(broca.base.value),
                        meio: parseInt(broca.meio.value),
                        topo: parseInt(broca.topo.value),
                        brocado: parseInt(broca.brocado.value),
                        brocamento: (((parseInt(broca.brocado.value) || 0) / (parseInt(broca.entrenos.value) || 1)) * 100).toFixed(2).replace('.', ','),
                        usuario: App.state.currentUser.username
                    };
                    
                    // Ação otimista: limpa o formulário imediatamente
                    App.ui.clearForm(broca.form);
                    App.ui.setDefaultDatesForEntryForms();

                    try {
                        await App.data.addDocument('registros', newEntry);
                        if (navigator.onLine) {
                            App.ui.showAlert('Inspeção guardada com sucesso!');
                        } else {
                            App.ui.showAlert('Inspeção guardada offline. Será enviada quando houver conexão.', 'info');
                        }
                        this.verificarEAtualizarPlano('broca', newEntry.codigo, newEntry.talhao);
                    } catch(e) {
                        App.ui.showAlert('Erro ao guardar inspeção.', 'error');
                        console.error("Erro ao salvar brocamento:", e);
                    }
                });
            },
            
            savePerda() {
                if (!App.ui.validateFields(['dataPerda', 'codigoPerda', 'frenteServico', 'talhaoPerda', 'frotaEquipamento', 'matriculaOperador'])) { 
                    App.ui.showAlert("Preencha todos os campos obrigatórios!", "error"); 
                    return; 
                }
                
                const { perda } = App.elements;
                const farm = App.state.fazendas.find(f => f.id === perda.codigo.value);
                const operator = App.state.personnel.find(p => p.matricula === perda.matricula.value.trim());
                if (!operator) {
                    App.ui.showAlert("Matrícula do operador não encontrada. Verifique o cadastro.", "error");
                    return;
                }
                const talhao = farm?.talhoes.find(t => t.name.toUpperCase() === perda.talhao.value.trim().toUpperCase());

                if (!talhao) {
                    App.ui.showAlert(`Talhão "${perda.talhao.value}" não encontrado na fazenda "${farm.name}". Verifique o cadastro.`, "error");
                    return;
                }
                
                const fields = { canaInteira: parseFloat(perda.canaInteira.value) || 0, tolete: parseFloat(perda.tolete.value) || 0, toco: parseFloat(perda.toco.value) || 0, ponta: parseFloat(perda.ponta.value) || 0, estilhaco: parseFloat(perda.estilhaco.value) || 0, pedaco: parseFloat(perda.pedaco.value) || 0 };
                const total = Object.values(fields).reduce((s, v) => s + v, 0);
                const newEntry = {
                    ...fields,
                    data: perda.data.value,
                    codigo: farm ? farm.code : 'N/A',
                    fazenda: farm ? farm.name : 'Desconhecida',
                    frenteServico: perda.frente.value.trim(),
                    turno: perda.turno.value,
                    talhao: perda.talhao.value.trim(),
                    frota: perda.frota.value.trim(),
                    matricula: operator.matricula,
                    operador: operator.name,
                    total,
                    media: (total / 6).toFixed(2).replace('.', ','),
                    usuario: App.state.currentUser.username
                };
                
                App.ui.showConfirmationModal('Tem a certeza que deseja guardar este lançamento de perda?', async () => {
                    App.ui.clearForm(perda.form);
                    App.ui.setDefaultDatesForEntryForms();

                    try {
                        await App.data.addDocument('perdas', newEntry);
                        if (navigator.onLine) {
                            App.ui.showAlert('Lançamento de perda guardado com sucesso!');
                        } else {
                            App.ui.showAlert('Lançamento de perda guardado offline. Será enviado quando houver conexão.', 'info');
                        }
                        this.verificarEAtualizarPlano('perda', newEntry.codigo, newEntry.talhao);
                    } catch(e) {
                        App.ui.showAlert('Erro ao guardar lançamento de perda.', 'error');
                        console.error("Erro ao salvar perda:", e);
                    }
                });
            }
        },
        
        map: {
            init() {
                if (App.state.mapState.map) return; // Previne reinicialização
                
                const mapInstance = L.map('map').setView([-21.17, -47.81], 13);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri'
                }).addTo(mapInstance);
                
                App.state.mapState.map = mapInstance;
                App.state.mapState.trapMarkers = L.layerGroup().addTo(mapInstance);

                this.setupMapEventListeners();

                // Inicia o ciclo de verificação de armadilhas
                setInterval(this.checkTrapStatusByTime, 60 * 1000);
            },

            setupMapEventListeners() {
                const els = App.elements.mapeamento;
                const map = App.state.mapState.map;

                if (App.state.currentUser.permissions.configuracoes) {
                    els.btnUploadShp.style.display = 'inline-flex';
                } else {
                    els.btnUploadShp.style.display = 'none';
                }

                els.btnUploadShp.addEventListener('click', () => els.shapefileInput.click());
                els.shapefileInput.addEventListener('change', this.handleFile);
                els.btnToggleTracking.addEventListener('click', () => this.toggleTracking());
                els.btnPlaceTrap.addEventListener('click', () => this.placeTrap());

                map.on('locationfound', (e) => this.onLocationFound(e));
                map.on('locationerror', (e) => this.onLocationError(e));
                map.on('click', (e) => this.onMapClick(e));
            },

            handleFile(event) {
                // ... (lógica de upload do shapefile) ...
            },
            
            toggleTracking() {
                const map = App.state.mapState.map;
                App.state.mapState.isTracking = !App.state.mapState.isTracking;

                if (App.state.mapState.isTracking) {
                    map.locate({ watch: true, setView: true, maxZoom: 18, enableHighAccuracy: true });
                    App.elements.mapeamento.btnToggleTracking.classList.add('active');
                } else {
                    map.stopLocate();
                    if (App.state.mapState.userLocationMarker) {
                        map.removeLayer(App.state.mapState.userLocationMarker);
                        App.state.mapState.userLocationMarker = null;
                    }
                    App.elements.mapeamento.btnToggleTracking.classList.remove('active');
                }
            },

            onLocationFound(e) {
                App.state.mapState.lastKnownPosition = e.latlng;
                if (!App.state.mapState.userLocationMarker) {
                    App.state.mapState.userLocationMarker = L.circle(e.latlng, { radius: e.accuracy, color: 'var(--color-info)' }).addTo(App.state.mapState.map);
                } else {
                    App.state.mapState.userLocationMarker.setLatLng(e.latlng).setRadius(e.accuracy);
                }
            },

            onLocationError(e) {
                alert("Não foi possível obter sua localização. Verifique as permissões de GPS.");
                this.toggleTracking();
            },

            onMapClick(e) {
                if (confirm('Deseja adicionar uma armadilha neste local?')) {
                    this.addTrap(e.latlng);
                }
            },

            placeTrap() {
                if (!App.state.mapState.isTracking || !App.state.mapState.lastKnownPosition) {
                    alert("Ative o rastreamento primeiro para obter sua localização exata.");
                    return;
                }
                this.addTrap(App.state.mapState.lastKnownPosition);
            },

            addTrap(latlng) {
                const novaArmadilha = {
                    id: Date.now(),
                    lat: latlng.lat,
                    lng: latlng.lng,
                    dataColocacao: new Date().toISOString(),
                    status: 'ok', // ok, verificar, alerta
                    contagem: 0,
                    fazenda: 'Fazenda Simulada' // TODO: Implementar detecção de fazenda/talhão
                };
                App.state.mapState.armadilhas.push(novaArmadilha);
                this.renderTrapMarker(novaArmadilha);
            },

            renderTrapMarker(armadilha) {
                const icon = this.createTrapIcon(armadilha.status);
                const marker = L.marker([armadilha.lat, armadilha.lng], { icon: icon }).addTo(App.state.mapState.trapMarkers);
                
                const popupContent = () => `
                    <strong>Armadilha #${armadilha.id}</strong><br>
                    <small>Instalada em: ${new Date(armadilha.dataColocacao).toLocaleDateString()}</small><br>
                    Status: ${armadilha.status}<br>
                    Mariposas: <strong>${armadilha.contagem}</strong><br>
                    <input type="number" placeholder="Nova contagem" class="popup-input" id="count-${armadilha.id}" min="0">
                    <button class="popup-button" data-id="${armadilha.id}">Salvar</button>
                `;
                marker.bindPopup(popupContent());

                marker.on('popupopen', () => {
                    setTimeout(() => {
                        const btn = document.querySelector(`.popup-button[data-id="${armadilha.id}"]`);
                        if (btn) {
                            btn.addEventListener('click', () => {
                                const input = document.getElementById(`count-${armadilha.id}`);
                                const newCount = parseInt(input.value);
                                if (!isNaN(newCount) && newCount >= 0) {
                                    armadilha.contagem = newCount;
                                    armadilha.status = newCount >= 6 ? 'alerta' : 'ok';
                                    marker.closePopup();
                                    this.updateAllMarkers();
                                    this.checkGeneralAlert(armadilha.fazenda);
                                }
                            });
                        }
                    }, 100);
                });
            },

            updateAllMarkers() {
                App.state.mapState.trapMarkers.clearLayers();
                App.state.mapState.armadilhas.forEach(armadilha => this.renderTrapMarker(armadilha));
            },

            createTrapIcon(status) {
                let color = 'var(--color-info)';
                if (status === 'verificar') color = 'var(--color-warning)';
                if (status === 'alerta') color = 'var(--color-danger)';
                
                const iconHtml = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: var(--shadow-md);"><i class="fas fa-bug" style="color: white; font-size: 12px;"></i></div>`;

                return L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
            },

            checkTrapStatusByTime() {
                const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
                let needsUpdate = false;
                App.state.mapState.armadilhas.forEach(armadilha => {
                    if (armadilha.status === 'ok' && new Date(armadilha.dataColocacao) <= fiveDaysAgo) {
                        armadilha.status = 'verificar';
                        App.ui.showAlert(`Atenção: Armadilha #${armadilha.id} precisa ser verificada.`, 'warning');
                        needsUpdate = true;
                    }
                });
                if (needsUpdate) {
                    this.updateAllMarkers();
                }
            },

            checkGeneralAlert(fazendaNome) {
                const armadilhasDaFazenda = App.state.mapState.armadilhas.filter(a => a.fazenda === fazendaNome);
                if (armadilhasDaFazenda.length === 0) return;

                const armadilhasComAlerta = armadilhasDaFazenda.filter(a => a.status === 'alerta');
                const percentualAlerta = armadilhasComAlerta.length / armadilhasDaFazenda.length;

                if (percentualAlerta >= 0.30) {
                    if (!App.state.mapState.generalAlertInterval) {
                        this.showGeneralAlert(fazendaNome, true);
                        App.state.mapState.generalAlertInterval = setInterval(() => this.showGeneralAlert(fazendaNome, true), 3600 * 1000);
                    }
                } else {
                    if (App.state.mapState.generalAlertInterval) {
                        clearInterval(App.state.mapState.generalAlertInterval);
                        App.state.mapState.generalAlertInterval = null;
                        this.showGeneralAlert(fazendaNome, false);
                    }
                }
            },
            
            showGeneralAlert(fazendaNome, show) {
                const panel = App.elements.mapeamento.notificationPanel;
                let alertDiv = document.getElementById('general-alert');

                if (show) {
                    if (!alertDiv) {
                        alertDiv = document.createElement('div');
                        alertDiv.id = 'general-alert';
                        alertDiv.className = 'notification danger';
                        panel.appendChild(alertDiv);
                    }
                    alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ALERTA GERAL: Infestação alta na ${fazendaNome}. Aplicação recomendada!`;
                    alertDiv.classList.add('show');
                } else {
                    if (alertDiv) {
                        alertDiv.classList.remove('show');
                        setTimeout(() => panel.removeChild(alertDiv), 500);
                    }
                }
            }
        },

        // ... (resto do seu objeto App, como reports, pwa, etc.)
    };

    // Inicia a aplicação
    App.init();
});
