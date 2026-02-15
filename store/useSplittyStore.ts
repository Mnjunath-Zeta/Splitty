import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
    isDarkMode: boolean;
    toggleTheme: () => void;
    currency: string;
    setCurrency: (currency: string) => void;
    getCurrencySymbol: () => string;
    formatCurrency: (amount: number) => string;
    settleUp: (payerId: string, receiverId: string, amount: number) => void;
    signOut: () => Promise<void>;
    subscribeToChanges: () => () => void;
}

export const useSplittyStore = create<SplittyState>()(
    persist(
        (set, get) => ({
            session: null,
            setSession: (session) => set({ session }),
            fetchData: async () => {
                const { session } = get();
                if (!session?.user) return;

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
                    set({ expenses: mappedExpenses });
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
            addFriend: (name: string) => set((state) => ({
                friends: [...state.friends, { id: Math.random().toString(36).substr(2, 9), name, balance: 0 }]
            })),
            addGroup: (name, members) => {
                set((state) => ({
                    groups: [...state.groups, { id: Math.random().toString(36).substr(2, 9), name, members, balance: 0 }]
                }));
                const { session } = get();
                if (session?.user) {
                    supabase.from('groups').insert({
                        name,
                        created_by: session.user.id
                    }).select().single().then(({ data, error }) => {
                        if (data) {
                            supabase.from('group_members').insert({
                                group_id: data.id,
                                user_id: session.user.id
                            }).then();
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
            isDarkMode: false,
            toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            signOut: async () => {
                await supabase.auth.signOut();
                get().clearData();
            },
            subscribeToChanges: () => {
                const channel = supabase
                    .channel('schema-db-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                        },
                        (payload) => {
                            console.log('Change received!', payload);
                            get().fetchData();
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(channel);
                };
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
                set((state) => {
                    const newExpense = {
                        ...expense,
                        id: Math.random().toString(36).substr(2, 9),
                        date: new Date().toISOString(),
                        splitType: expense.splitType || 'equal',
                        splitDetails: expense.splitDetails || {}
                    };

                    const { session } = get();
                    if (session?.user) {
                        supabase.from('expenses').insert({
                            description: newExpense.description,
                            amount: newExpense.amount,
                            payer_id: expense.payerId === 'self' ? session.user.id : expense.payerId, // If friend paid, this might fail RLS if not careful, but sticking to self for now
                            group_id: newExpense.groupId,
                            date: newExpense.date,
                            category: newExpense.category,
                            split_type: newExpense.splitType,
                            split_details: newExpense.splitDetails,
                            created_by: session.user.id
                        }).then(({ error }) => {
                            if (error) console.log("Expense sync error", error);
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

                    return {
                        expenses: state.expenses.filter(e => e.id !== id),
                        friends: updatedFriends,
                        groups: updatedGroups
                    };
                });
            },
            editExpense: (id, updatedExpense) => {
                const state = get();
                state.deleteExpense(id);
                state.addExpense(updatedExpense);
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
                        id: Math.random().toString(36).substr(2, 9),
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
            deleteFriend: (id) => set((state) => ({
                friends: state.friends.filter(f => f.id !== id)
            })),
            deleteGroup: (id) => set((state) => ({
                groups: state.groups.filter(g => g.id !== id)
            })),
            editGroup: (id, name, members) => set((state) => ({
                groups: state.groups.map(g =>
                    g.id === id ? { ...g, name, members } : g
                )
            })),
        }),
        {
            name: 'splitty-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
