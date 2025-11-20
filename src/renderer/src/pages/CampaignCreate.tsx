import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CSVValidationResult, CampaignEstimate } from '../types';

interface CampaignFormData {
  name: string;
  description: string;
  chain: string;
  tokenAddress: string;
  startDate: string;
  endDate: string;
  remarks: string;
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    chain: '',
    tokenAddress: '',
    startDate: '',
    endDate: '',
    remarks: '',
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvValidation, setCsvValidation] = useState<CSVValidationResult | null>(null);
  const [campaignEstimate, setCampaignEstimate] = useState<CampaignEstimate | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableChains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://mainnet.infura.io/v3/' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', rpcUrl: 'https://polygon-rpc.com' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    { id: 'bsc', name: 'BSC', symbol: 'BNB', rpcUrl: 'https://bsc-dataseed1.binance.org' },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH', rpcUrl: 'https://mainnet.optimism.io' },
  ];

  const stepTitles = ['基本信息', '上传文件', '预览确认', '创建活动'];
  const totalSteps = 4;

  useEffect(() => {
    // Auto-validate token address when changed
    if (formData.tokenAddress && csvValidation) {
      validateAndEstimate();
    }
  }, [formData.tokenAddress, csvValidation]);

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      alert('请输入活动名称');
      return false;
    }
    if (!formData.chain) {
      alert('请选择区块链网络');
      return false;
    }
    if (!formData.tokenAddress.trim()) {
      alert('请输入代币合约地址');
      return false;
    }
    if (!formData.startDate) {
      alert('请选择开始日期');
      return false;
    }
    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(formData.tokenAddress)) {
      alert('请输入有效的以太坊地址');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!csvFile) {
      alert('请上传CSV文件');
      return false;
    }
    if (!csvValidation?.isValid && csvValidation?.invalidRecords > 0) {
      const proceed = confirm(`发现 ${csvValidation.invalidRecords} 条无效记录，是否继续？`);
      return proceed;
    }
    return true;
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('请上传CSV格式文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('文件大小不能超过10MB');
      return;
    }

    setCsvFile(file);
    try {
      const validation = await actions.validateCSV(file);
      setCsvValidation(validation);
      if (!validation.isValid) {
        alert(`CSV验证失败：${validation.errors.length} 个错误`);
      }
    } catch (error) {
      alert(`文件处理失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const validateAndEstimate = async () => {
    if (!csvValidation) return;

    try {
      const estimate = await actions.estimateCampaign({
        totalRecipients: csvValidation.validRecords,
        totalAmount: csvValidation.sampleData.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0).toString(),
        chain: formData.chain,
      });
      setCampaignEstimate(estimate);
    } catch (error) {
      console.error('Estimation failed:', error);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateCampaign = async () => {
    if (!csvValidation) return;

    setIsSubmitting(true);
    try {
      const campaignData: Partial<Campaign> = {
        ...formData,
        totalRecipients: csvValidation.validRecords,
        totalAmount: csvValidation.sampleData.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0).toString(),
        status: 'CREATED',
        completedRecipients: 0,
        failedRecipients: 0,
        completedAmount: '0',
        gasUsed: '0',
        gasEstimate: campaignEstimate?.gasEstimate || '0',
        batchSize: 100,
        sendInterval: 2000,
        tokenSymbol: 'TOKEN', // Would be fetched from contract
        tokenDecimals: 18,
      };

      const campaign = await actions.createCampaign(campaignData);
      alert('活动创建成功！');
      navigate(`/campaign/${campaign.id}`);
    } catch (error) {
      alert(`创建活动失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {stepTitles.map((title, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              index + 1 <= currentStep
                ? 'bg-primary text-white'
                : 'bg-border text-medium'
            }`}
          >
            {index + 1 <= currentStep ? '✓' : index + 1}
          </div>
          <span className={`ml-2 text-sm font-medium ${
            index + 1 <= currentStep ? 'text-primary' : 'text-medium'
          }`}>
            {title}
          </span>
          {index < stepTitles.length - 1 && (
            <div className={`w-16 h-1 mx-4 ${
              index < currentStep ? 'bg-primary' : 'bg-border'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            活动名称 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="输入活动名称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            区块链网络 *
          </label>
          <div className="grid grid-cols-5 gap-3">
            {availableChains.map(chain => (
              <button
                key={chain.id}
                type="button"
                onClick={() => setFormData({ ...formData, chain: chain.id })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.chain === chain.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto mb-1 rounded-full ${
                    chain.id === 'ethereum' ? 'bg-blue-500' :
                    chain.id === 'polygon' ? 'bg-purple-500' :
                    chain.id === 'arbitrum' ? 'bg-blue-600' :
                    chain.id === 'base' ? 'bg-blue-400' :
                    chain.id === 'optimism' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`}></div>
                  <div className="text-xs font-medium">{chain.name}</div>
                  <div className="text-xs text-gray-500">{chain.symbol}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            开始日期 *
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            结束日期
          </label>
          <input
            type="date"
            value={formData.endDate}
            min={formData.startDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          代币合约地址 *
        </label>
        <input
          type="text"
          value={formData.tokenAddress}
          onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
          className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
          placeholder="0x..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          活动描述
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="描述活动详情..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          备注信息
        </label>
        <textarea
          value={formData.remarks}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="备注信息..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-dark mb-4">
          上传接收地址文件 (CSV格式)
        </label>
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
          }}
          onClick={() => document.getElementById('csv-file')?.click()}
        >
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
          <div className="text-4xl mb-4">📁</div>
          <div className="text-lg font-medium text-dark mb-2">
            拖拽文件到此处或点击上传
          </div>
          <div className="text-sm text-light">
            支持 CSV 格式，最大 10MB
          </div>
        </div>
      </div>

      {csvFile && (
        <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-dark">{csvFile.name}</div>
              <div className="text-sm text-light">
                {(csvFile.size / 1024).toFixed(2)} KB
              </div>
            </div>
            <button
              onClick={() => {
                setCsvFile(null);
                setCsvValidation(null);
              }}
              className="text-danger hover:text-danger/80"
            >
              删除
            </button>
          </div>
        </div>
      )}

      {csvValidation && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-border rounded-lg">
            <h4 className="font-medium text-dark mb-3">文件信息</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-light">总记录数:</span>
                <span className="ml-2 font-medium">{csvValidation.totalRecords}</span>
              </div>
              <div>
                <span className="text-light">有效记录:</span>
                <span className="ml-2 font-medium text-success">{csvValidation.validRecords}</span>
              </div>
              <div>
                <span className="text-light">无效记录:</span>
                <span className="ml-2 font-medium text-danger">{csvValidation.invalidRecords}</span>
              </div>
            </div>
          </div>

          {csvValidation.errors.length > 0 && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
              <h4 className="font-medium text-danger mb-3">验证错误</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {csvValidation.errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">行 {error.row}:</span>
                    <span className="text-danger ml-2">{error.error}</span>
                  </div>
                ))}
                {csvValidation.errors.length > 10 && (
                  <div className="text-sm text-light">
                    ... 还有 {csvValidation.errors.length - 10} 个错误
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowPreviewModal(true)}
            className="btn btn-primary"
            disabled={csvValidation.totalRecords === 0}
          >
            预览数据
          </button>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-dark mb-4">活动信息确认</h3>
        <div className="p-6 bg-white border border-border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-light">活动名称:</span>
              <span className="ml-2 font-medium">{formData.name}</span>
            </div>
            <div>
              <span className="text-light">区块链:</span>
              <span className="ml-2 font-medium">
                {availableChains.find(c => c.id === formData.chain)?.name}
              </span>
            </div>
            <div>
              <span className="text-light">代币地址:</span>
              <span className="ml-2 font-medium font-mono text-sm">{formData.tokenAddress}</span>
            </div>
            <div>
              <span className="text-light">开始日期:</span>
              <span className="ml-2 font-medium">{formData.startDate}</span>
            </div>
          </div>
        </div>
      </div>

      {campaignEstimate && (
        <div>
          <h3 className="text-lg font-semibold text-dark mb-4">预估信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">{campaignEstimate.totalRecipients.toLocaleString()}</div>
              <div className="text-sm text-light">总接收地址数</div>
            </div>
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">{campaignEstimate.totalAmount}</div>
              <div className="text-sm text-light">总发送金额</div>
            </div>
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">{campaignEstimate.gasEstimate}</div>
              <div className="text-sm text-light">预估 Gas 消耗</div>
            </div>
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">${campaignEstimate.gasCostUSD.toFixed(2)}</div>
              <div className="text-sm text-light">预估 Gas 费用</div>
            </div>
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">约 {Math.ceil(campaignEstimate.estimatedTime / 60)} 分钟</div>
              <div className="text-sm text-light">预计耗时</div>
            </div>
            <div className="p-6 bg-white border border-border rounded-lg">
              <div className="text-3xl font-bold text-dark mb-2">{campaignEstimate.batchCount}</div>
              <div className="text-sm text-light">批次数量 (每批100个)</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-warning font-medium">历史成功率:</span>
              <span className="font-bold">{campaignEstimate.successProbability}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center py-12">
      <div className="text-6xl mb-6">🎉</div>
      <h3 className="text-2xl font-bold text-dark mb-4">准备创建活动</h3>
      <p className="text-light mb-8">
        点击下方按钮创建您的空投活动，系统将自动部署智能合约并开始处理。
      </p>
      <div className="inline-flex items-center gap-2 p-4 bg-info/10 border border-info/20 rounded-lg mb-8">
        <span className="text-info font-medium">⚠️</span>
        <span className="text-sm text-info">
          创建后将自动扣除 Gas 费用，请确保钱包余额充足
        </span>
      </div>
    </div>
  );

  const renderPreviewModal = () => {
    if (!showPreviewModal || !csvValidation) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-dark">CSV 数据预览</h3>
            <button
              onClick={() => setShowPreviewModal(false)}
              className="text-light hover:text-dark"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4">地址</th>
                  <th className="text-right py-2 px-4">金额</th>
                  <th className="text-center py-2 px-4">状态</th>
                </tr>
              </thead>
              <tbody>
                {csvValidation.sampleData.map((recipient, index) => (
                  <tr key={index} className="border-b border-border-light">
                    <td className="py-2 px-4 font-mono text-xs">{recipient.address}</td>
                    <td className="py-2 px-4 text-right">{recipient.amount}</td>
                    <td className="py-2 px-4 text-center">
                      <span className="status-badge status-success">有效</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvValidation.totalRecords > 5 && (
              <div className="text-center py-4 text-light text-sm">
                显示前 5 条记录，共 {csvValidation.totalRecords} 条
              </div>
            )}
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button
              onClick={() => setShowPreviewModal(false)}
              className="btn btn-ghost"
            >
              关闭
            </button>
            <button
              onClick={() => {
                setShowPreviewModal(false);
                handleNext();
              }}
              className="btn btn-primary"
            >
              继续使用
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-dark">创建新活动</h1>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
        >
          返回
        </button>
      </div>

      {renderStepIndicator()}

      <div className="bg-white rounded-lg border border-border p-8">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`btn ${currentStep === 1 ? 'btn-ghost opacity-50 cursor-not-allowed' : 'btn-ghost'}`}
        >
          上一步
        </button>

        <div className="flex gap-4">
          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="btn btn-primary"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleCreateCampaign}
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? '创建中...' : '创建活动'}
            </button>
          )}
        </div>
      </div>

      {renderPreviewModal()}
    </div>
  );
}