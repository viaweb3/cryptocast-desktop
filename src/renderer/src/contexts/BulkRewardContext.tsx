import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  BulkRewardActivity,
  BulkRewardRecipient,
  BulkRewardBatch,
  BulkRewardDashboardData,
  BulkRewardEstimate,
  BulkRewardCSVValidation,
  BulkRewardFilter,
  BulkRewardSettings
} from '../types';

interface BulkRewardState {
  activities: BulkRewardActivity[];
  currentActivity: BulkRewardActivity | null;
  recipients: BulkRewardRecipient[];
  batches: BulkRewardBatch[];
  dashboardData: BulkRewardDashboardData | null;
  settings: BulkRewardSettings | null;
  filters: BulkRewardFilter;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
}

type BulkRewardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVITIES'; payload: BulkRewardActivity[] }
  | { type: 'SET_CURRENT_ACTIVITY'; payload: BulkRewardActivity | null }
  | { type: 'ADD_ACTIVITY'; payload: BulkRewardActivity }
  | { type: 'UPDATE_ACTIVITY'; payload: BulkRewardActivity }
  | { type: 'DELETE_ACTIVITY'; payload: string }
  | { type: 'SET_RECIPIENTS'; payload: BulkRewardRecipient[] }
  | { type: 'SET_BATCHES'; payload: BulkRewardBatch[] }
  | { type: 'SET_DASHBOARD_DATA'; payload: BulkRewardDashboardData }
  | { type: 'SET_SETTINGS'; payload: BulkRewardSettings }
  | { type: 'SET_FILTERS'; payload: Partial<BulkRewardFilter> }
  | { type: 'SET_PAGINATION'; payload: Partial<BulkRewardState['pagination']> }
  | { type: 'RESET_STATE' };

