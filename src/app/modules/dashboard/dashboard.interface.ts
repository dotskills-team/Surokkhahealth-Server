export interface IDashboardSummary {
  totalRevenue: number;

  totalSubscriptions: number;

  activeSubscriptions: number;

  pendingSubscriptions: number;

  expiredSubscriptions: number;

  cancelledSubscriptions: number;

  paidSubscriptions: number;

  unpaidSubscriptions: number;

  totalCustomers: number;

  totalPackages: number;

  totalAgents: number;

  totalAgentLeaders: number;

  averageRevenue: number;
}

export interface IDashboardPackageRevenue {
  packageId: string;
  packageName: string;
  subscriptions: number;
  totalRevenue: number;
  averageRevenue: number;
}

export interface IDashboardOverviewCard {
  subscriptions: number;
  revenue: number;
  averageRevenue: number;
  packageWiseRevenue: IDashboardPackageRevenue[];
}

export interface IDashboardOverview {
  today: IDashboardOverviewCard;
  month: IDashboardOverviewCard;
  lifetime: IDashboardOverviewCard;
}

export interface IRecentSubscription {
  _id: string;

  customerName: string;

  customerPhone: string;

  customerPicture?: string;

  packageName: string;

  amount: number;

  paymentStatus: string;

  subscriptionStatus: string;

  agentName: string;

  agentRole: string;

  createdAt: Date;
}

export interface IRecentCustomer {
  _id: string;

  name: string;

  phone: string;

  picture?: string;

  createdBy: string;

  createdByRole: string;

  createdAt: Date;

  totalSubscriptions: number;

  totalSpent: number;
}

export interface IDashboardResponse {

  summary: IDashboardSummary;

  overview: IDashboardOverview;

  topPackages: IDashboardPackageRevenue[];

  revenueChart: {
    month: string;
    revenue: number;
    subscriptions: number;
  }[];

  subscriptionStatusChart: {
    name: string;
    value: number;
  }[];

  paymentStatusChart: {
    name: string;
    value: number;
  }[];

  recentSubscriptions: IRecentSubscription[];

  recentCustomers: IRecentCustomer[];
}

export interface IManagerDashboardSummary {
  totalPartners: number;
  activePartners: number;
  inactivePartners: number;

  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
}

export interface IRecentPartner {
  _id: string;

  name: string;

  logo?: string;

  email?: string;

  phone?: string;

  isActive: boolean;

  createdAt: Date;
}

export interface IRecentBranch {
  _id: string;

  name: string;

  partner: {
    _id: string;
    name: string;
    logo?: string;
  };

  phone?: string;

  email?: string;

  city?: string;

  address?: string;

  isActive: boolean;

  createdAt: Date;
}

export interface IManagerDashboardResponse {
  summary: IManagerDashboardSummary;

  recentPartners: IRecentPartner[];

  recentBranches: IRecentBranch[];
}