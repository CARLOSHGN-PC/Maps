document.addEventListener('DOMContentLoaded', () => {

    // --- MOCK DATA INICIAL ---
    // Dados de exemplo para o aplicativo funcionar sem um banco de dados.
    const getInitialData = () => ({
        users: [
            { uid: 'admin123', email: 'admin@agrovetor.com', username: 'admin', role: 'admin', active: true, permissions: { dashboard: true, mapeamento: true, planejamentoColheita: true, planejamento: true, lancamentoBroca: true, lancamentoPerda: true, relatorioBroca: true, relatorioPerda: true, excluir: true, gerenciarUsuarios: true, configuracoes: true, cadastrarPessoas: true } },
            { uid: 'tecnico123', email: 'tecnico@agrovetor.com', username: 'tecnico', role: 'tecnico', active: true, permissions: { dashboard: true, mapeamento: true, lancamentoBroca: true, lancamentoPerda: true, relatorioBroca: true, relatorioPerda: true } }
        ],
        fazendas: [],
        personnel: [],
        registros: [],
        perdas: [],
        planos: [],
        harvestPlans: [],
        mapState: {
            armadilhas: [],
            geoJsonData: null // Para guardar os dados do shapefile
        }
    });

    const App = {
        config: {
            // ... (A configuração do menu e roles permanece a mesma) ...
        },

        state: {
            currentUser: null,
            // O resto do estado será carregado do localStorage
        },
        
        elements: {
            // ... (A lista de elementos permanece a mesma) ...
        },

        init() {
            this.data.loadStateFromLocalStorage();
            this.ui.applyTheme(localStorage.getItem('canaAppTheme') || 'theme-green');
            this.ui.setupEventListeners();
            this.auth.checkSession();
            this.map.init(); 
        },
        
        auth: {
            checkSession() {
                const lastUser = JSON.parse(localStorage.getItem('lastUserProfile'));
                if (lastUser) {
                    App.state.currentUser = lastUser;
                    App.ui.showAppScreen();
                } else {
                    App.ui.showLoginScreen();
                }
            },
            login() {
                const email = App.elements.loginUser.value.trim();
                const password = App.elements.loginPass.value;
                
                // Simulação de login
                const user = App.state.users.find(u => u.email === email);

                if (user && user.active) { // Não verificamos a senha no modo local
                    App.state.currentUser = user;
                    localStorage.setItem('lastUserProfile', JSON.stringify(user));
                    App.ui.showAppScreen();
                } else {
                    App.ui.showLoginMessage("Usuário não encontrado ou inativo.");
                }
            },
            logout() {
                App.state.currentUser = null;
                localStorage.removeItem('lastUserProfile');
                clearTimeout(App.state.inactivityTimer);
                App.ui.showLoginScreen();
            },
            // Funções de criar/gerenciar usuários ficam como placeholders visuais
            initiateUserCreation() {
                 App.ui.showAlert("Função desativada no modo local.", "warning");
            },
        },

        data: {
            loadStateFromLocalStorage() {
                const savedState = JSON.parse(localStorage.getItem('agrovetor_data'));
                if (savedState) {
                    App.state = { ...App.state, ...savedState };
                } else {
                    // Se não houver dados salvos, carrega os dados iniciais
                    const initialState = getInitialData();
                    App.state = { ...App.state, ...initialState };
                    this.saveStateToLocalStorage();
                }
            },
            saveStateToLocalStorage() {
                const stateToSave = { ...App.state };
                // Não salvamos o usuário logado ou o mapa, pois são transitórios
                delete stateToSave.currentUser;
                delete stateToSave.mapState.map;
                delete stateToSave.mapState.trapMarkers;
                delete stateToSave.mapState.userLocationMarker;
                
                localStorage.setItem('agrovetor_data', JSON.stringify(stateToSave));
            },
            addDocument(collectionName, data) {
                if (App.state[collectionName]) {
                    const newEntry = { ...data, id: Date.now() };
                    App.state[collectionName].push(newEntry);
                    this.saveStateToLocalStorage();
                    App.ui.renderAllDynamicContent();
                }
            },
            deleteDocument(collectionName, id) {
                 if (App.state[collectionName]) {
                    App.state[collectionName] = App.state[collectionName].filter(item => item.id != id);
                    this.saveStateToLocalStorage();
                    App.ui.renderAllDynamicContent();
                }
            }
        },
        
        ui: {
            // ... (A maior parte do seu UI permanece a mesma) ...
            clearForm(formElement) {
                if (!formElement) return;
                const inputs = formElement.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else if (input.type !== 'date') {
                        input.value = '';
                    }
                });
                formElement.querySelectorAll('.info-display').forEach(el => el.textContent = '');
                formElement.querySelectorAll('.resultado').forEach(el => el.textContent = '');
            },
        },
        
        actions: {
            // ... (A maior parte das suas actions permanece a mesma) ...

            saveBrocamento() {
                if (!App.ui.validateFields(['codigo', 'data', 'talhao', 'entrenos', 'brocaBase', 'brocaMeio', 'brocaTopo'])) { 
                    App.ui.showAlert("Preencha todos os campos obrigatórios!", "error"); 
                    return; 
                }
                
                const { broca } = App.elements;
                const farm = App.state.fazendas.find(f => f.id == broca.codigo.value);
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

                App.ui.showConfirmationModal('Tem a certeza que deseja guardar esta inspeção?', () => {
                    App.data.addDocument('registros', newEntry);
                    App.ui.showAlert('Inspeção guardada localmente com sucesso!');
                    App.ui.clearForm(broca.form);
                    App.ui.setDefaultDatesForEntryForms();
                });
            },
            
            savePerda() {
                if (!App.ui.validateFields(['dataPerda', 'codigoPerda', 'frenteServico', 'talhaoPerda', 'frotaEquipamento', 'matriculaOperador'])) { 
                    App.ui.showAlert("Preencha todos os campos obrigatórios!", "error"); 
                    return; 
                }
                
                const { perda } = App.elements;
                const farm = App.state.fazendas.find(f => f.id == perda.codigo.value);
                const operator = App.state.personnel.find(p => p.matricula === perda.matricula.value.trim());
                if (!operator) {
                    App.ui.showAlert("Matrícula do operador não encontrada.", "error");
                    return;
                }
                const talhao = farm?.talhoes.find(t => t.name.toUpperCase() === perda.talhao.value.trim().toUpperCase());

                if (!talhao) {
                    App.ui.showAlert(`Talhão "${perda.talhao.value}" não encontrado na fazenda "${farm.name}".`, "error");
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
                
                App.ui.showConfirmationModal('Tem a certeza que deseja guardar este lançamento?', () => {
                    App.data.addDocument('perdas', newEntry);
                    App.ui.showAlert('Lançamento de perda guardado localmente com sucesso!');
                    App.ui.clearForm(perda.form);
                    App.ui.setDefaultDatesForEntryForms();
                });
            }
        },
        
        map: {
            init() {
                if (App.state.mapState.map) return;
                
                const mapInstance = L.map('map').setView([-21.17, -47.81], 13);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri'
                }).addTo(mapInstance);
                
                App.state.mapState.map = mapInstance;
                App.state.mapState.trapMarkers = L.layerGroup().addTo(mapInstance);

                this.setupMapEventListeners();
                this.loadMapDataFromState(); // Carrega dados do mapa salvos localmente
                setInterval(() => this.checkTrapStatusByTime(), 60 * 1000);
            },

            loadMapDataFromState() {
                if (App.state.mapState.geoJsonData) {
                    this.processGeoJSON(App.state.mapState.geoJsonData);
                }
                if (App.state.mapState.armadilhas) {
                    this.updateAllMarkers();
                }
            },

            setupMapEventListeners() {
                const els = App.elements.mapeamento;
                const map = App.state.mapState.map;

                if (App.state.currentUser && App.state.currentUser.role === 'admin') {
                    els.btnUploadShp.style.display = 'inline-flex';
                } else {
                    els.btnUploadShp.style.display = 'none';
                }

                els.btnUploadShp.addEventListener('click', () => els.shapefileInput.click());
                els.shapefileInput.addEventListener('change', (e) => this.handleFile(e));
                els.btnToggleTracking.addEventListener('click', () => this.toggleTracking());
                els.btnPlaceTrap.addEventListener('click', () => this.placeTrap());

                map.on('locationfound', (e) => this.onLocationFound(e));
                map.on('locationerror', (e) => this.onLocationError(e));
                map.on('click', (e) => this.onMapClick(e));
            },

            handleFile(event) {
                const file = event.target.files[0];
                if (file && file.name.endsWith('.zip')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        shp(e.target.result).then(geojson => {
                            App.state.mapState.geoJsonData = geojson; // Salva os dados do mapa no estado
                            App.data.saveStateToLocalStorage();
                            this.processGeoJSON(geojson);
                            alert('Mapa carregado e salvo localmente com sucesso!');
                        }).catch(err => {
                            console.error("Erro ao processar o shapefile:", err);
                            alert("Erro ao carregar o shapefile. Verifique o formato do .zip.");
                        });
                    };
                    reader.readAsArrayBuffer(file);
                }
            },

            processGeoJSON(geojson) {
                if (App.state.mapState.geoJsonLayer) App.state.mapState.map.removeLayer(App.state.mapState.geoJsonLayer);
                
                const geoJsonLayer = L.geoJSON(geojson, {
                    style: this.getTalhaoStyle.bind(this),
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties;
                        const talhaoNome = props.TALHAO || props.plot || 'N/A';
                        layer.bindPopup(`<strong>Talhão:</strong> ${talhaoNome}`);
                    }
                }).addTo(App.state.mapState.map);

                App.state.mapState.geoJsonLayer = geoJsonLayer;
                App.state.mapState.map.fitBounds(geoJsonLayer.getBounds());
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
                    status: 'ok',
                    contagem: 0,
                    fazenda: 'Fazenda Simulada'
                };
                App.state.mapState.armadilhas.push(novaArmadilha);
                App.data.saveStateToLocalStorage();
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
                                    App.data.saveStateToLocalStorage();
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
                    App.data.saveStateToLocalStorage();
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
            },
            getTalhaoStyle(feature){
                // Lógica para colorir talhões com alerta
                return { color: 'var(--color-primary)', weight: 2, opacity: 0.8, fillColor: 'var(--color-accent)', fillOpacity: 0.3 };
            }
        },
    };

    // Inicializa a aplicação
    App.init();
});
