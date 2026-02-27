import { Alert } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ThemeName, AppearanceMode, AccentName, getThemeColors, ThemeColors } from '../constants/Colors';
import { notificationService } from '../lib/NotificationService';
import * as Crypto from 'expo-crypto';
import { CATEGORIES, Category } from '../constants/Categories';

// --- ID Mapping Helpers ---
const mapToRealId = (localId: string, friends: Friend[], sessionUserId: string): string => {
    if (localId === 'self') return sessionUserId;
    const friend = friends.find(f => f.id === localId);
    return friend?.linkedUserId || localId; // Fallback to localId if not linked
};

const mapToLocalId = (realId: string, friends: Friend[], sessionUserId: string): string => {
    if (realId === sessionUserId) return 'self';
    const friend = friends.find(f => f.linkedUserId === realId);
    return friend?.id || realId; // Fallback to realId if no local friend found
};

const mapIdsToReal = (ids: string[], friends: Friend[], sessionUserId: string): string[] => {
    return ids.map(id => mapToRealId(id, friends, sessionUserId));
};

const mapSplitDetailsToReal = (details: Record<string, number>, friends: Friend[], sessionUserId: string): Record<string, number> => {
    const realDetails: Record<string, number> = {};
    Object.entries(details).forEach(([id, amount]) => {
        const realId = mapToRealId(id, friends, sessionUserId);
        realDetails[realId] = amount;
    });
    return realDetails;
};

// --------------------------

export interface Friend {
    id: string;
    name: string;
    balance: number;
    linkedUserId?: string;
    avatarUrl?: string;
}

export interface Group {
    id: string;
    name: string;
    members: string[]; // Friend IDs
    balance: number;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    payerId: string;
    payerName?: string;
    groupId?: string;
    splitWith: string[]; // Friend IDs
    date: string;
    splitType?: 'equal' | 'unequal';
    splitDetails?: { [id: string]: number }; // ID -> Amount (ID can be 'self' or friendId)
    category: string;
    isSettlement?: boolean;
    createdBy?: string;
    isPersonal?: boolean;
}

export interface MonthlyBudget {
    month: string; // e.g. "2023-11"
    categories: Record<string, number>; // Maps category ID to budget amount
}

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringExpense {
    id: string;
    description: string;
    amount: number;
    payerId: string;
    groupId?: string;
    splitWith: string[];
    splitType?: 'equal' | 'unequal';
    splitDetails?: { [id: string]: number };
    category: string;
    frequency: Frequency;
    nextDueDate: string; // ISO Date string
    active: boolean;
}

export interface ActivityLog {
    id: string;
    user_id: string;
    actor_id: string;
    entity_type: 'expense' | 'group' | 'settlement';
    entity_id: string;
    action: string;
    description: string;
    metadata?: {
        amount?: number;
        currency?: string;
        payer_name?: string;
        group_name?: string;
        split_type?: string;
        participants?: string[];
        [key: string]: any;
    };
    created_at: string;
    is_read: boolean;
}

export interface UserProfile {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
}

interface SplittyState {
    session: Session | null;
    setSession: (session: Session | null) => void;
    fetchData: () => Promise<void>;
    friends: Friend[];
    groups: Group[];
    expenses: Expense[];
    recurringExpenses: RecurringExpense[];
    activities: ActivityLog[];
    budgets: MonthlyBudget[];
    categories: Category[];
    addCategory: (category: Omit<Category, 'id'>) => void;
    deleteCategory: (categoryId: string) => void;
    getCategoryById: (categoryId: string) => Category;
    setCategoryBudget: (month: string, categoryId: string, amount: number) => void;
    autoFillBudget: (month: string) => void;
    addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
    deleteExpense: (id: string) => Promise<void>;
    editExpense: (id: string, updatedExpense: Omit<Expense, 'id' | 'date'>) => void;
    addRecurringExpense: (expense: Omit<RecurringExpense, 'id' | 'nextDueDate' | 'active'>) => void;
    deleteRecurringExpense: (id: string) => void;
    checkRecurringExpenses: () => number; // Returns number of created expenses
    addFriend: (name: string, linkedUserId?: string) => void;
    editFriend: (id: string, name: string, avatarUrl?: string) => Promise<void>;
    addGroup: (name: string, members: string[]) => void;
    deleteFriend: (id: string) => void;
    deleteGroup: (id: string) => void;
    editGroup: (id: string, name: string, members: string[]) => void;
    userProfile: UserProfile;
    updateUserProfile: (profile: Partial<UserProfile>) => void;
    clearData: () => void;
    theme: ThemeName; // Deprecated: use accent instead
    setTheme: (theme: ThemeName) => void;
    appearance: AppearanceMode;
    setAppearance: (mode: AppearanceMode) => void;
    accent: AccentName;
    setAccent: (accent: AccentName) => void;
    isDarkMode: boolean;
    toggleTheme: () => void; // Now toggles appearance
    colors: ThemeColors; // Helper to get merged colors directly from store
    currency: string;
    setCurrency: (currency: string) => void;
    getCurrencySymbol: () => string;
    formatCurrency: (amount: number) => string;
    settleUp: (payerId: string, receiverId: string, amount: number) => void;
    signOut: () => Promise<void>;
    subscribeToChanges: () => () => void;
    // Notifications
    notificationsEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => void;
    initNotifications: () => Promise<void>;
    // View Preferences
    dashboardViewPreference: 'tree' | 'list';
    setDashboardViewPreference: (pref: 'tree' | 'list') => void;
    unknownFriendNames: Record<string, string>;
}

