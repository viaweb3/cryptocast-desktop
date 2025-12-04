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
  const [priceInfo, setPriceInfo] = useState<PriceInfo>({ eth: 0, matic: 0, sol: 0 });
  const [gasPrices, setGasPrices] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    // Initialize price data
    updatePrices();

    // Set up periodic updates
    const interval = setInterval(updatePrices, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const updatePrices = async () => {
    try {
      if (window.electronAPI?.price) {
        // Get main token prices
        const prices = await window.electronAPI.price.getPrices(['ETH', 'MATIC', 'SOL']);
        setPriceInfo({
          eth: prices.ETH || 0,
          matic: prices.MATIC || 0,
          sol: prices.SOL || 0
        });

        // Get Gas prices - Use new gas service
        try {
          const chains = await window.electronAPI.chain.getEVMChains(true);
          const ethChain = chains.find(c => c.name.toLowerCase().includes('ethereum'));
          const polygonChain = chains.find(c => c.name.toLowerCase().includes('polygon'));

          if (ethChain && priceInfo.eth > 0) {
            const ethGasInfo = await window.electronAPI.gas.getInfo(ethChain.rpcUrl, 'ethereum', priceInfo.eth);
            if (ethGasInfo.gasPrice) {
              setGasPrices(prev => ({
                ...prev,
                'ethereum': parseFloat(ethGasInfo.gasPrice)
              }));
            }
          }

          if (polygonChain && priceInfo.matic > 0) {
            const polygonGasInfo = await window.electronAPI.gas.getInfo(polygonChain.rpcUrl, 'polygon', priceInfo.matic);
            if (polygonGasInfo.gasPrice) {
              setGasPrices(prev => ({
                ...prev,
                'polygon': parseFloat(polygonGasInfo.gasPrice)
              }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch gas prices:', error);
        }
      }
    } catch (error) {
      console.error('Failed to update prices:', error);
    }
  };

  const navItems = [
    { path: '/', label: '📊 Dashboard', icon: '📊' },
    { path: '/campaign/create', label: '➕ New Campaign', icon: '➕' },
    { path: '/history', label: '📜 History', icon: '📜' },
    { path: '/settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatGasPrice = (gasPrice: number) => {
    return `${gasPrice.toFixed(0)} Gwei`;
  };

  return (
    <div className="flex h-screen bg-cryptocast-dark text-white">
      {/* Sidebar */}
      <aside className="w-72 bg-cryptocast-secondary p-6 border-r border-gray-800">
        <div className="mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cryptocast-purple via-cryptocast-cyan to-cryptocast-green bg-clip-text text-transparent">
            CryptoCast
          </h1>
          <p className="text-xs text-gray-500 mt-1">Dashboard v1.0.0</p>
        </div>

        {/* Price display */}
        <div className="mb-6 card-cryptocast p-4 rounded-xl">
          <h3 className="text-xs font-semibold mb-4 text-cryptocast-purple flex items-center">
            <span className="mr-2">💰</span>
            Live Prices
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-gray-400 font-medium">ETH</span>
              <span className="font-mono text-cryptocast-cyan font-semibold">{formatPrice(priceInfo.eth)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-gray-400 font-medium">MATIC</span>
              <span className="font-mono text-cryptocast-purple font-semibold">{formatPrice(priceInfo.matic)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-gray-400 font-medium">SOL</span>
              <span className="font-mono text-cryptocast-green font-semibold">{formatPrice(priceInfo.sol)}</span>
            </div>
          </div>
        </div>

        {/* Gas price display */}
        <div className="mb-8 card-cryptocast p-4 rounded-xl">
          <h3 className="text-xs font-semibold mb-4 text-cryptocast-cyan flex items-center">
            <span className="mr-2">⚡</span>
            Gas Prices
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-gray-400 font-medium">Ethereum</span>
              <span className="font-mono text-yellow-400 font-semibold">
                {gasPrices.ethereum ? formatGasPrice(gasPrices.ethereum) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-gray-400 font-medium">Polygon</span>
              <span className="font-mono text-green-400 font-semibold">
                {gasPrices.polygon ? formatGasPrice(gasPrices.polygon) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-gradient-to-r from-cryptocast-purple to-cryptocast-cyan text-white shadow-lg cryptocast-glow-purple'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="text-lg mr-3">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-auto p-10 bg-gradient-to-br from-cryptocast-dark via-cryptocast-dark to-cryptocast-dark-light">
        {children}
      </main>
    </div>
  );
}
