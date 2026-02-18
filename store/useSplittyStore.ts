import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ThemeName, AppearanceMode, AccentName, getThemeColors, ThemeColors } from '../constants/Colors';
import { notificationService } from '../lib/NotificationService';
import * as Crypto from 'expo-crypto';

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
    groupId?: string;
    splitWith: string[]; // Friend IDs
    date: string;
    splitType?: 'equal' | 'unequal';
    splitDetails?: { [id: string]: number }; // ID -> Amount (ID can be 'self' or friendId)
    category: string;
    isSettlement?: boolean;
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
    addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
    deleteExpense: (id: string) => void;
    editExpense: (id: string, updatedExpense: Omit<Expense, 'id' | 'date'>) => void;
    addRecurringExpense: (expense: Omit<RecurringExpense, 'id' | 'nextDueDate' | 'active'>) => void;
    deleteRecurringExpense: (id: string) => void;
    checkRecurringExpenses: () => number; // Returns number of created expenses
    addFriend: (name: string, linkedUserId?: string) => void;
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
                const [profileRes, friendsRes, groupsRes, expensesRes, groupMembersRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', userId).single(),
                    supabase.from('friends').select('*').order('name'),
                    supabase.from('groups').select('*').order('created_at', { ascending: false }),
                    supabase.from('expenses').select('*').order('date', { ascending: false }),
                    supabase.from('group_members').select('*')
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
                                avatarUrl: f.linkedUserId ? avatarMap.get(f.linkedUserId) : undefined
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
                const { data: groupsData, error: groupsError } = groupsRes;
                const { data: groupMembersData, error: groupMembersError } = groupMembersRes;

                if (!groupsError && groupsData) {
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
                        const localSplitWith = (e.split_with || [])
                            .map((realId: string) => mapRealToLocal(realId))
                            .filter((id: string) => id !== 'self');

                        // Map split_details
                        const localSplitDetails: Record<string, number> = {};
                        if (e.split_details) {
                            Object.entries(e.split_details).forEach(([realId, amount]) => {
                                localSplitDetails[mapRealToLocal(realId)] = Number(amount);
                            });
                        }

                        return {
                            id: e.id,
                            description: e.description,
                            amount: Number(e.amount),
                            payerId: localPayerId,
                            groupId: e.group_id,
                            splitWith: localSplitWith,
                            date: e.date,
                            splitType: e.split_type as any,
                            splitDetails: localSplitDetails,
                            category: e.category,
                            isSettlement: false
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

                // 6. Set Final State
                set({
                    userProfile,
                    friends: balancedFriends,
                    groups: balancedGroups,
                    expenses: loadedExpenses
                });
            },
            friends: [
                { id: '1', name: 'Alwyn', balance: 450 },
                { id: '2', name: 'Manasa', balance: -329.50 },
            ],
            groups: [
                { id: 'g1', name: 'Rent & Bills', members: ['1', '2'], balance: 120.50 },
            ],
            expenses: [],
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
                                ...members.filter(mId => mId !== 'self' && mId.length > 10).map(mId => ({ group_id: groupId, user_id: mId }))
                            ];
                            supabase.from('group_members').insert(memberInserts).then();
                        }
                    });
                }
            },
            clearData: () => set(() => ({
                friends: [],
                groups: [],
                expenses: [],
                editExpense: (id, updatedExpense) => {
                    console.log('📝 editExpense called', id, updatedExpense.description);
                    set((state) => {
                        const { session, friends, userProfile, fetchData } = get();
                        const oldExpense = state.expenses.find(e => e.id === id);
                        if (!oldExpense) return state;

                        const newExpenseFull = {
                            ...updatedExpense,
                            id,
                            date: oldExpense.date,
                            splitType: updatedExpense.splitType || 'equal',
                            splitDetails: updatedExpense.splitDetails || {}
                        };

                        if (session?.user) {
                            const payer = friends.find(f => f.id === updatedExpense.payerId);
                            const payerName = updatedExpense.payerId === 'self' ? (userProfile.name || 'You') : (payer?.name || 'Someone');

                            supabase.from('expenses').update({
                                description: newExpenseFull.description,
                                amount: newExpenseFull.amount,
                                payer_id: updatedExpense.payerId === 'self' ? session.user.id : null,
                                payer_name: payerName,
                                group_id: newExpenseFull.groupId,
                                category: newExpenseFull.category,
                                split_type: newExpenseFull.splitType,
                                split_details: newExpenseFull.splitDetails,
                                split_with: newExpenseFull.splitWith
                            })
                                .eq('id', id)
                                .then(({ error }) => {
                                    if (error) console.error("Expense edit sync error:", error);
                                    // fetchData(); // Optional: Refresh if needed, but manual update should be enough
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
                recurringExpenses: [],
                session: null,
                userProfile: { name: 'Guest', email: '' }
            })),
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
                        splitDetails: expense.splitDetails || {}
                    };

                    const { session, friends, userProfile } = get();
                    if (session?.user) {
                        const payer = friends.find(f => f.id === expense.payerId);
                        const payerName = expense.payerId === 'self' ? (userProfile.name || 'You') : (payer?.name || 'Someone');

                        // Map IDs to Real UUIDs for Supabase
                        const realPayerId = mapToRealId(expense.payerId, friends, session.user.id);
                        const realSplitWith = mapIdsToReal(newExpense.splitWith, friends, session.user.id);
                        const realSplitDetails = newExpense.splitDetails ? mapSplitDetailsToReal(newExpense.splitDetails, friends, session.user.id) : {};

                        supabase.from('expenses').insert({
                            id: newExpense.id,
                            description: newExpense.description,
                            amount: newExpense.amount,
                            payer_id: realPayerId === session.user.id ? session.user.id : (realPayerId || null),
                            payer_name: payerName,
                            group_id: newExpense.groupId,
                            date: newExpense.date,
                            category: newExpense.category,
                            split_type: newExpense.splitType,
                            split_details: realSplitDetails,
                            split_with: realSplitWith, // Persist real UUIDs
                            created_by: session.user.id
                        }).then(({ error }) => {
                            if (error) {
                                console.error("Expense sync error details:", error);
                            }
                        });
                    }

                    const updatedExpenses = [...state.expenses, newExpense];
                    const { friends: newFriends, groups: newGroups } = calculateBalances(updatedExpenses, state.friends, state.groups);

                    return {
                        expenses: updatedExpenses,
                        friends: newFriends,
                        groups: newGroups
                    };
                });
            },
            deleteExpense: (id) => {
                set((state) => {
                    const { session } = get();
                    const expense = state.expenses.find(e => e.id === id);
                    if (!expense) return state;

                    if (session?.user) {
                        supabase.from('expenses').delete().eq('id', id).then(({ error }) => {
                            if (error) console.error("Error deleting expense:", error);
                        });
                    }

                    const remainingExpenses = state.expenses.filter(e => e.id !== id);
                    const { friends: newFriends, groups: newGroups } = calculateBalances(remainingExpenses, state.friends, state.groups);

                    return {
                        expenses: remainingExpenses,
                        friends: newFriends,
                        groups: newGroups
                    };
                });
            },
            editExpense: (id, updatedExpense) => {
                console.log('📝 editExpense called', id, updatedExpense.description);
                set((state) => {
                    const { session, friends, userProfile, fetchData } = get();
                    const oldExpense = state.expenses.find(e => e.id === id);
                    if (!oldExpense) return state;

                    const newExpenseFull = {
                        ...updatedExpense,
                        id,
                        date: oldExpense.date,
                        splitType: updatedExpense.splitType || 'equal',
                        splitDetails: updatedExpense.splitDetails || {}
                    };

                    if (session?.user) {
                        const payer = friends.find(f => f.id === updatedExpense.payerId);
                        const payerName = updatedExpense.payerId === 'self' ? (userProfile.name || 'You') : (payer?.name || 'Someone');

                        // Map IDs to Real UUIDs
                        const realPayerId = mapToRealId(updatedExpense.payerId, friends, session.user.id);
                        const realSplitWith = mapIdsToReal(newExpenseFull.splitWith || [], friends, session.user.id);
                        const realSplitDetails = newExpenseFull.splitDetails ? mapSplitDetailsToReal(newExpenseFull.splitDetails, friends, session.user.id) : {};

                        supabase.from('expenses').update({
                            description: newExpenseFull.description,
                            amount: newExpenseFull.amount,
                            payer_id: realPayerId === session.user.id ? session.user.id : (realPayerId || null),
                            payer_name: payerName,
                            group_id: newExpenseFull.groupId,
                            category: newExpenseFull.category,
                            split_type: newExpenseFull.splitType,
                            split_details: realSplitDetails,
                            split_with: realSplitWith
                        })
                            .eq('id', id)
                            .then(({ error }) => {
                                if (error) console.error("Expense edit sync error:", error);
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

                            // Always refresh for external changes (INSERT/UPDATE/DELETE from others, or any DELETE)
                            if (payload.eventType === 'DELETE' || payload.eventType === 'UPDATE' || (payload.new as any)?.created_by !== session.user.id) {
                                console.log('🔄 Triggering fetchData due to event...');
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
                            fetchData();
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

                return () => {
                    supabase.removeChannel(channel);
                };
            },
        }),
        {
            name: 'splitty-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