const calculateBalances = (expenses: Expense[], friends: Friend[], groups: Group[]) => {
    // 1. Reset balances
    const newFriends = friends.map(f => ({ ...f, balance: 0 }));
    const newGroups = groups.map(g => ({ ...g, balance: 0 }));

    // 2. Iterate expenses
    expenses.forEach(expense => {
        let participants: string[] = [];
        if (expense.groupId) {
            const group = newGroups.find(g => g.id === expense.groupId);
            if (group) participants = [...group.members];
        } else if (expense.splitWith) {
            participants = [...expense.splitWith];
        }

        const amounts: { [id: string]: number } = {};
        if (expense.splitType === 'unequal' && expense.splitDetails) {
            Object.assign(amounts, expense.splitDetails);
        } else {
            const totalPeople = participants.length + 1; // + Self
            const splitAmount = expense.amount / totalPeople;
            amounts['self'] = splitAmount;
            participants.forEach(p => amounts[p] = splitAmount);
        }

        if (expense.payerId === 'self') {
            // User paid -> Friends owe User
            participants.forEach(friendId => {
                const amountOwed = amounts[friendId] || 0;
                if (amountOwed > 0) {
                    const friend = newFriends.find(f => f.id === friendId);
                    if (friend) {
                        friend.balance += amountOwed;
                    }
                }
            });

            if (expense.groupId) {
                const group = newGroups.find(g => g.id === expense.groupId);
                if (group) {
                    const ownShare = amounts['self'] || 0;
                    group.balance += (expense.amount - ownShare);
                }
            }
        } else {
            // Friend paid -> User owes Friend
            const payer = newFriends.find(f => f.id === expense.payerId);
            if (payer) {
                const myShare = amounts['self'] || 0;
                payer.balance -= myShare;

                if (expense.groupId) {
                    const group = newGroups.find(g => g.id === expense.groupId);
                    if (group) {
                        group.balance -= myShare;
                    }
                }
            }
        }
    });

    return { friends: newFriends, groups: newGroups };
};

