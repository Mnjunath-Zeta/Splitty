import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ThemeName, AppearanceMode, AccentName, getThemeColors, ThemeColors } from '../constants/Colors';
import { notificationService } from '../lib/NotificationService';
import * as Crypto from 'expo-crypto';

export interface Friend {
    id: string;
    name: string;
    balance: number;
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
    addFriend: (name: string) => void;
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
                set({
                    userProfile: {
                        name: meta?.full_name || meta?.name || 'New User',
                        email: session.user.email || '',
                        avatar: meta?.avatar_url || meta?.picture || '',
                        phone: session.user.phone || ''
                    }
                });

                // Fetch Profile from DB for most up-to-date info
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (!profileError && profileData) {
                    set({
                        userProfile: {
                            name: profileData.full_name || meta?.full_name || meta?.name || 'New User',
                            email: profileData.email || session.user.email || '',
                            avatar: profileData.avatar_url || meta?.avatar_url || meta?.picture || '',
                            phone: profileData.phone || ''
                        }
                    });
                }

                // Fetch Friends
                const { data: friendsData, error: friendsError } = await supabase
                    .from('friends')
                    .select('*')
                    .order('name');

                if (!friendsError && friendsData) {
                    const mappedFriends: Friend[] = friendsData.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        balance: 0 // Will be recalculated by expenses loader
                    }));
                    set({ friends: mappedFriends });
                }

                // Fetch Groups
                const { data: groupsData, error: groupsError } = await supabase
                    .from('groups')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!groupsError && groupsData) {
                    const mappedGroups: Group[] = groupsData.map((g: any) => ({
                        id: g.id,
                        name: g.name,
                        members: [], // We need to fetch members ideally, but for now empty
                        balance: 0 // logic to calc balance is complex, let's keep 0 or recalc
                    }));
                    // For members, we might need a separate query or join. 
                    // MVP: Just load groups.
                    set({ groups: mappedGroups });
                }

                // Fetch Expenses
                const { data: expensesData, error: expensesError } = await supabase
                    .from('expenses')
                    .select('*')
                    .order('date', { ascending: false });

                if (!expensesError && expensesData) {
                    const mappedExpenses: Expense[] = expensesData.map((e: any) => ({
                        id: e.id,
                        description: e.description,
                        amount: Number(e.amount),
                        payerId: e.payer_id === userId ? 'self' : e.payer_id,
                        groupId: e.group_id,
                        splitWith: [], // Logic needed
                        date: e.date,
                        splitType: e.split_type as any,
                        splitDetails: e.split_details,
                        category: e.category,
                        isSettlement: false // Logic needed
                    }));
                    console.log(`✅ fetchData complete. Loaded ${mappedExpenses.length} expenses.`);
                    set({ expenses: mappedExpenses });
                } else if (expensesError) {
                    console.error('❌ fetchData expenses error:', expensesError);
                }
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
            addFriend: (name: string) => {
                const newFriend = { id: Crypto.randomUUID(), name, balance: 0 };
                set((state) => ({
                    friends: [...state.friends, newFriend]
                }));

                const { session } = get();
                if (session?.user) {
                    supabase.from('friends').insert({
                        id: newFriend.id,
                        name: newFriend.name,
                        user_id: session.user.id
                    }).then(({ error }) => {
                        if (error) console.error("Friend sync error:", error);
                    });
                }
            },
            addGroup: (name, members) => {
                set((state) => ({
                    groups: [...state.groups, { id: Crypto.randomUUID(), name, members, balance: 0 }]
                }));
                const { session } = get();
                if (session?.user) {
                    const groupId = Crypto.randomUUID();
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

                        supabase.from('expenses').insert({
                            id: newExpense.id,
                            description: newExpense.description,
                            amount: newExpense.amount,
                            payer_id: expense.payerId === 'self' ? session.user.id : null,
                            payer_name: payerName,
                            group_id: newExpense.groupId,
                            date: newExpense.date,
                            category: newExpense.category,
                            split_type: newExpense.splitType,
                            split_details: newExpense.splitDetails,
                            created_by: session.user.id
                        }).then(({ error }) => {
                            if (error) {
                                console.error("Expense sync error details:", error);
                                console.log("Attempted payload:", {
                                    description: newExpense.description,
                                    amount: newExpense.amount,
                                    payer_id: expense.payerId === 'self' ? session.user.id : null,
                                    payer_name: payerName
                                });
                            }
                        });
                    }

                    const updatedFriends = [...state.friends];
                    const updatedGroups = [...state.groups];

                    // Determine participants (friends involved)
                    let participants: string[] = [];
                    if (expense.groupId) {
                        const group = updatedGroups.find(g => g.id === expense.groupId);
                        if (group) participants = [...group.members];
                    } else if (expense.splitWith) {
                        participants = [...expense.splitWith];
                    }

                    // Calculate amounts
                    const amounts: { [id: string]: number } = {};

                    if (expense.splitType === 'unequal' && expense.splitDetails) {
                        Object.assign(amounts, expense.splitDetails);
                    } else {
                        const totalPeople = participants.length + 1; // Friends + Self
                        const splitAmount = expense.amount / totalPeople;
                        amounts['self'] = splitAmount;
                        participants.forEach(p => amounts[p] = splitAmount);
                    }

                    if (expense.payerId === 'self') {
                        // User Paid
                        participants.forEach(friendId => {
                            const amountOwed = amounts[friendId] || 0;
                            if (amountOwed > 0) {
                                const friendIndex = updatedFriends.findIndex(f => f.id === friendId);
                                if (friendIndex !== -1) {
                                    updatedFriends[friendIndex] = {
                                        ...updatedFriends[friendIndex],
                                        balance: updatedFriends[friendIndex].balance + amountOwed
                                    };
                                }
                            }
                        });

                        if (expense.groupId) {
                            const groupIndex = updatedGroups.findIndex(g => g.id === expense.groupId);
                            if (groupIndex !== -1) {
                                const ownShare = amounts['self'] || 0;
                                updatedGroups[groupIndex] = {
                                    ...updatedGroups[groupIndex],
                                    balance: updatedGroups[groupIndex].balance + (expense.amount - ownShare)
                                };
                            }
                        }

                    } else {
                        // Friend Paid
                        const payerIndex = updatedFriends.findIndex(f => f.id === expense.payerId);
                        if (payerIndex !== -1) {
                            const myShare = amounts['self'] || 0;
                            updatedFriends[payerIndex] = {
                                ...updatedFriends[payerIndex],
                                balance: updatedFriends[payerIndex].balance - myShare
                            };

                            if (expense.groupId) {
                                const groupIndex = updatedGroups.findIndex(g => g.id === expense.groupId);
                                if (groupIndex !== -1) {
                                    updatedGroups[groupIndex].balance -= myShare;
                                }
                            }
                        }
                    }

                    return {
                        expenses: [newExpense, ...state.expenses],
                        friends: updatedFriends,
                        groups: updatedGroups
                    };
                });
            },
            deleteExpense: (id) => {
                set((state) => {
                    const { session } = get();
                    const expense = state.expenses.find(e => e.id === id);
                    if (!expense) return state;

                    const updatedFriends = [...state.friends];
                    const updatedGroups = [...state.groups];

                    let participants: string[] = [];
                    if (expense.groupId) {
                        const group = updatedGroups.find(g => g.id === expense.groupId);
                        if (group) participants = [...group.members];
                    } else if (expense.splitWith) {
                        participants = [...expense.splitWith];
                    }

                    const amounts: { [id: string]: number } = {};
                    if (expense.splitType === 'unequal' && expense.splitDetails) {
                        Object.assign(amounts, expense.splitDetails);
                    } else {
                        const totalPeople = participants.length + 1;
                        const splitAmount = expense.amount / totalPeople;
                        amounts['self'] = splitAmount;
                        participants.forEach(p => amounts[p] = splitAmount);
                    }

                    if (expense.payerId === 'self') {
                        participants.forEach(friendId => {
                            const amountOwed = amounts[friendId] || 0;
                            if (amountOwed > 0) {
                                const friendIndex = updatedFriends.findIndex(f => f.id === friendId);
                                if (friendIndex !== -1) {
                                    updatedFriends[friendIndex] = {
                                        ...updatedFriends[friendIndex],
                                        balance: updatedFriends[friendIndex].balance - amountOwed
                                    };
                                }
                            }
                        });

                        if (expense.groupId) {
                            const groupIndex = updatedGroups.findIndex(g => g.id === expense.groupId);
                            if (groupIndex !== -1) {
                                const ownShare = amounts['self'] || 0;
                                updatedGroups[groupIndex] = {
                                    ...updatedGroups[groupIndex],
                                    balance: updatedGroups[groupIndex].balance - (expense.amount - ownShare)
                                };
                            }
                        }
                    } else {
                        const payerIndex = updatedFriends.findIndex(f => f.id === expense.payerId);
                        if (payerIndex !== -1) {
                            const myShare = amounts['self'] || 0;
                            updatedFriends[payerIndex] = {
                                ...updatedFriends[payerIndex],
                                balance: updatedFriends[payerIndex].balance + myShare
                            };

                            if (expense.groupId) {
                                const groupIndex = updatedGroups.findIndex(g => g.id === expense.groupId);
                                if (groupIndex !== -1) {
                                    updatedGroups[groupIndex].balance += myShare;
                                }
                            }
                        }
                    }

                    if (session?.user) {
                        supabase.from('expenses').delete().eq('id', id).then(({ error }) => {
                            if (error) console.error("Error deleting expense:", error);
                        });
                    }

                    return {
                        expenses: state.expenses.filter(e => e.id !== id),
                        friends: updatedFriends,
                        groups: updatedGroups
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

                        supabase.from('expenses').update({
                            description: newExpenseFull.description,
                            amount: newExpenseFull.amount,
                            payer_id: updatedExpense.payerId === 'self' ? session.user.id : null,
                            payer_name: payerName,
                            group_id: newExpenseFull.groupId,
                            category: newExpenseFull.category,
                            split_type: newExpenseFull.splitType,
                            split_details: newExpenseFull.splitDetails
                        })
                            .eq('id', id)
                            .then(({ error }) => {
                                if (error) console.error("Expense edit sync error:", error);
                                fetchData(); // Refresh everything to ensure balances are correct
                            });
                    }

                    return {
                        expenses: state.expenses.map(e => e.id === id ? newExpenseFull : e)
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
                set((state) => ({
                    friends: state.friends.filter(f => f.id !== id)
                }));
                const { session } = get();
                if (session?.user) {
                    supabase.from('friends').delete().eq('id', id).then(({ error }) => {
                        if (error) console.error("Error deleting friend:", error);
                    });
                }
            },
            deleteGroup: (id) => {
                set((state) => ({
                    groups: state.groups.filter(g => g.id !== id)
                }));
                const { session } = get();
                if (session?.user) {
                    supabase.from('groups').delete().eq('id', id).then(({ error }) => {
                        if (error) console.error("Error deleting group:", error);
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
                                    set((state) => ({
                                        expenses: state.expenses.filter(e => e.id !== deletedId)
                                    }));
                                }
                            }

                            // Always refresh for any external change or DELETE
                            if (payload.eventType === 'DELETE' || (payload.new as any)?.created_by !== session.user.id) {
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
