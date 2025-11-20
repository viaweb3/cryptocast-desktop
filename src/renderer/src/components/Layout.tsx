import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

interface PriceInfo {
  eth: number;
  matic: number;
  sol: number;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({ eth: 3685.42, matic: 0.92, sol: 178.35 });

  const navItems = [
    { path: '/', label: '仪表盘', icon: '🏠' },
    { path: '/campaign/create', label: '活动', icon: '📊' },
    { path: '/history', label: '历史', icon: '📜' },
    { path: '/wallets', label: '钱包', icon: '👛' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - 200px width */}
      <aside className="w-[200px] bg-sidebar flex flex-col">
        {/* Logo Area */}
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold text-dark">CryptoCast</h1>
          <p className="text-xs text-light mt-1">空投测试</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-6 py-3 transition-all cursor-pointer ${
                location.pathname === item.path
                  ? 'bg-primary text-white'
                  : 'text-medium hover:bg-sidebar-active'
              }`}
            >
              <span className="icon-sm">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Price & Gas Info - Bottom Section */}
        <div className="p-4 border-t border-border space-y-4">
          {/* Prices */}
          <div className="bg-white p-4 rounded-lg border border-border">
            <h3 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">💰 实时价格</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-medium">ETH</span>
                <span className="text-xs font-semibold">{formatPrice(priceInfo.eth)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-medium">MATIC</span>
                <span className="text-xs font-semibold">{formatPrice(priceInfo.matic)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-medium">SOL</span>
                <span className="text-xs font-semibold">{formatPrice(priceInfo.sol)}</span>
              </div>
            </div>
          </div>

          {/* Gas Prices */}
          <div className="bg-white p-4 rounded-lg border border-border">
            <h3 className="text-xs font-semibold text-info mb-3 uppercase tracking-wide">⚡ Gas价格</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-medium">Ethereum</span>
                <span className="text-xs font-semibold text-warning">28 Gwei</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-medium">Polygon</span>
                <span className="text-xs font-semibold text-success">95 Gwei</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-[60px] bg-white border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold text-dark">
              {navItems.find(item => item.path === location.pathname)?.label || '仪表盘'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <button className="icon-md text-medium cursor-pointer hover:text-dark">🔔</button>
            <button className="icon-md text-medium cursor-pointer hover:text-dark">💬</button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                A
              </div>
              <span className="text-sm font-medium text-dark">Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}