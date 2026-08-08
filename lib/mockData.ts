// Mock content for each pod's side panel. Structured to mirror the real backend
// schema — swapping this file for a live data source shouldn't require any
// changes to the panel render layer.
import type { PodKey } from './phaser/theme';

export interface MockAgent {
  name: string;
  role: string;
  status: 'idle' | 'working' | 'reviewing' | 'blocked';
  currentTask?: string;
}

export interface MockActivity {
  timestamp: string;
  message: string;
}

export interface LabPanelData {
  name: string;
  tagline: string;
  agents: MockAgent[];
  stats: { label: string; value: string }[];
  activity: MockActivity[];
}

export const MOCK_LAB_DATA: Record<PodKey, LabPanelData> = {
  hudmeta: {
    name: 'Hudmeta',
    tagline: 'Command & routing — coordinates all labs',
    agents: [{ name: 'Hudmeta Core', role: 'Router/Commander', status: 'working' }],
    stats: [
      { label: 'Active Labs', value: '5' },
      { label: 'Pending Approvals', value: '2' },
      { label: 'Agents Online', value: '11' },
      { label: 'System Uptime', value: '4d 7h' },
    ],
    activity: [
      { timestamp: '3m ago', message: "Delegated 'Etsy autumn collection' idea to POD Lab" },
      { timestamp: '22m ago', message: 'Received status report from Dev Lab' },
      { timestamp: '1h ago', message: 'Approval requested: new affiliate campaign (Content Lab)' },
    ],
  },

  devLab: {
    name: 'Dev Lab',
    tagline: '4-agent pipeline — builds software, sites, and new agents',
    agents: [
      { name: 'Architect', role: 'Planning', status: 'idle' },
      { name: 'Coder', role: 'Implementation', status: 'working', currentTask: 'Revenue Bay panel component' },
      { name: 'Tester', role: 'QA', status: 'idle' },
      { name: 'Dev Manager', role: 'Review', status: 'idle' },
    ],
    stats: [
      { label: 'Active Projects', value: '1' },
      { label: 'Completed Builds', value: '7' },
      { label: 'Avg Build Time', value: '2.3h' },
      { label: 'Open Bugs', value: '0' },
    ],
    activity: [
      { timestamp: '8m ago', message: 'Coder started implementation on station panel component' },
      { timestamp: '1h ago', message: 'Architect flagged 2 clarifying questions on new spec' },
      { timestamp: '3h ago', message: 'Tester passed build #7 with no issues' },
    ],
  },

  podLab: {
    name: 'POD Lab',
    tagline: 'Print-on-demand — designs, listings, and store management',
    agents: [
      { name: 'Designer', role: 'Product design', status: 'working', currentTask: '3 new t-shirt designs' },
      { name: 'Listing Manager', role: 'Etsy/Printify sync', status: 'idle' },
    ],
    stats: [
      { label: 'Active Listings', value: '14' },
      { label: 'Listings This Week', value: '3' },
      { label: 'Best Seller', value: '"Sunset Wave Tee"' },
      { label: 'Store Status', value: 'Connected (Etsy + Printify)' },
    ],
    activity: [
      { timestamp: '15m ago', message: "New listing published: 'Retro Sunset Hoodie'" },
      { timestamp: '2h ago', message: 'Designer completed 3 new mockups, awaiting review' },
      { timestamp: '1d ago', message: 'Weekly listing quota met' },
    ],
  },

  contentLab: {
    name: 'Content Lab',
    tagline: 'Marketing/content pipeline — feeds POD and affiliate distribution',
    agents: [
      { name: 'Content Generator', role: 'UGC/affiliate content', status: 'working' },
      { name: 'Distributor', role: 'Scheduling/posting', status: 'idle' },
      { name: 'Performance Tracker', role: 'Analytics', status: 'idle' },
    ],
    stats: [
      { label: 'Posts This Week', value: '6' },
      { label: 'Platforms Connected', value: '2 (TikTok, YouTube)' },
      { label: 'Top Performer', value: 'POD Lab tee showcase — 12.4K views' },
      { label: 'Affiliate Links Active', value: '5' },
    ],
    activity: [
      { timestamp: '30m ago', message: 'Draft video queued for review' },
      { timestamp: '4h ago', message: 'Posted to TikTok: POD Lab product showcase' },
      { timestamp: '1d ago', message: 'Performance report generated' },
    ],
  },

  research: {
    name: 'Research & Trading Facility',
    tagline: 'Market research + trading intelligence — advisory only, manual execution',
    agents: [
      { name: 'Research Agent', role: 'Macro/company/sentiment', status: 'working' },
      { name: 'Futures Agent', role: 'MNQ/MES monitoring', status: 'idle' },
      { name: 'Stocks Agent', role: 'Equity scanning', status: 'idle' },
      { name: 'Crypto Agent', role: 'BTC/ETH monitoring', status: 'idle' },
    ],
    stats: [
      { label: 'Active Watchlist', value: '8 tickers' },
      { label: 'Setups Today', value: '2 (Grade A, Grade B)' },
      { label: 'Daily Risk Used', value: '0.25%' },
      { label: 'Execution Mode', value: 'MANUAL' },
    ],
    activity: [
      { timestamp: '5m ago', message: 'MNQ VWAP Reclaim setup detected, score 91/100' },
      { timestamp: '1h ago', message: 'Morning brief generated' },
      { timestamp: '3h ago', message: 'Research flagged Fed announcement risk window' },
    ],
  },

  revenueBay: {
    name: 'Revenue Bay',
    tagline: 'Cross-lab revenue tracking — measurement layer, not a producer',
    agents: [],
    stats: [
      { label: 'Revenue This Month', value: '$847 (mock)' },
      { label: 'Top Lab', value: 'POD Lab ($512)' },
      { label: 'Sources Connected', value: '2 of 6' },
      { label: 'Last Sync', value: '20m ago' },
    ],
    activity: [
      { timestamp: '20m ago', message: 'Etsy sync completed: 3 new sales recorded' },
      { timestamp: '1d ago', message: 'Weekly revenue summary generated' },
      { timestamp: '3d ago', message: 'Printify payout recorded: $210' },
    ],
  },
};
