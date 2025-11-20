import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Campaign, Recipient, Transaction, CampaignEstimate, CSVValidationResult, CampaignStatus } from '../types';

interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status: CampaignStatus[];
    chain: string[];
    dateRange?: { start: string; end: string };
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type CampaignAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CAMPAIGNS'; payload: Campaign[] }
  | { type: 'ADD_CAMPAIGN'; payload: Campaign }
  | { type: 'UPDATE_CAMPAIGN'; payload: Campaign }
  | { type: 'SET_CURRENT_CAMPAIGN'; payload: Campaign | null }
  | { type: 'SET_FILTERS'; payload: Partial<CampaignState['filters']> }
  | { type: 'SET_PAGINATION'; payload: Partial<CampaignState['pagination']> }
  | { type: 'RESET_STATE' };

const initialState: CampaignState = {
  campaigns: [],
  currentCampaign: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    chain: [],
    search: '',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

function campaignReducer(state: CampaignState, action: CampaignAction): CampaignState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_CAMPAIGNS':
      return { ...state, campaigns: action.payload, isLoading: false };
    case 'ADD_CAMPAIGN':
      return { ...state, campaigns: [...state.campaigns, action.payload] };
    case 'UPDATE_CAMPAIGN':
      return {
        ...state,
        campaigns: state.campaigns.map(campaign =>
          campaign.id === action.payload.id ? action.payload : campaign
        ),
        currentCampaign: state.currentCampaign?.id === action.payload.id ? action.payload : state.currentCampaign,
      };
    case 'SET_CURRENT_CAMPAIGN':
      return { ...state, currentCampaign: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload }, pagination: { ...state.pagination, page: 1 } };
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

interface CampaignContextType {
  state: CampaignState;
  actions: {
    loadCampaigns: (filters?: CampaignState['filters']) => Promise<void>;
    createCampaign: (campaignData: Partial<Campaign>) => Promise<Campaign>;
    updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
    deleteCampaign: (id: string) => Promise<void>;
    getCampaign: (id: string) => Promise<Campaign | null>;
    startCampaign: (id: string) => Promise<void>;
    pauseCampaign: (id: string) => Promise<void>;
    cancelCampaign: (id: string) => Promise<void>;
    validateCSV: (file: File) => Promise<CSVValidationResult>;
    estimateCampaign: (campaignData: Partial<Campaign>) => Promise<CampaignEstimate>;
    setFilters: (filters: Partial<CampaignState['filters']>) => void;
    setPagination: (pagination: Partial<CampaignState['pagination']>) => void;
    exportReport: (campaignId: string, format?: string) => Promise<{ success: boolean; filePath?: string }>;
  };
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(campaignReducer, initialState);

  const actions: CampaignContextType['actions'] = {
    loadCampaigns: async (filters) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (window.electronAPI?.campaign) {
          const campaigns = await window.electronAPI.campaign.list(filters);
          dispatch({ type: 'SET_CAMPAIGNS', payload: campaigns });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load campaigns' });
      }
    },

    createCampaign: async (campaignData) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (window.electronAPI?.campaign) {
          const campaign = await window.electronAPI.campaign.create(campaignData);
          dispatch({ type: 'ADD_CAMPAIGN', payload: campaign });
          return campaign;
        }
        throw new Error('Electron API not available');
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create campaign' });
        throw error;
      }
    },

    updateCampaign: async (id, updates) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // For now, we'll update the local state
        // In a real implementation, this would call the backend API
        const currentCampaign = state.campaigns.find(c => c.id === id);
        if (currentCampaign) {
          const updatedCampaign = { ...currentCampaign, ...updates, updatedAt: new Date().toISOString() };
          dispatch({ type: 'UPDATE_CAMPAIGN', payload: updatedCampaign });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update campaign' });
        throw error;
      }
    },

    deleteCampaign: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Implementation would call backend API
        const updatedCampaigns = state.campaigns.filter(c => c.id !== id);
        dispatch({ type: 'SET_CAMPAIGNS', payload: updatedCampaigns });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete campaign' });
        throw error;
      }
    },

    getCampaign: async (id) => {
      try {
        if (window.electronAPI?.campaign) {
          const campaign = await window.electronAPI.campaign.getById(id);
          dispatch({ type: 'SET_CURRENT_CAMPAIGN', payload: campaign });
          return campaign;
        }
        return null;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to get campaign' });
        return null;
      }
    },

    startCampaign: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (window.electronAPI?.campaign) {
          await window.electronAPI.campaign.start(id);
          await actions.loadCampaigns();
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to start campaign' });
        throw error;
      }
    },

    pauseCampaign: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (window.electronAPI?.campaign) {
          await window.electronAPI.campaign.pause(id);
          await actions.loadCampaigns();
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to pause campaign' });
        throw error;
      }
    },

    cancelCampaign: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await actions.updateCampaign(id, { status: 'CANCELLED' });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to cancel campaign' });
        throw error;
      }
    },

    validateCSV: async (file) => {
      try {
        // Mock CSV validation for now
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          throw new Error('CSV file is empty or invalid');
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        if (!headers.includes('address') || !headers.includes('amount')) {
          throw new Error('CSV must contain address and amount columns');
        }

        const recipients: Recipient[] = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 2) continue;

          const [address, amount] = values;
          const recipient: Recipient = {
            id: `temp-${i}`,
            campaignId: 'temp',
            address,
            amount,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Basic validation
          if (!address.startsWith('0x') || address.length !== 42) {
            errors.push({
              row: i + 1,
              field: 'address',
              value: address,
              error: 'Invalid Ethereum address format',
            });
          }

          if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            errors.push({
              row: i + 1,
              field: 'amount',
              value: amount,
              error: 'Amount must be a positive number',
            });
          }

          recipients.push(recipient);
        }

        return {
          isValid: errors.length === 0,
          totalRecords: recipients.length,
          validRecords: recipients.length - errors.length,
          invalidRecords: errors.length,
          errors,
          sampleData: recipients.slice(0, 5),
        };
      } catch (error) {
        throw new Error(`CSV validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    estimateCampaign: async (campaignData) => {
      try {
        // Mock estimation calculation
        const totalRecipients = campaignData.totalRecipients || 0;
        const totalAmount = campaignData.totalAmount || '0';
        const gasEstimate = (totalRecipients * 0.001).toString(); // 0.001 ETH per tx
        const gasCostUSD = 2000 * parseFloat(gasEstimate); // Assuming $2000 ETH price
        const estimatedTime = Math.ceil(totalRecipients / 100) * 2; // 100 tx per batch, 2 seconds per batch
        const batchCount = Math.ceil(totalRecipients / 100);

        return {
          totalRecipients,
          totalAmount,
          gasEstimate,
          gasCostUSD,
          estimatedTime,
          batchCount,
          successProbability: 98.5,
        };
      } catch (error) {
        throw new Error(`Campaign estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    setFilters: (filters) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
    },

    setPagination: (pagination) => {
      dispatch({ type: 'SET_PAGINATION', payload: pagination });
    },

    exportReport: async (campaignId, format = 'csv') => {
      try {
        if (window.electronAPI?.file) {
          const result = await window.electronAPI.file.exportReport(campaignId, format);
          return result;
        }
        return { success: false };
      } catch (error) {
        throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };

  useEffect(() => {
    actions.loadCampaigns();
  }, []);

  const value = { state, actions };
  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}