export const useSplittyStore = create<SplittyState>()(
    persist(
        (set, get) => ({
            session: null,
            setSession: (session) => set({ session }),
            fetchData: async () => {
                console.log('🚀 fetchData started...');
                const { session } = get();
                if (!session?.user) {
                    console.log('⚠️ No session found in fetchData');
                    return;
                }

                const userId = session.user.id;

                // Fallback: Populate from session metadata first
                const meta = session.user.user_metadata;
                let userProfile = {
                    name: meta?.full_name || meta?.name || 'New User',
                    email: session.user.email || '',
                    avatar: meta?.avatar_url || meta?.picture || '',
                    phone: session.user.phone || ''
                };

                // Parallelize fetching for better performance
                const [profileRes, friendsRes, expensesRes, groupsRes, activitiesRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', userId).single(),
                    supabase.from('friends').select('*').order('name'),
                    // Fetch expenses AND their participants in one go
                    supabase.from('expenses').select(`
                        *,
                        expense_participants (
                            profile_id,
                            friend_id,
                            amount
                        )
                    `).order('date', { ascending: false }),
                    // Fetch Groups Logic: Get memberships -> Get Groups -> Get All Members
                    (async () => {
                        const { data: myMemberships } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
                        const myGroupIds = myMemberships?.map((m: any) => m.group_id) || [];

                        if (myGroupIds.length === 0) return { groups: [], members: [] };

                        const { data: groups } = await supabase.from('groups').select('*').in('id', myGroupIds).order('created_at', { ascending: false });
                        const { data: members } = await supabase.from('group_members').select('*').in('group_id', myGroupIds);
                        return { groups, members };
                    })(),
                    // Fetch Activity Logs
                    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50)
                ]);

                // 1. Handle Profile
                const { data: profileData, error: profileError } = profileRes;
                if (!profileError && profileData) {
                    userProfile = {
                        name: profileData.full_name || meta?.full_name || meta?.name || 'New User',
                        email: profileData.email || session.user.email || '',
                        avatar: profileData.avatar_url || meta?.avatar_url || meta?.picture || '',
                        phone: profileData.phone || ''
                    };
                }

                // Initialize strict types
                let loadedFriends: Friend[] = [];
                let loadedGroups: Group[] = [];
                let loadedExpenses: Expense[] = [];

                // 2. Handle Friends
                const { data: friendsData, error: friendsError } = friendsRes;
                if (!friendsError && friendsData) {
                    let mappedFriends: Friend[] = friendsData.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        linkedUserId: f.linked_user_id,
                        avatarUrl: f.avatar_url, // Read the local DB avatar_url
                        balance: 0
                    }));

                    // Fetch avatars/profiles for linked users
                    const linkedUserIds = mappedFriends
                        .map(f => f.linkedUserId)
                        .filter((id): id is string => !!id);

                    if (linkedUserIds.length > 0) {
                        const { data: linkedProfiles } = await supabase
                            .from('profiles')
                            .select('id, avatar_url')
                            .in('id', linkedUserIds);

                        if (linkedProfiles) {
                            const avatarMap = new Map(linkedProfiles.map((p: any) => [p.id, p.avatar_url]));
                            mappedFriends = mappedFriends.map(f => ({
                                ...f,
                                // Use linked profile avatar if it exists, otherwise fallback to local avatar_url
                                avatarUrl: f.linkedUserId ? (avatarMap.get(f.linkedUserId) || f.avatarUrl) : f.avatarUrl
                            }));
                        }
                    }
                    loadedFriends = mappedFriends;
                }

                // Hoist ID Mapping Helper
                const friendMap = new Map<string, string>(); // Real UUID -> Local Friend ID
                // friendsData is already available from line 247
                if (!friendsError && friendsData) {
                    friendsData.forEach((f: any) => {
                        if (f.linked_user_id) {
                            friendMap.set(f.linked_user_id, f.id);
                        }
                    });
                }

                const mapRealToLocal = (realId: string | null): string => {
                    if (!realId) return 'self';
                    if (realId === userId) return 'self';
                    return friendMap.get(realId) || realId; // Fallback to realId
                };

                // 3. Handle Groups
                const { groups: groupsData, members: groupMembersData } = groupsRes;

                if (groupsData) {
                    const mappedGroups: Group[] = groupsData
                        .filter((g: any) => {
                            // Soft delete: hide groups the current user has archived
                            const archivedBy: string[] = g.archived_by || [];
                            return !archivedBy.includes(userId);
                        })
                        .map((g: any) => {
                            // Get members for this group
                            const members = groupMembersData
                                ? groupMembersData
                                    .filter((gm: any) => gm.group_id === g.id)
                                    .map((gm: any) => mapRealToLocal(gm.user_id))
                                : [];

                            return {
                                id: g.id,
                                name: g.name,
                                members: members,
                                balance: 0
                            };
                        });
                    loadedGroups = mappedGroups;
                }

                // 4. Handle Expenses
                const { data: expensesData, error: expensesError } = expensesRes;
                if (!expensesError && expensesData) {
                    const mappedExpenses: Expense[] = expensesData.map((e: any) => {
                        const localPayerId = mapRealToLocal(e.payer_id);

                        // Map split_with
                        let localSplitWith: string[] = [];

                        // Map split_details
                        let localSplitDetails: Record<string, number> = {};

                        // NEW: Try reading from expense_participants first
                        if (e.expense_participants && e.expense_participants.length > 0) {
                            e.expense_participants.forEach((p: any) => {
                                // Determine local ID
                                let localId = 'unknown';
                                if (p.profile_id) {
                                    localId = mapRealToLocal(p.profile_id);
                                } else if (p.friend_id) {
                                    localId = mapRealToLocal(p.friend_id);
                                }

                                if (localId !== 'self') {
                                    localSplitWith.push(localId);
                                }

                                localSplitDetails[localId] = Number(p.amount);
                            });
                        } else {
                            // FALLBACK: Read from JSON (Old way)
                            localSplitWith = (e.split_with || [])
                                .map((realId: string) => mapRealToLocal(realId))
                                .filter((id: string) => id !== 'self');

                            if (e.split_details) {
                                Object.entries(e.split_details).forEach(([realId, amount]) => {
                                    localSplitDetails[mapRealToLocal(realId)] = Number(amount);
                                });
                            }
                        }

                        return {
                            id: e.id,
                            description: e.description,
                            amount: Number(e.amount),
                            payerId: localPayerId,
                            payerName: e.payer_name,
                            groupId: e.group_id,
                            splitWith: localSplitWith,
                            date: e.date,
                            splitType: e.split_type as any,
                            splitDetails: localSplitDetails,
                            category: e.category,
                            isSettlement: e.is_settlement,
                            isPersonal: e.is_personal,
                            createdBy: e.created_by
                        };
                    });
                    console.log(`✅ fetchData complete. Loaded ${mappedExpenses.length} expenses.`);
                    loadedExpenses = mappedExpenses;
                } else if (expensesError) {
                    console.error('❌ fetchData expenses error:', expensesError);
                }

                // 5. Calculate Balances
                // This ensures that friend balances are accurate based on fetched expense history
                const { friends: balancedFriends, groups: balancedGroups } = calculateBalances(loadedExpenses, loadedFriends, loadedGroups);

                // 5.5. Fetch Names for Unknown Friends (Local users of other people)
                let newUnknownFriendNames: Record<string, string> = {};
                if (loadedExpenses.length > 0) {
                    const knownFriendIds = new Set([userId, 'self', ...loadedFriends.map(f => f.id)]);
                    const unknownFriendIds = new Set<string>();

                    loadedExpenses.forEach(e => {
                        if (!knownFriendIds.has(e.payerId)) unknownFriendIds.add(e.payerId);
                        e.splitWith.forEach(id => {
                            if (!knownFriendIds.has(id)) unknownFriendIds.add(id);
                        });
                    });

                    if (unknownFriendIds.size > 0) {
                        // 1. Fetch friend records to get their name and user_id (creator)
                        const { data: missingFriendsData } = await supabase
                            .from('friends')
                            .select('id, name, user_id')
                            .in('id', Array.from(unknownFriendIds));

                        if (missingFriendsData && missingFriendsData.length > 0) {
                            // 2. Collect unique creator IDs
                            const creatorIds = new Set(
                                missingFriendsData
                                    .map((f: any) => f.user_id)
                                    .filter((id: string) => !!id && id !== userId) // Exclude current user just in case
                            );

                            // 3. Fetch creator profiles
                            const creatorMap = new Map<string, string>();
                            if (creatorIds.size > 0) {
                                const { data: creatorProfiles } = await supabase
                                    .from('profiles')
                                    .select('id, full_name, email')
                                    .in('id', Array.from(creatorIds));

                                if (creatorProfiles) {
                                    creatorProfiles.forEach((p: any) => {
                                        creatorMap.set(p.id, p.full_name || p.email?.split('@')[0] || 'Unknown User');
                                    });
                                }
                            }

                            // 4. Build the mapping
                            missingFriendsData.forEach((f: any) => {
                                const creatorName = creatorMap.get(f.user_id);
                                if (creatorName) {
                                    newUnknownFriendNames[f.id] = `Local user of ${creatorName}`;
                                } else {
                                    newUnknownFriendNames[f.id] = f.name ? `${f.name} (Local user)` : 'Unknown';
                                }
                            });
                        }
                    }
                }

                // 5.8: Sanitize Categories (Remove non-serializable React components from old states)
                let currentCategories = get().categories;
                let categoriesModified = false;

                const sanitizedCategories = currentCategories.map(cat => {
                    if (typeof cat.icon !== 'string') {
                        categoriesModified = true;
                        console.warn(`🧹 Sanitizing corrupted category icon for: ${cat.label}`);
                        return { ...cat, icon: 'MoreHorizontal' }; // Safe string fallback
                    }
                    return cat;
                });

                // 6. Set Final State
                const finalStateToSet: Partial<SplittyState> = {
                    userProfile,
                    friends: balancedFriends,
                    groups: balancedGroups,
                    expenses: loadedExpenses,
                    activities: (activitiesRes as any)?.data || [],
                    unknownFriendNames: newUnknownFriendNames
                };

                if (categoriesModified) {
                    finalStateToSet.categories = sanitizedCategories;
                }

                set(finalStateToSet);
            },
            friends: [
                { id: '1', name: 'Alwyn', balance: 450 },
                { id: '2', name: 'Manasa', balance: -329.50 },
            ],
            groups: [
                { id: 'g1', name: 'Rent & Bills', members: ['1', '2'], balance: 120.50 },
            ],
            expenses: [],
            activities: [],
            budgets: [],
            categories: CATEGORIES,
            unknownFriendNames: {},
            addCategory: (category) => set((state) => ({
                categories: [...state.categories, { ...category, id: Crypto.randomUUID() }]
            })),
            deleteCategory: (categoryId) => set((state) => {
                // Replace category of any expense using the deleted category with 'general'
                const updatedExpenses = state.expenses.map(e =>
                    e.category === categoryId ? { ...e, category: 'general' } : e
                );

                return {
                    categories: state.categories.filter(c => c.id !== categoryId),
                    expenses: updatedExpenses
                };
            }),
            getCategoryById: (categoryId) => {
                const { categories } = get();
                return categories.find(c => c.id === categoryId) || categories.find(c => c.id === 'general') || CATEGORIES[0];
            },
            setCategoryBudget: (month, categoryId, amount) => set((state) => {
                const existingBudgetIndex = state.budgets.findIndex(b => b.month === month);
                if (existingBudgetIndex >= 0) {
                    const newBudgets = [...state.budgets];
                    newBudgets[existingBudgetIndex] = {
                        ...newBudgets[existingBudgetIndex],
                        categories: {
                            ...newBudgets[existingBudgetIndex].categories,
                            [categoryId]: amount
                        }
                    };
                    return { budgets: newBudgets };
                } else {
                    return {
                        budgets: [...state.budgets, { month, categories: { [categoryId]: amount } }]
                    };
                }
            }),
            autoFillBudget: (month) => set((state) => {
                const currentMonthDate = new Date(`${month}-01T00:00:00Z`);
                const threeMonthsAgo = new Date(currentMonthDate);
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

                const recentExpenses = state.expenses.filter(e => {
                    if (e.isSettlement) return false;
                    const eDate = new Date(e.date);
                    return eDate >= threeMonthsAgo && eDate < currentMonthDate;
                });

                const categoryTotals: Record<string, number> = {};
                recentExpenses.forEach(e => {
                    let myShare = 0;
                    if (e.splitType === 'unequal' && e.splitDetails) {
                        myShare = e.splitDetails['self'] || 0;
                    } else {
                        const totalPeople = (e.splitWith?.length || 0) + 1;
                        myShare = e.amount / totalPeople;
                    }

                    if (myShare > 0) {
                        if (!categoryTotals[e.category]) categoryTotals[e.category] = 0;
                        categoryTotals[e.category] += myShare;
                    }
                });

                const newCategories: Record<string, number> = {};
                Object.entries(categoryTotals).forEach(([cat, total]) => {
                    const avg = Math.round(total / 3);
                    if (avg > 0) {
                        newCategories[cat] = avg;
                    }
                });

                const existingBudgetIndex = state.budgets.findIndex(b => b.month === month);
                if (existingBudgetIndex >= 0) {
                    const newBudgets = [...state.budgets];
                    newBudgets[existingBudgetIndex] = {
                        ...newBudgets[existingBudgetIndex],
                        categories: {
                            ...newBudgets[existingBudgetIndex].categories,
                            ...newCategories
                        }
                    };
                    return { budgets: newBudgets };
                } else {
                    return { budgets: [...state.budgets, { month, categories: newCategories }] };
                }
            }),
            userProfile: {
                name: 'Guest',
                email: '',
            },
            updateUserProfile: (profile) => set((state) => ({
                userProfile: { ...state.userProfile, ...profile }
            })),
            addFriend: (name: string, linkedUserId?: string) => {
                const newFriend = { id: Crypto.randomUUID(), name, balance: 0, linkedUserId };
                set((state) => ({
                    friends: [...state.friends, newFriend]
                }));

                const { session } = get();
                if (session?.user) {
                    supabase.from('friends').insert({
                        id: newFriend.id,
                        name: newFriend.name,
                        user_id: session.user.id,
                        linked_user_id: linkedUserId
                    }).then(({ error }) => {
                        if (error) console.error("Friend sync error:", error);
                    });
                }
            },
            editFriend: async (id: string, name: string, avatarUrl?: string) => {
                const { session } = get();
                if (!session?.user) throw new Error("Not authenticated");

                // Optmistic UI Update
                set((state) => ({
                    friends: state.friends.map(f =>
                        f.id === id ? { ...f, name, avatarUrl } : f
                    )
                }));

                const { error } = await supabase.from('friends')
                    .update({ name, avatar_url: avatarUrl || null })
                    .eq('id', id)
                    .eq('user_id', session.user.id);

                if (error) {
                    console.error("Edit friend sync error:", error);
                    // Revert on failure
                    get().fetchData();
                    throw new Error(error.message);
                }
            },
            addGroup: (name, members) => {
                const groupId = Crypto.randomUUID();
                set((state) => ({
                    groups: [...state.groups, { id: groupId, name, members, balance: 0 }]
                }));
                const { session } = get();
                if (session?.user) {
                    supabase.from('groups').insert({
                        id: groupId,
                        name,
                        created_by: session.user.id
                    }).then(({ error }) => {
                        if (!error) {
                            const memberInserts = [
                                { group_id: groupId, user_id: session.user.id },
                                ...members
                                    .filter(mId => mId !== 'self')
                                    .map(mId => {
                                        const friend = get().friends.find(f => f.id === mId);
                                        return friend?.linkedUserId ? friend.linkedUserId : null;
                                    })
                                    .filter((realId): realId is string => !!realId && realId !== session.user.id)
                                    .map(realId => ({ group_id: groupId, user_id: realId }))
                            ];

                            if (memberInserts.length > 1) {
                                supabase.from('group_members').insert(memberInserts).then(({ error: memberError }) => {
                                    if (memberError) {
                                        console.error("Error adding members:", memberError);
                                        Alert.alert("Error", "Group created but failed to sync some members. Ensure friends are linked to real users.");
                                    }
                                });
                            } else {
                                // Only the creator is in the group (online), valid for just creating the group container
                                console.log("Group created with only the creator locally linked.");
                            }
                        } else {
                            console.error("Error creating group:", error);
                            Alert.alert("Error", "Failed to create group on server.");
                            // Revert optimistic update
                            set((state) => ({
                                groups: state.groups.filter(g => g.id !== groupId)
                            }));
                        }
                    });
                }
            },
            clearData: () => set(() => ({
                friends: [],
                groups: [],
                expenses: [],
                recurringExpenses: [],
                budgets: [],
                categories: CATEGORIES,
                unknownFriendNames: {},
                session: null,
                userProfile: { name: 'Guest', email: '' }
            })),
            editExpense: (id, updatedExpense) => {
                console.log('📝 editExpense called:', updatedExpense.description);
                set((state) => {
                    const { session, friends, userProfile, fetchData } = get();
                    const oldExpense = state.expenses.find(e => e.id === id);
                    if (!oldExpense) return state;

                    const newExpenseFull = {
                        ...updatedExpense,
                        id,
                        date: oldExpense.date,
                        splitType: updatedExpense.splitType || 'equal',
                        splitDetails: updatedExpense.splitDetails || {},
                        isPersonal: updatedExpense.isPersonal
                    };

                    if (session?.user) {
                        const payer = friends.find(f => f.id === updatedExpense.payerId);
                        const payerName = updatedExpense.payerId === 'self' ? (userProfile.name || 'You') : (payer?.name || 'Someone');

                        // Map IDs to Real UUIDs for Supabase
                        const realPayerId = mapToRealId(updatedExpense.payerId, friends, session.user.id);
                        const realSplitWith = mapIdsToReal(newExpenseFull.splitWith, friends, session.user.id);
                        const realSplitDetails = newExpenseFull.splitDetails ? mapSplitDetailsToReal(newExpenseFull.splitDetails, friends, session.user.id) : {};

                        // 1. Update main expenses table
                        supabase.from('expenses').update({
                            description: newExpenseFull.description,
                            amount: newExpenseFull.amount,
                            payer_id: realPayerId === session.user.id ? session.user.id : (realPayerId || null),
                            payer_name: payerName,
                            group_id: newExpenseFull.groupId,
                            category: newExpenseFull.category,
                            split_type: newExpenseFull.splitType,
                            split_details: realSplitDetails,
                            split_with: realSplitWith,
                            is_personal: newExpenseFull.isPersonal
                        })
                            .eq('id', id)
                            .then(async ({ error }) => {
                                if (error) {
                                    console.error("Expense edit sync error:", error);
                                } else {
                                    // 2. Dual Write: Update expense_participants
                                    // First delete existing participants for this expense
                                    const { error: delError } = await supabase
                                        .from('expense_participants')
                                        .delete()
                                        .eq('expense_id', id);

                                    if (!delError) {
                                        const participantsToInsert = [];
                                        const allParticipants = new Set([...realSplitWith, realPayerId]);
                                        if (realPayerId === session.user.id) allParticipants.add(session.user.id);

                                        for (const realId of allParticipants) {
                                            let amount = 0;
                                            if (newExpenseFull.splitType === 'unequal') {
                                                amount = realSplitDetails[realId] || 0;
                                            } else {
                                                const count = (newExpenseFull.splitWith?.length || 0) + 1;
                                                amount = Number((newExpenseFull.amount / count).toFixed(2));
                                            }

                                            let pId = null;
                                            let fId = null;

                                            if (realId === session.user.id) {
                                                pId = realId;
                                            } else {
                                                const friendObj = friends.find(f => f.linkedUserId === realId);
                                                if (friendObj) {
                                                    pId = realId;
                                                } else {
                                                    const localFriend = friends.find(f => f.id === realId);
                                                    if (localFriend) {
                                                        fId = realId;
                                                    } else {
                                                        pId = realId;
                                                    }
                                                }
                                            }

                                            participantsToInsert.push({
                                                expense_id: id,
                                                profile_id: pId,
                                                friend_id: fId,
                                                amount: amount
                                            });
                                        }

                                        if (participantsToInsert.length > 0) {
                                            await supabase.from('expense_participants').insert(participantsToInsert);
                                        }
                                    }
                                }
                            });
                    }

                    const updatedExpenses = state.expenses.map(e => e.id === id ? newExpenseFull : e);
                    const { friends: newFriends, groups: newGroups } = calculateBalances(updatedExpenses, state.friends, state.groups);

                    return {
                        expenses: updatedExpenses,
                        friends: newFriends,
                        groups: newGroups
                    };
                });
            },
            theme: 'light',
            appearance: 'light',
            accent: 'classic',
            colors: getThemeColors('light', 'classic'),
            setTheme: (theme: ThemeName) => {
                let app: AppearanceMode = 'dark';
                let acc: AccentName = 'classic';
                if (theme === 'light') {
                    app = 'light';
                } else if (theme === 'midnight') {
                    acc = 'midnight';
                } else if (theme === 'sunset') {
                    acc = 'sunset';
                } else if (theme === 'forest') {
                    acc = 'forest';
                }
                set({
                    theme,
                    appearance: app,
                    accent: acc,
                    isDarkMode: app === 'dark',
                    colors: getThemeColors(app, acc)
                });
            },
            setAppearance: (appearance: AppearanceMode) => set((state) => ({
                appearance,
                isDarkMode: appearance === 'dark',
                colors: getThemeColors(appearance, state.accent)
            })),
            setAccent: (accent: AccentName) => set((state) => ({
                accent,
                colors: getThemeColors(state.appearance, accent)
            })),
            isDarkMode: false,
            notificationsEnabled: true,
            setNotificationsEnabled: (enabled: boolean) => set({ notificationsEnabled: enabled }),
            initNotifications: async () => {
                const token = await notificationService.registerForPushNotificationsAsync();
                if (token) {
                    console.log('Push Data: Local Notifications Ready');
                }
            },
            dashboardViewPreference: 'tree',
            setDashboardViewPreference: (pref) => set({ dashboardViewPreference: pref }),
            toggleTheme: () => set((state) => {
                const nextMode: AppearanceMode = state.appearance === 'light' ? 'dark' : 'light';
                return {
                    appearance: nextMode,
                    isDarkMode: nextMode === 'dark',
                    colors: getThemeColors(nextMode, state.accent)
                };
            }),
            signOut: async () => {
                await supabase.auth.signOut();
                get().clearData();
            },
            currency: 'USD',
            setCurrency: (currency) => set(() => ({ currency })),
            getCurrencySymbol: () => {
                const currency = get().currency;
                const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥' };
                return symbols[currency] || '$';
            },
            formatCurrency: (amount: number) => {
                const currency = get().currency;
                const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥' };
                const symbol = symbols[currency] || '$';
                return `${amount < 0 ? '-' : ''}${symbol}${Math.abs(amount).toFixed(2)}`;
            },
            settleUp: (payerId, receiverId, amount) => {
                const { addExpense, friends } = get();
                // Determine description
                // If payerId is self, "Paid [Friend]"
                // If receiverId is self, "[Friend] paid you"
                let description = 'Settlement';
                let splitDetails: Record<string, number> = {};
                let splitWith: string[] = [];

                if (payerId === 'self') {
                    const friend = friends.find(f => f.id === receiverId);
                    description = `Paid ${friend?.name || 'Friend'}`;
                    splitWith = [receiverId];
                    splitDetails = { 'self': 0, [receiverId]: amount };
                } else {
                    const friend = friends.find(f => f.id === payerId);
                    description = `${friend?.name || 'Friend'} paid you`;
                    splitWith = [payerId];
                    splitDetails = { 'self': amount, [payerId]: 0 };
                }

                addExpense({
                    description,
                    amount,
                    payerId,
                    splitWith,
                    splitType: 'unequal',
                    splitDetails,
                    category: 'general',
                    isSettlement: true
                });
            },
            addExpense: (expense) => {
                console.log('➕ addExpense called', expense.description);
                set((state) => {
                    const newExpense = {
                        ...expense,
                        id: Crypto.randomUUID(),
                        date: new Date().toISOString(),
                        splitType: expense.splitType || 'equal',
                        splitDetails: expense.splitDetails || {},
                        isPersonal: expense.isPersonal,
                        payerName: 'Someone' // Placeholder, will update below
                    };

                    const { session, friends, userProfile } = get();
                    const payer = friends.find(f => f.id === expense.payerId);
                    const payerName = expense.payerId === 'self' ? (userProfile.name || 'You') : (payer?.name || 'Someone');
                    newExpense.payerName = payerName;

                    if (session?.user) {
                        // ... existing logic ...

                        // Map IDs to Real UUIDs for Supabase
                        const realPayerId = mapToRealId(expense.payerId, friends, session.user.id);
                        const realSplitWith = mapIdsToReal(newExpense.splitWith, friends, session.user.id);
                        const realSplitDetails = newExpense.splitDetails ? mapSplitDetailsToReal(newExpense.splitDetails, friends, session.user.id) : {};

                        // Determine the correct payer_id for Supabase
                        // Supabase expects a profile UUID, so we must map it. 
                        // If it's the session user, it's their UUID. 
                        // If it's a friend, we need to try getting their linked real user UUID.
                        // If they don't have a linked user id (local only), payer_id must be null 
                        // and we rely on payer_name. 
                        let finalSupabasePayerId = null;
                        if (expense.payerId === 'self') {
                            finalSupabasePayerId = session.user.id;
                        } else if (payer?.linkedUserId) {
                            finalSupabasePayerId = payer.linkedUserId;
                        }

                        supabase.from('expenses').insert({
                            id: newExpense.id,
                            description: newExpense.description,
                            amount: newExpense.amount,
                            payer_id: finalSupabasePayerId,
                            payer_name: payerName,
                            group_id: newExpense.groupId,
                            date: newExpense.date,
                            category: newExpense.category,
                            split_type: newExpense.splitType,
                            split_details: realSplitDetails,
                            split_with: realSplitWith, // Persist real UUIDs
                            is_personal: newExpense.isPersonal,
                            created_by: session.user.id
                        }).then(async ({ error }) => {
                            if (error) {
                                console.error("Expense sync error details:", error);
                            } else {
                                // DUAL WRITE: Insert into expense_participants
                                // We need to convert the realSplitDetails (Map<RealUUID, Amount>) into rows
                                const participantsToInsert = [];

                                // Iterate over all participants in the split
                                const allParticipants = new Set([...realSplitWith, realPayerId]);
                                if (realPayerId === session.user.id) allParticipants.add(session.user.id);

                                for (const realId of allParticipants) {
                                    let amount = 0;

                                    // Calculate amount based on split type logic if needed, 
                                    // BUT realSplitDetails should already be fully populated by logic in AddExpenseScreen?
                                    // Actually AddExpenseScreen populates 'splitDetails' ONLY for 'unequal'.
                                    // For 'equal', we calculate it dynamically usually.
                                    // However, to store ANY value in DB, we need the number.

                                    if (newExpense.splitType === 'unequal') {
                                        amount = realSplitDetails[realId] || 0;
                                    } else {
                                        // Equal split logic: Amount / Count
                                        // participants includes self?
                                        // In AddExpense, 'splitWith' excludes self. 
                                        // 'allParticipants' here tries to include self.
                                        // Let's use the exact amounts if we can, 
                                        // but if splitDetails is empty (equal split), we calculate.
                                        const count = (newExpense.splitWith?.length || 0) + 1; // +1 for self
                                        amount = Number((newExpense.amount / count).toFixed(2));

                                        // Handle remainder? For MVP, simple division.
                                    }

                                    // Determine if Profile or Friend
                                    // 1. Is it a Profile? (Check profiles table - expensive here)
                                    // Better: We know if it's a UUID.
                                    // But we need to know if it goes into profile_id or friend_id column.
                                    // Strategy: Try looking up in `friends` array to see if it is a friend.
                                    // If strict realId is session.user.id -> Profile

                                    let pId = null;
                                    let fId = null;

                                    if (realId === session.user.id) {
                                        pId = realId;
                                    } else {
                                        // Check if this Real ID belongs to a friend
                                        // We have 'friends' in store, but they have 'id' (local) and 'linkedUserId' (real profile)
                                        // realId matches either friend.id (local-only friend) OR friend.linkedUserId (profile friend)

                                        const friendObj = friends.find(f => f.linkedUserId === realId);
                                        if (friendObj) {
                                            // It's a profile-linked friend
                                            pId = realId;
                                        } else {
                                            // It might be a purely local friend (where realId == localId)
                                            // OR it might be a profile ID that we just don't have locally linked?
                                            // Assume local friend ID if not found as linked
                                            const localFriend = friends.find(f => f.id === realId);
                                            if (localFriend) {
                                                fId = realId;
                                            } else {
                                                // If we can't find it in friends list, it might be a Profile ID from a Group Member we don't have as a friend?
                                                // Fallback to Profile ID if it looks like a valid UUID and not in friends list
                                                pId = realId;
                                            }
                                        }
                                    }

                                    participantsToInsert.push({
                                        expense_id: newExpense.id,
                                        profile_id: pId,
                                        friend_id: fId,
                                        amount: amount
                                    });
                                }

                                if (participantsToInsert.length > 0) {
                                    const { error: partError } = await supabase
                                        .from('expense_participants')
                                        .insert(participantsToInsert);
                                    if (partError) console.error("Participants sync error:", partError);
                                }
                            }
                        });
                    }

                    const updatedExpenses = [{ ...newExpense, createdBy: session?.user?.id }, ...state.expenses];
                    const { friends: newFriends, groups: newGroups } = calculateBalances(updatedExpenses, state.friends, state.groups);

                    return {
                        expenses: updatedExpenses,
                        friends: newFriends,
                        groups: newGroups
                    };
                });
            },
            deleteExpense: async (id) => {
                const { session } = get();
                const expense = get().expenses.find(e => e.id === id);
                if (!expense) return;

                // Await the DB delete FIRST so any subsequent fetchData won't re-fetch it
                if (session?.user) {
                    // Check if user is the creator
                    if (expense.createdBy && expense.createdBy !== session.user.id) {
                        console.warn("⛔ Cannot delete expense: user is not the creator.", id);
                        Alert.alert("Permission Denied", "Only the person who added this expense can delete it.");
                        return;
                    }

                    console.log('🗑️ Attempting DB delete for:', id);
                    const { error, count } = await supabase.from('expenses').delete().eq('id', id);

                    if (error) {
                        console.error("❌ Error deleting expense:", error);
                        Alert.alert("Error", "Failed to delete expense from server.");
                        return;
                    }
                    console.log(`✅ DB delete successful. Rows affected: ${count}`);
                }

                // Only update local state after DB confirms deletion
                set((state) => {
                    const remainingExpenses = state.expenses.filter(e => e.id !== id);
                    const { friends: newFriends, groups: newGroups } = calculateBalances(remainingExpenses, state.friends, state.groups);
                    return { expenses: remainingExpenses, friends: newFriends, groups: newGroups };
                });
            },

            recurringExpenses: [],
            addRecurringExpense: (expense) => set((state) => {
                const now = new Date();
                const nextDue = new Date(now);
                if (expense.frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
                if (expense.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
                if (expense.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);

                return {
                    recurringExpenses: [...state.recurringExpenses, {
                        ...expense,
                        id: Crypto.randomUUID(),
                        nextDueDate: nextDue.toISOString(),
                        active: true
                    }]
                };
            }),
            deleteRecurringExpense: (id) => set((state) => ({
                recurringExpenses: state.recurringExpenses.filter(r => r.id !== id)
            })),
            checkRecurringExpenses: () => {
                const { recurringExpenses, addExpense } = get();
                const now = new Date();
                let count = 0;
                let updated = false;

                const updatedRecurring = recurringExpenses.map(r => {
                    const nextDate = new Date(r.nextDueDate);

                    if (nextDate <= now && r.active) {
                        addExpense({
                            description: r.description,
                            amount: r.amount,
                            payerId: r.payerId,
                            groupId: r.groupId,
                            splitWith: r.splitWith,
                            splitDetails: r.splitDetails,
                            splitType: r.splitType,
                            category: r.category,
                        });
                        count++;
                        updated = true;

                        const newNextDue = new Date(nextDate);
                        if (r.frequency === 'daily') newNextDue.setDate(newNextDue.getDate() + 1);
                        if (r.frequency === 'weekly') newNextDue.setDate(newNextDue.getDate() + 7);
                        if (r.frequency === 'monthly') newNextDue.setMonth(newNextDue.getMonth() + 1);

                        return { ...r, nextDueDate: newNextDue.toISOString() };
                    }
                    return r;
                });

                if (updated) {
                    set({ recurringExpenses: updatedRecurring });
                }
                return count;
            },
            deleteFriend: (id) => {
                set((state) => {
                    // Remove friend AND all expenses that only involve this friend
                    // (keep expenses that involve other friends/groups too)
                    const remainingExpenses = state.expenses.filter(e => {
                        const isSoloPayer = e.payerId === id;
                        const isOnlySplitWith = e.splitWith?.length === 1 && e.splitWith[0] === id && !e.groupId;
                        // Remove expense only if it's exclusively between self and this friend
                        return !(isSoloPayer && isOnlySplitWith) && !(isOnlySplitWith && e.payerId === 'self');
                    });
                    const remainingFriends = state.friends.filter(f => f.id !== id);
                    const { friends: newFriends, groups: newGroups } = calculateBalances(remainingExpenses, remainingFriends, state.groups);
                    return { friends: newFriends, groups: newGroups, expenses: remainingExpenses };
                });
                const { session } = get();
                if (session?.user) {
                    supabase.from('friends').delete().eq('id', id).then(({ error }) => {
                        if (error) console.error("Error deleting friend:", error);
                    });
                }
            },
            deleteGroup: (id) => {
                // Soft delete: hide the group for the current user by appending their ID to archived_by.
                // Other members continue to see the group normally.
                set((state) => ({
                    groups: state.groups.filter(g => g.id !== id)
                }));
                const { session } = get();
                if (session?.user) {
                    // Fetch current archived_by, append current user, then update
                    supabase
                        .from('groups')
                        .select('archived_by')
                        .eq('id', id)
                        .single()
                        .then(({ data }) => {
                            const current: string[] = data?.archived_by || [];
                            if (!current.includes(session.user.id)) {
                                supabase
                                    .from('groups')
                                    .update({ archived_by: [...current, session.user.id] })
                                    .eq('id', id)
                                    .then(({ error }) => {
                                        if (error) console.error('Error archiving group:', error);
                                    });
                            }
                        });
                }
            },
            editGroup: (id, name, members) => {
                set((state) => ({
                    groups: state.groups.map(g =>
                        g.id === id ? { ...g, name, members } : g
                    )
                }));
                const { session } = get();
                if (session?.user) {
                    // Update name
                    supabase.from('groups').update({ name }).eq('id', id).then(({ error }) => {
                        if (error) console.error("Error updating group:", error);
                    });

                    // Update members (Clear and re-add for simplicity in MVP)
                    supabase.from('group_members').delete().eq('group_id', id).then(() => {
                        const memberInserts = [
                            { group_id: id, user_id: session.user.id }, // Always include self
                            ...members.filter(mId => mId !== 'self').map(mId => ({ group_id: id, user_id: mId }))
                        ];
                        // Filtering out 'self' and mapping to actual UUIDs. 
                        // Note: If friend is local, we might need a separate way to track group members 
                        // but the current schema uses profiles(id). For now, syncing what we can.
                        supabase.from('group_members').insert(memberInserts).then();
                    });
                }
            },
            subscribeToChanges: () => {
                const { session, notificationsEnabled, fetchData, formatCurrency } = get();
                if (!session?.user) return () => { };

                const channel = supabase
                    .channel('realtime-updates')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'expenses',
                        },
                        (payload) => {
                            const eventData = payload.new as any || payload.old as any;
                            console.log('🔔 Real-time Expense Event:', payload.eventType, eventData?.id);

                            if (payload.eventType === 'INSERT') {
                                const newExp = payload.new as any;
                                if (newExp.created_by !== session.user.id && notificationsEnabled) {
                                    const payer = get().friends.find(f => f.id === newExp.payer_id);
                                    const payerName = newExp.payer_name || (newExp.payer_id === session.user.id ? 'You' : (payer?.name || 'Someone'));
                                    notificationService.notifyNewExpense(payerName, newExp.description, newExp.amount.toString(), 'calculating...');
                                }
                            }

                            if (payload.eventType === 'DELETE') {
                                const deletedId = (payload.old as any)?.id;
                                if (deletedId) {
                                    console.log('🗑️ Local removal of deleted expense:', deletedId);
                                    set((state) => {
                                        const remaining = state.expenses.filter(e => e.id !== deletedId);
                                        const { friends: newFriends, groups: newGroups } = calculateBalances(remaining, state.friends, state.groups);
                                        return { expenses: remaining, friends: newFriends, groups: newGroups };
                                    });
                                }
                            }

                            // Only refresh from server for events that we can't fully handle locally
                            const isMyChange = (payload.new as any)?.created_by === session.user.id || (payload.old as any)?.created_by === session.user.id;

                            // Refresh for:
                            // 1. Any UPDATE (to get latest metadata/calculations from server)
                            // 2. INSERTs from other users
                            if (payload.eventType === 'UPDATE' || (payload.eventType === 'INSERT' && !isMyChange)) {
                                console.log('🔄 Triggering fetchData due to expense event...');
                                fetchData();
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'friends',
                        },
                        (payload) => {
                            const eventData = payload.new as any || payload.old as any;
                            console.log('🔔 Real-time Friend change:', payload.eventType, eventData?.id);

                            if (payload.eventType === 'DELETE') {
                                const deletedId = (payload.old as any)?.id;
                                if (deletedId) {
                                    console.log('🗑️ Local removal of deleted friend:', deletedId);
                                    set((state) => ({
                                        friends: state.friends.filter(f => f.id !== deletedId)
                                    }));
                                }
                            }
                            const isMyFriend = (eventData)?.user_id === session.user.id;

                            if (isMyFriend) {
                                if (payload.eventType === 'UPDATE') {
                                    const updatedData = payload.new as any;
                                    set((state) => ({
                                        friends: state.friends.map(f =>
                                            f.id === updatedData.id ? {
                                                ...f,
                                                name: updatedData.name,
                                                avatarUrl: updatedData.linked_user_id ? f.avatarUrl : updatedData.avatar_url
                                            } : f
                                        )
                                    }));
                                    // Skip fetchData for simple updates to avoid race conditions with UI
                                } else if (payload.eventType === 'INSERT') {
                                    fetchData();
                                }
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'groups',
                        },
                        (payload) => {
                            // Re-fetch when archived_by changes so the group disappears
                            // for the archiving user and stays for others
                            console.log('🔔 Real-time Group update:', (payload.new as any)?.id);
                            fetchData();
                        }
                    )
                    .subscribe((status) => {
                        console.log('📡 Real-time Subscription Status:', status);
                    });

                const activityChannel = supabase
                    .channel('activity-logs')
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'activity_logs',
                            filter: `user_id=eq.${session.user.id}`
                        },
                        (payload) => {
                            console.log('🔔 Real-time Activity Log:', payload.new);
                            set((state) => ({
                                activities: [payload.new as ActivityLog, ...state.activities]
                            }));
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(channel);
                    supabase.removeChannel(activityChannel);
                };
            },
        }),
        {
            name: 'splitty-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
