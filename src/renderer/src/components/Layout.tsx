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
    <div className="flex h-screen bg-base-200">
      {/* Sidebar - 180px width */}
      <aside className="w-[180px] bg-base-100 flex flex-col border-r border-base-300">
        {/* Logo Area */}
        <div className="p-5 border-b border-base-300">
          <h1 className="text-lg font-bold text-primary">CryptoCast</h1>
          <p className="text-xs text-base-content/60 mt-1">空投测试</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block mb-1"
            >
              <div className={`flex items-center gap-4 px-4 py-3 rounded-btn transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-content font-semibold'
                  : 'hover:bg-base-200 text-base-content'
              }`}>
                <span className={`text-xl ${location.pathname === item.path ? '' : 'opacity-70'}`}>
                  {item.icon}
                </span>
                <span className={`text-sm ${
                  location.pathname === item.path
                    ? 'font-semibold'
                    : ''
                }`}>
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Price & Gas Info - Bottom Section */}
        <div className="p-4 border-t border-base-300 space-y-4">
          {/* Prices */}
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💰</span>
              <h3 className="text-xs font-semibold text-info uppercase tracking-wide">实时价格</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium">ETH</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.eth)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs font-medium">MATIC</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.matic)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium">SOL</span>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(priceInfo.sol)}</span>
              </div>
            </div>
          </div>

          {/* Gas Prices */}
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚡</span>
              <h3 className="text-xs font-semibold text-warning uppercase tracking-wide">Gas价格</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Ethereum</span>
                <div className="badge badge-warning badge-sm">28 Gwei</div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Polygon</span>
                <div className="badge badge-success badge-sm">95 Gwei</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}