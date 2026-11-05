import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './context/ToastContext';
import { Navigation, ActiveModule } from './components/Navigation';
import { StorageService } from './services/storage';
import { Contratante, Partida, Pagamento, Recibo } from './types';

// Views
import { TodayView } from './views/TodayView';
import { ScheduleView } from './views/ScheduleView';
import { MatchesView } from './views/MatchesView';
import { FixedGamesView } from './views/FixedGamesView';
import { ContractorsView } from './views/ContractorsView';
import { BillingsView } from './views/BillingsView';
import { PaymentsView } from './views/PaymentsView';
import { FinancialView } from './views/FinancialView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

// Modals
import { MatchFormModal } from './components/MatchFormModal';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReversalModal } from './components/ReversalModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ContractorPortalView } from './components/ContractorPortalView';

function AppContent() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('hoje');
  const [tick, setTick] = useState(0);

  // Modals state
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Partida | null>(null);
  const [matchModalInitialDate, setMatchModalInitialDate] = useState<string | undefined>(undefined);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInitialContratanteId, setPaymentInitialContratanteId] = useState<string | undefined>(undefined);
  const [paymentInitialSelectedPartidasIds, setPaymentInitialSelectedPartidasIds] = useState<string[] | undefined>(undefined);

  const [activeReceipt, setActiveReceipt] = useState<Recibo | null>(null);
  const [reversalTarget, setReversalTarget] = useState<Pagamento | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Contractor Portal Modal (or URL param)
  const [portalContractor, setPortalContractor] = useState<Contratante | null>(null);
  const [targetPaymentFilterId, setTargetPaymentFilterId] = useState<string | undefined>(undefined);
  const [targetContractorFilterId, setTargetContractorFilterId] = useState<string | undefined>(undefined);

  // Inicializa o banco de dados limpo para o usuário com a base autorizada caso esteja vazio
  useEffect(() => {
    const isCleaned = localStorage.getItem('goleiro_pro_clean_v5');
    if (!isCleaned) {
      // Proteção de integridade: nunca apaga partidas ou clientes se o usuário já tiver registros
      if (!StorageService.hasExistingUserData()) {
        StorageService.clearAllData(false);
      }
      localStorage.setItem('goleiro_pro_clean_v5', 'true');
    }

    // Auto-recuperação de moedas infladas por versões antigas
    StorageService.sanitizeBloatedCurrencies();

    // Subscribe to DB updates
    const unsubscribe = StorageService.subscribeToChanges(() => {
      setTick(t => t + 1);
    });

    // Check URL parameters for shareable statement token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('extrato') || urlParams.get('portal');
    if (token) {
      const contractor = StorageService.getContratanteByToken(token);
      if (contractor) {
        setPortalContractor(contractor);
      }
    }

    return () => unsubscribe();
  }, []);

  // Handlers para Ações Globais
  const handleOpenNewMatch = (date?: string) => {
    setEditingMatch(null);
    setMatchModalInitialDate(date);
    setMatchModalOpen(true);
  };

  const handleEditMatch = (partida: Partida) => {
    setEditingMatch(partida);
    setMatchModalInitialDate(undefined);
    setMatchModalOpen(true);
  };

  const handleOpenNewPayment = (contratanteId?: string, partidasIds?: string[]) => {
    setPaymentInitialContratanteId(contratanteId);
    setPaymentInitialSelectedPartidasIds(partidasIds);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (recibo: Recibo) => {
    setActiveReceipt(recibo);
  };

  const handleViewReceiptByPaymentId = (paymentId: string) => {
    const recibo = StorageService.getReciboByPagamento(paymentId);
    if (recibo) {
      setActiveReceipt(recibo);
    } else {
      // Cria recibo com base no pagamento se necessário
      const pag = StorageService.getPagamentos().find(p => p.id === paymentId);
      if (pag) {
        const c = StorageService.getContratanteById(pag.contratanteId);
        setActiveReceipt({
          id: `rec-${pag.id}`,
          numeroRecibo: pag.reciboNumero || 'GP-000001',
          pagamentoId: pag.id,
          contratanteId: pag.contratanteId,
          contratanteNome: c?.nome || 'Contratante',
          dataRecebimento: pag.dataRecebimento,
          metodoPagamento: pag.metodoPagamento,
          valorTotalCentavos: pag.valorRecebidoCentavos,
          valorPorExtenso: '',
          partidas: [],
          saldoPendenteContratanteCentavos: 0,
          dataEmissao: pag.dataRecebimento,
          createdAt: pag.createdAt
        });
      }
    }
  };

  const handleGlobalNavigate = (module: string, entityId?: string) => {
    if (module === 'contratantes') {
      setActiveModule('contratantes');
      setTargetContractorFilterId(entityId);
    } else if (module === 'partidas') {
      setActiveModule('partidas');
    } else if (module === 'pagamentos') {
      setActiveModule('pagamentos');
      setTargetPaymentFilterId(entityId);
    } else if (module === 'cobrancas') {
      setActiveModule('cobrancas');
    } else if (module === 'agenda') {
      setActiveModule('agenda');
    } else if (module === 'financeiro') {
      setActiveModule('financeiro');
    } else if (module === 'jogos_fixos') {
      setActiveModule('jogos_fixos');
    }
  };

  // Se o usuário está acessando diretamente o Extrato Público pelo link com token
  if (portalContractor) {
    return (
      <ContractorPortalView
        contratante={portalContractor}
        onBack={() => {
          setPortalContractor(null);
          // Limpa parâmetro da URL sem recarregar
          window.history.replaceState({}, '', window.location.pathname);
        }}
        isStandalone={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col font-sans selection:bg-[#22C7E8] selection:text-slate-950">
      {/* Top Navbar & Mobile Bottom Nav */}
      <Navigation
        activeModule={activeModule}
        onSelectModule={m => {
          setActiveModule(m);
          setTargetPaymentFilterId(undefined);
          setTargetContractorFilterId(undefined);
        }}
        onOpenSearch={() => setSearchModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeModule === 'hoje' && (
          <TodayView
            onNavigate={handleGlobalNavigate}
            onNewMatch={() => handleOpenNewMatch()}
            onNewPayment={handleOpenNewPayment}
            onEditMatch={handleEditMatch}
          />
        )}

        {activeModule === 'agenda' && (
          <ScheduleView
            onNewMatch={date => handleOpenNewMatch(date)}
            onEditMatch={handleEditMatch}
            onPayMatch={handleOpenNewPayment}
          />
        )}

        {activeModule === 'partidas' && (
          <MatchesView
            onNewMatch={() => handleOpenNewMatch()}
            onEditMatch={handleEditMatch}
            onPayMatch={handleOpenNewPayment}
            onViewReceiptByPaymentId={handleViewReceiptByPaymentId}
          />
        )}

        {activeModule === 'jogos_fixos' && <FixedGamesView />}

        {activeModule === 'contratantes' && (
          <ContractorsView
            initialSelectedId={targetContractorFilterId}
            onOpenContractorPortal={c => setPortalContractor(c)}
            onPayContractor={cId => handleOpenNewPayment(cId)}
            onViewReceipt={r => setActiveReceipt(r)}
          />
        )}

        {activeModule === 'cobrancas' && <BillingsView />}

        {activeModule === 'pagamentos' && (
          <PaymentsView
            filterPaymentId={targetPaymentFilterId}
            onNewPayment={() => handleOpenNewPayment()}
            onViewReceipt={r => setActiveReceipt(r)}
            onRequestReversal={p => setReversalTarget(p)}
          />
        )}

        {activeModule === 'financeiro' && (
          <FinancialView
            onPayContractor={(cId, pIds) => handleOpenNewPayment(cId, pIds)}
            onOpenContractorPortal={c => setPortalContractor(c)}
          />
        )}

        {activeModule === 'relatorios' && <ReportsView />}

        {activeModule === 'configuracoes' && <SettingsView />}
      </main>

      {/* Modals Globais */}
      {matchModalOpen && (
        <MatchFormModal
          partidaToEdit={editingMatch}
          initialDate={matchModalInitialDate}
          onClose={() => setMatchModalOpen(false)}
          onSuccess={() => setTick(t => t + 1)}
        />
      )}

      {paymentModalOpen && (
        <PaymentModal
          initialContratanteId={paymentInitialContratanteId}
          initialSelectedPartidasIds={paymentInitialSelectedPartidasIds}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {activeReceipt && (
        <ReceiptModal
          recibo={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {reversalTarget && (
        <ReversalModal
          pagamento={reversalTarget}
          onClose={() => setReversalTarget(null)}
          onSuccess={() => setTick(t => t + 1)}
        />
      )}

      {searchModalOpen && (
        <GlobalSearchModal
          onClose={() => setSearchModalOpen(false)}
          onNavigate={handleGlobalNavigate}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