const initialState: BulkRewardState = {
  activities: [],
  currentActivity: null,
  recipients: [],
  batches: [],
  dashboardData: null,
  settings: null,
  filters: {
    status: 'ALL',
    chain: 'ALL',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 10,
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,
};

function bulkRewardReducer(state: BulkRewardState, action: BulkRewardAction): BulkRewardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload, isLoading: false };
    case 'SET_CURRENT_ACTIVITY':
      return { ...state, currentActivity: action.payload };
    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.payload, ...state.activities] };
    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.map(activity =>
          activity.id === action.payload.id ? action.payload : activity
        ),
        currentActivity: state.currentActivity?.id === action.payload.id ? action.payload : state.currentActivity,
      };
    case 'DELETE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.filter(activity => activity.id !== action.payload),
        currentActivity: state.currentActivity?.id === action.payload ? null : state.currentActivity,
      };
    case 'SET_RECIPIENTS':
      return { ...state, recipients: action.payload };
    case 'SET_BATCHES':
      return { ...state, batches: action.payload };
    case 'SET_DASHBOARD_DATA':
      return { ...state, dashboardData: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
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

interface BulkRewardContextType {
  state: BulkRewardState;
  actions: {
    loadDashboardData: () => Promise<void>;
    loadActivities: (filters?: BulkRewardFilter) => Promise<void>;
    getActivity: (id: string) => Promise<void>;
    createActivity: (activityData: any) => Promise<BulkRewardActivity>;
    updateActivity: (id: string, updates: any) => Promise<void>;
    deleteActivity: (id: string) => Promise<void>;
    startActivity: (id: string) => Promise<void>;
    pauseActivity: (id: string) => Promise<void>;
    resumeActivity: (id: string) => Promise<void>;
    cancelActivity: (id: string) => Promise<void>;
    validateCSV: (file: File) => Promise<BulkRewardCSVValidation>;
    estimateActivity: (activityData: any) => Promise<BulkRewardEstimate>;
    loadRecipients: (activityId: string) => Promise<void>;
    loadBatches: (activityId: string) => Promise<void>;
    exportActivity: (activityId: string, format?: string) => Promise<{ success: boolean; filePath?: string }>;
    exportAllActivities: (format?: string) => Promise<{ success: boolean; filePath?: string }>;
    setFilters: (filters: Partial<BulkRewardFilter>) => void;
    setPagination: (pagination: Partial<BulkRewardState['pagination']>) => void;
    refreshActivity: (id: string) => Promise<void>;
  };
}

const BulkRewardContext = createContext<BulkRewardContextType | undefined>(undefined);

export function BulkRewardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bulkRewardReducer, initialState);

  const actions: BulkRewardContextType['actions'] = {
    loadDashboardData: async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Mock implementation - replace with actual API calls
        const mockDashboardData: BulkRewardDashboardData = {
          statistics: {
            totalActivities: 42,
            successfulActivities: 38,
            failedActivities: 2,
            ongoingActivities: 2,
            totalRecipients: 18523,
            completedRecipients: 18230,
            failedRecipients: 293,
            totalGasUsed: '0.45',
            totalGasCostUSD: 1125,
            weeklyActivities: 5,
            weeklyGasCostUSD: 180,
            successRate: 98.5,
            averageSuccessRate: 98.5,
          },
          ongoingActivities: [
            {
              id: '1',
              name: '2025-01 营销活动',
              chain: 'polygon',
              chainName: 'Polygon',
              tokenAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              status: 'SENDING',
              totalRecipients: 1000,
              completedRecipients: 750,
              failedRecipients: 0,
              pendingRecipients: 250,
              totalAmount: '500',
              completedAmount: '375',
              failedAmount: '0',
              gasUsed: '0.03',
              gasEstimate: '0.04',
              gasCostUSD: 75,
              walletAddress: '0x1234567890123456789012345678901234567890',
              tokenContractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
              createdAt: '2025-01-15T10:00:00Z',
              updatedAt: '2025-01-20T15:30:00Z',
              startedAt: '2025-01-15T10:30:00Z',
              batchSize: 100,
              sendInterval: 2000,
            },
            {
              id: '2',
              name: '2025-01 社区奖励',
              chain: 'arbitrum',
              chainName: 'Arbitrum',
              tokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              status: 'READY',
              totalRecipients: 500,
              completedRecipients: 0,
              failedRecipients: 0,
              pendingRecipients: 500,
              totalAmount: '100',
              completedAmount: '0',
              failedAmount: '0',
              gasUsed: '0',
              gasEstimate: '0.015',
              gasCostUSD: 30,
              walletAddress: '0x2345678901234567890123456789012345678901',
              tokenContractAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
              createdAt: '2025-01-18T09:00:00Z',
              updatedAt: '2025-01-19T14:00:00Z',
              batchSize: 50,
              sendInterval: 3000,
            }
          ],
          recentActivities: [
            {
              id: '3',
              name: '2024-12 新年奖励',
              chain: 'base',
              chainName: 'Base',
              tokenAddress: '0x4200000000000000000000000000000000000006',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              status: 'COMPLETED',
              totalRecipients: 2000,
              completedRecipients: 2000,
              failedRecipients: 0,
              pendingRecipients: 0,
              totalAmount: '200',
              completedAmount: '200',
              failedAmount: '0',
              gasUsed: '0.08',
              gasEstimate: '0.08',
              gasCostUSD: 200,
              walletAddress: '0x3456789012345678901234567890123456789012',
              tokenContractAddress: '0x4200000000000000000000000000000000000006',
              createdAt: '2024-12-20T14:00:00Z',
              updatedAt: '2024-12-25T18:00:00Z',
              completedAt: '2024-12-25T17:30:00Z',
              batchSize: 100,
              sendInterval: 2000,
            }
          ],
          chainDistribution: {
            polygon: 25,
            arbitrum: 10,
            base: 5,
            optimism: 2,
          },
          weeklyTrends: [
            { date: '2025-01-14', activities: 3, recipients: 1500, gasCost: 120 },
            { date: '2025-01-15', activities: 5, recipients: 3200, gasCost: 250 },
            { date: '2025-01-16', activities: 2, recipients: 800, gasCost: 65 },
            { date: '2025-01-17', activities: 4, recipients: 2100, gasCost: 180 },
            { date: '2025-01-18', activities: 6, recipients: 3800, gasCost: 320 },
            { date: '2025-01-19', activities: 3, recipients: 1900, gasCost: 160 },
            { date: '2025-01-20', activities: 2, recipients: 1200, gasCost: 95 },
          ]
        };

        dispatch({ type: 'SET_DASHBOARD_DATA', payload: mockDashboardData });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load dashboard data' });
      }
    },

    loadActivities: async (filters) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Mock implementation
        const mockActivities: BulkRewardActivity[] = [
          // Include dashboard activities plus more
        ];

        dispatch({ type: 'SET_ACTIVITIES', payload: mockActivities });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load activities' });
      }
    },

    getActivity: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Mock implementation - find in existing activities or fetch from API
        const activity = state.activities.find(a => a.id === id);
        if (activity) {
          dispatch({ type: 'SET_CURRENT_ACTIVITY', payload: activity });
        } else {
          // Fetch from API
          const mockActivity: BulkRewardActivity = {
            id: id,
            name: 'Sample Activity',
            chain: 'polygon',
            chainName: 'Polygon',
            tokenAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            tokenSymbol: 'WETH',
            tokenDecimals: 18,
            status: 'CREATED',
            totalRecipients: 100,
            completedRecipients: 0,
            failedRecipients: 0,
            pendingRecipients: 100,
            totalAmount: '10',
            completedAmount: '0',
            failedAmount: '0',
            gasUsed: '0',
            gasEstimate: '0.005',
            gasCostUSD: 12.5,
            walletAddress: '0x1234567890123456789012345678901234567890',
            tokenContractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            batchSize: 50,
            sendInterval: 2000,
          };
          dispatch({ type: 'SET_CURRENT_ACTIVITY', payload: mockActivity });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load activity' });
      }
    },

    createActivity: async (activityData) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Mock implementation
        const newActivity: BulkRewardActivity = {
          id: Date.now().toString(),
          ...activityData,
          status: 'CREATED',
          totalRecipients: activityData.recipients?.length || 0,
          completedRecipients: 0,
          failedRecipients: 0,
          pendingRecipients: activityData.recipients?.length || 0,
          gasUsed: '0',
          gasEstimate: '0.1',
          gasCostUSD: 250,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        dispatch({ type: 'ADD_ACTIVITY', payload: newActivity });
        return newActivity;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create activity' });
        throw error;
      }
    },

    updateActivity: async (id, updates) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const currentActivity = state.activities.find(a => a.id === id);
        if (!currentActivity) {
          throw new Error('Activity not found');
        }

        const updatedActivity = { ...currentActivity, ...updates, updatedAt: new Date().toISOString() };
        dispatch({ type: 'UPDATE_ACTIVITY', payload: updatedActivity });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update activity' });
        throw error;
      }
    },

    deleteActivity: async (id) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // API call to delete activity
        dispatch({ type: 'DELETE_ACTIVITY', payload: id });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete activity' });
        throw error;
      }
    },

    startActivity: async (id) => {
      try {
        await actions.updateActivity(id, { status: 'SENDING', startedAt: new Date().toISOString() });
      } catch (error) {
        throw error;
      }
    },

    pauseActivity: async (id) => {
      try {
        await actions.updateActivity(id, { status: 'PAUSED' });
      } catch (error) {
        throw error;
      }
    },

    resumeActivity: async (id) => {
      try {
        await actions.updateActivity(id, { status: 'SENDING' });
      } catch (error) {
        throw error;
      }
    },

    cancelActivity: async (id) => {
      try {
        await actions.updateActivity(id, { status: 'FAILED' });
      } catch (error) {
        throw error;
      }
    },

    validateCSV: async (file: File) => {
      try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          throw new Error('CSV file is empty or invalid');
        }

        const recipients: BulkRewardRecipient[] = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 2) continue;

          const [address, amount] = values;
          const recipient: BulkRewardRecipient = {
            id: `temp-${i}`,
            activityId: 'temp',
            address,
            amount,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Basic validation
          if (!address.startsWith('0x') || address.length !== 42) {
            errors.push({
              row: i + 1,
              address,
              amount,
              error: 'Invalid Ethereum address format',
            });
          }

          if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            errors.push({
              row: i + 1,
              address,
              amount,
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
          duplicateRecords: 0,
          totalAmount: recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0).toString(),
          errors,
          sampleData: recipients.slice(0, 5),
        };
      } catch (error) {
        throw new Error(`CSV validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    estimateActivity: async (activityData) => {
      try {
        const totalRecipients = activityData.recipients?.length || 0;
        const totalAmount = activityData.totalAmount || '0';
        const gasEstimate = (totalRecipients * 0.0001).toString();
        const gasCostUSD = 2000 * parseFloat(gasEstimate);
        const estimatedTime = Math.ceil(totalRecipients / 100) * 2;

        return {
          totalRecipients,
          totalAmount,
          gasEstimate,
          gasCostUSD,
          estimatedTime,
          batchCount: Math.ceil(totalRecipients / 100),
          successProbability: 98.5,
          costPerRecipient: gasCostUSD / totalRecipients,
        };
      } catch (error) {
        throw new Error(`Estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    loadRecipients: async (activityId) => {
      try {
        // Mock implementation
        const mockRecipients: BulkRewardRecipient[] = [];
        dispatch({ type: 'SET_RECIPIENTS', payload: mockRecipients });
      } catch (error) {
        console.error('Failed to load recipients:', error);
      }
    },

    loadBatches: async (activityId) => {
      try {
        // Mock implementation
        const mockBatches: BulkRewardBatch[] = [];
        dispatch({ type: 'SET_BATCHES', payload: mockBatches });
      } catch (error) {
        console.error('Failed to load batches:', error);
      }
    },

    exportActivity: async (activityId, format = 'csv') => {
      try {
        // Mock implementation
        return { success: true, filePath: `/tmp/activity_${activityId}.${format}` };
      } catch (error) {
        throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    exportAllActivities: async (format = 'csv') => {
      try {
        // Mock implementation
        return { success: true, filePath: `/tmp/all_activities.${format}` };
      } catch (error) {
        throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    setFilters: (filters) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
    },

    setPagination: (pagination) => {
      dispatch({ type: 'SET_PAGINATION', payload: pagination });
    },

    refreshActivity: async (id) => {
      try {
        // Re-fetch activity data
        await actions.getActivity(id);
        await actions.loadRecipients(id);
        await actions.loadBatches(id);
      } catch (error) {
        console.error('Failed to refresh activity:', error);
      }
    },
  };

  useEffect(() => {
    actions.loadDashboardData();
  }, []);

  const value = { state, actions };
  return <BulkRewardContext.Provider value={value}>{children}</BulkRewardContext.Provider>;
}

export function useBulkReward() {
  const context = useContext(BulkRewardContext);
  if (context === undefined) {
    throw new Error('useBulkReward must be used within a BulkRewardProvider');
  }
  return context;
}