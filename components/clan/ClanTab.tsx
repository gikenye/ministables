"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  Clock, 
  Target, 
  Star,
  ChevronRight,
  Globe,
  Lock,
  Crown,
  Calendar,
  DollarSign,
  UserPlus,
  Eye,
  Share2,
  MoreHorizontal,
  Zap,
  Award,
  Activity
} from 'lucide-react';
import { ActionButton, InfoCard, ProgressBar } from '@/components/ui';
import { GroupSavingsGoal } from '@/lib/services/backendApiService';
import { Account, MyGroups } from '@/lib/types/shared';

interface ClanTabProps {
  account?: Account;
  groupGoals: GroupSavingsGoal[];
  myGroups?: MyGroups;
  groupGoalsLoading: boolean;
  myGroupsLoading: boolean;
  onCreateGroupGoal: () => void;
  onJoinGroupGoal: (goal: GroupSavingsGoal) => void;
  onRefreshGroups: () => void;
  exchangeRate?: number;
}

// Enhanced Group Goal Card Component
const GroupGoalCard = ({ 
  goal, 
  isMyGroup = false, 
  onJoin, 
  onView, 
  exchangeRate 
}: { 
  goal: GroupSavingsGoal; 
  isMyGroup?: boolean;
  onJoin: () => void;
  onView: () => void;
  exchangeRate?: number;
}) => {
  const progress = goal.progressPercent || 0;

  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      const kesAmount = usdAmount * exchangeRate;
      return `KES ${kesAmount.toLocaleString()}`;
    }
    return `$${usdAmount.toLocaleString()}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'travel': return '✈️';
      case 'education': return '🎓';
      case 'business': return '💼';
      case 'health': return '🏥';
      case 'home': return '🏠';
      case 'emergency': return '🚨';
      default: return '💰';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'completed': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/40 rounded-xl p-4 hover:border-cyan-400/50 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="text-2xl">{getCategoryIcon(goal.category || 'other')}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate group-hover:text-cyan-400 transition-colors">
              {goal.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {goal.isPublic ? (
                <Globe className="w-3 h-3 text-green-400" />
              ) : (
                <Lock className="w-3 h-3 text-yellow-400" />
              )}
              <span className={`text-xs ${getStatusColor(goal.status || 'active')}`}>
                {goal.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
        
        {isMyGroup && (
          <div className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-400">Owner</span>
          </div>
        )}
      </div>

      {/* Target Amount */}
      <div className="mb-3">
        <div className="text-lg font-bold text-cyan-400">
          {formatAmount(goal.targetAmountUSD || 0)}
        </div>
        <div className="text-xs text-gray-400">Target Amount</div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Progress</span>
          <span className="text-xs text-cyan-400">{progress.toFixed(1)}%</span>
        </div>
        <ProgressBar 
          progress={progress} 
          className="h-2 bg-gray-700 rounded-full overflow-hidden"
          fillClassName="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500"
        />
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>{formatAmount(goal.totalProgressUSD || 0)} raised</span>
          <span>{goal.participants?.length || 0} members</span>
        </div>
      </div>

      {/* Creator & Timeline */}
      <div className="mb-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Users className="w-3 h-3" />
          <span>Created by {goal.creatorAddress?.slice(0, 6)}...{goal.creatorAddress?.slice(-4)}</span>
        </div>
        {goal.targetDate && goal.targetDate !== "0" && goal.targetDate !== "" && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <ActionButton
          onClick={onJoin}
          variant="primary"
          size="sm"
          className="flex-1 text-xs py-2"
          disabled={isMyGroup}
        >
          {isMyGroup ? 'Manage' : 'Join'}
        </ActionButton>
        <ActionButton
          onClick={onView}
          variant="outline"
          size="sm"
          className="flex-1 text-xs py-2"
        >
          View Details
        </ActionButton>
      </div>
    </div>
  );
};

// Quick Stats Component
const QuickStats = ({ groupGoals, loading }: { groupGoals: GroupSavingsGoal[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800/20 rounded-lg p-3 animate-pulse">
            <div className="h-4 bg-gray-600 rounded mb-2"></div>
            <div className="h-6 bg-gray-600 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const totalGroups = groupGoals.length;
  const publicGroups = groupGoals.filter(goal => goal.isPublic === true).length;
  const privateGroups = groupGoals.filter(goal => goal.isPublic === false || goal.isPublic === undefined).length;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <InfoCard variant="stats" className="text-center p-3">
        <div className="text-xs text-gray-400 mb-1">Total Groups</div>
        <div className="text-lg font-bold text-white">{totalGroups}</div>
      </InfoCard>
      <InfoCard variant="stats" className="text-center p-3">
        <div className="text-xs text-gray-400 mb-1">Public</div>
        <div className="text-lg font-bold text-green-400">{publicGroups}</div>
      </InfoCard>
      <InfoCard variant="stats" className="text-center p-3">
        <div className="text-xs text-gray-400 mb-1">Private</div>
        <div className="text-lg font-bold text-yellow-400">{privateGroups}</div>
      </InfoCard>
    </div>
  );
};

// Search and Filter Component
const SearchAndFilter = ({ 
  searchQuery, 
  onSearchChange, 
  selectedCategory, 
  onCategoryChange 
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}) => {
  const categories = [
    { id: 'all', label: 'All', icon: '🌟' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'education', label: 'Education', icon: '🎓' },
    { id: 'business', label: 'Business', icon: '💼' },
    { id: 'health', label: 'Health', icon: '🏥' },
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'emergency', label: 'Emergency', icon: '🚨' },
  ];

  return (
    <div className="space-y-3 mb-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search group goals..."
          className="w-full pl-10 pr-4 py-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-cyan-400 text-gray-900'
                : 'bg-gray-800/30 text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <span>{category.icon}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ 
  type, 
  onCreateGroup 
}: { 
  type: 'myGroups' | 'publicGroups'; 
  onCreateGroup: () => void;
}) => {
  if (type === 'myGroups') {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Groups Yet</h3>
        <p className="text-gray-400 mb-6 text-sm">
          You haven't joined any savings groups yet. Create your first group or join an existing one.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <ActionButton onClick={onCreateGroup} variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </ActionButton>
          <ActionButton onClick={() => {}} variant="outline" size="md">
            <Search className="w-4 h-4 mr-2" />
            Browse Groups
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Globe className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Public Groups</h3>
      <p className="text-gray-400 mb-6 text-sm">
        Be the first to create a public savings group for the community.
      </p>
      <ActionButton onClick={onCreateGroup} variant="primary" size="md">
        <Plus className="w-4 h-4 mr-2" />
        Create First Group
      </ActionButton>
    </div>
  );
};

// Main Clan Tab Component
export const ClanTab: React.FC<ClanTabProps> = ({
  account,
  groupGoals,
  myGroups,
  groupGoalsLoading,
  myGroupsLoading,
  onCreateGroupGoal,
  onJoinGroupGoal,
  onRefreshGroups,
  exchangeRate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeSection, setActiveSection] = useState<'discover' | 'myGroups'>('discover');

  // Filter group goals based on search and category
  const filteredGroupGoals = groupGoals.filter(goal => {
    const matchesSearch = goal.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || goal.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Clan</h2>
            <p className="text-sm text-gray-400">Save together, achieve more</p>
          </div>
        </div>
        
        <ActionButton
          onClick={onCreateGroupGoal}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create Group</span>
        </ActionButton>
      </div>

      {/* Quick Stats */}
      <QuickStats groupGoals={groupGoals} loading={groupGoalsLoading} />

      {/* Section Toggle */}
      <div className="flex bg-gray-800/20 backdrop-blur-sm rounded-lg p-1">
        <button
          onClick={() => setActiveSection('discover')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeSection === 'discover'
              ? 'bg-cyan-400 text-gray-900'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" />
            <span>Discover</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSection('myGroups')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeSection === 'myGroups'
              ? 'bg-cyan-400 text-gray-900'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            <span>My Groups</span>
            {account?.address && groupGoals.filter(goal => goal.creatorAddress === account.address).length > 0 && (
              <span className="bg-cyan-400 text-gray-900 text-xs px-1.5 py-0.5 rounded-full">
                {groupGoals.filter(goal => goal.creatorAddress === account.address).length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Content based on active section */}
      {activeSection === 'discover' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <SearchAndFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          {/* Public Groups Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Public Groups
              </h3>
              <button
                onClick={onRefreshGroups}
                className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                disabled={groupGoalsLoading}
              >
                {groupGoalsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {groupGoalsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-800/20 rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-gray-600 rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-600 rounded mb-1"></div>
                        <div className="h-3 bg-gray-600 rounded w-20"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-600 rounded mb-3"></div>
                    <div className="h-2 bg-gray-600 rounded mb-4"></div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 bg-gray-600 rounded"></div>
                      <div className="flex-1 h-8 bg-gray-600 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGroupGoals.length === 0 ? (
              <EmptyState type="publicGroups" onCreateGroup={onCreateGroupGoal} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroupGoals.map((goal) => (
                  <GroupGoalCard
                    key={goal.metaGoalId}
                    goal={goal}
                    onJoin={() => onJoinGroupGoal(goal)}
                    onView={() => {}}
                    exchangeRate={exchangeRate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'myGroups' && (
        <div className="space-y-6">
          {!account?.address ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Connect Wallet</h3>
              <p className="text-gray-400 text-sm">
                Connect your wallet to view and manage your savings groups.
              </p>
            </div>
          ) : groupGoalsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-800/20 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gray-600 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-600 rounded mb-1"></div>
                      <div className="h-3 bg-gray-600 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-600 rounded mb-3"></div>
                  <div className="h-2 bg-gray-600 rounded"></div>
                </div>
              ))}
            </div>
          ) : (() => {
            const myCreatedGroups = groupGoals.filter(goal => goal.creatorAddress === account.address);
            const myJoinedGroups = groupGoals.filter(goal => 
              goal.participants?.includes(account.address) && goal.creatorAddress !== account.address
            );
            const allMyGroups = [...myCreatedGroups, ...myJoinedGroups];
            
            if (allMyGroups.length === 0) {
              return <EmptyState type="myGroups" onCreateGroup={onCreateGroupGoal} />;
            }
            
            const myPublicGroups = allMyGroups.filter(goal => goal.isPublic === true);
            const myPrivateGroups = allMyGroups.filter(goal => goal.isPublic === false || goal.isPublic === undefined);
            
            return (
              <div className="space-y-6">
                {/* Public Groups */}
                {myPublicGroups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-green-400" />
                      Public Groups ({myPublicGroups.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myPublicGroups.map((goal) => (
                        <GroupGoalCard
                          key={goal.metaGoalId}
                          goal={goal}
                          isMyGroup={true}
                          onJoin={() => {}}
                          onView={() => {}}
                          exchangeRate={exchangeRate}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Private Groups */}
                {myPrivateGroups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-yellow-400" />
                      Private Groups ({myPrivateGroups.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myPrivateGroups.map((goal) => (
                        <GroupGoalCard
                          key={goal.metaGoalId}
                          goal={goal}
                          isMyGroup={true}
                          onJoin={() => {}}
                          onView={() => {}}
                          exchangeRate={exchangeRate}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
          }
        </div>
      )}
    </div>
  );
};

export default ClanTab;