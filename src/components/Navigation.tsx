import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Users,
  DollarSign,
  Repeat,
  FileText,
  BarChart3,
  Settings,
  Search,
  Shield,
  Menu,
  X,
  CreditCard,
  CheckCircle2
} from 'lucide-react';

export type ActiveModule =
  | 'hoje'
  | 'agenda'
  | 'partidas'
  | 'jogos_fixos'
  | 'contratantes'
  | 'cobrancas'
  | 'pagamentos'
  | 'financeiro'
  | 'relatorios'
  | 'configuracoes';

interface NavigationProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onOpenSearch: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeModule,
  onSelectModule,
  onOpenSearch
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'hoje', label: 'Hoje', icon: Calendar },
    { id: 'agenda', label: 'Agenda', icon: Clock },
    { id: 'partidas', label: 'Partidas', icon: CheckCircle2 },
    { id: 'jogos_fixos', label: 'Jogos Fixos', icon: Repeat },
    { id: 'contratantes', label: 'Contratantes', icon: Users },
    { id: 'cobrancas', label: 'Cobranças', icon: FileText },
    { id: 'pagamentos', label: 'Pagamentos', icon: DollarSign },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings }
  ] as const;

  // Itens fixos na barra inferior do celular (mobile bottom bar)
  const mobileBottomItems = [
    { id: 'hoje', label: 'Hoje', icon: Calendar },
    { id: 'agenda', label: 'Agenda', icon: Clock },
    { id: 'partidas', label: 'Partidas', icon: CheckCircle2 },
    { id: 'contratantes', label: 'Clientes', icon: Users },
    { id: 'pagamentos', label: 'Pagar', icon: DollarSign }
  ] as const;

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0B1220]/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectModule('hoje')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#22C7E8]/50 shadow-md shadow-[#22C7E8]/20 transition-transform group-hover:scale-105 shrink-0 bg-[#0B1220]">
                <img
                  src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
                  alt="ProGestor Goleiro Pro"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                  PRO<span className="text-[#22C7E8]">GESTOR</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#22C7E8]/15 text-[#22C7E8] border border-[#22C7E8]/40">
                    GP
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                  Goleiro Pro • Gestão & Finanças
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id as ActiveModule)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#22C7E8] text-slate-950 font-bold shadow-md shadow-[#22C7E8]/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Search Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSearch}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#111A2E] hover:bg-[#16223B] border border-slate-700/80 text-slate-300 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
              title="Busca Global"
            >
              <Search className="w-4 h-4 text-[#22C7E8]" />
              <span className="hidden sm:inline">Buscar...</span>
            </button>

            {/* Mobile Hamburger Menu (abre gaveta com todos os 10 módulos) */}
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="xl:hidden p-2 rounded-xl bg-[#111A2E] border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu quando aberto */}
      {mobileMenuOpen && (
        <div className="xl:hidden fixed inset-0 top-16 z-40 bg-[#0B1220]/98 backdrop-blur-lg p-5 flex flex-col justify-between overflow-y-auto animate-in fade-in pb-24">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
              Todos os Módulos
            </div>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectModule(item.id as ActiveModule);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#22C7E8] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-[#111A2E]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-800 text-center flex items-center justify-center gap-3">
            <img
              src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
              alt="ProGestor"
              className="w-7 h-7 rounded-lg border border-[#22C7E8]/40"
            />
            <div className="text-left">
              <div className="text-xs font-bold text-white leading-tight">ProGestor • Goleiro Pro</div>
              <div className="text-[10px] text-slate-500">Gestão Profissional de Partidas & Finanças</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Mobile First - 5 botões de acesso instantâneo) */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0B1220]/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around">
        {mobileBottomItems.map(item => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectModule(item.id as ActiveModule);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-[#22C7E8]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
