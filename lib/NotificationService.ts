import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Request permissions and set up notification channels (Android)
     */
    public async registerForPushNotificationsAsync(): Promise<string | undefined> {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                return undefined;
            }

            // We are using local notifications for now, but we'll fetch the token
            // in case we want to implement push notifications via Supabase Edge Functions later.
            try {
                token = (await Notifications.getExpoPushTokenAsync()).data;
            } catch (e) {
                console.warn('Failed to get push token:', e);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

    /**
     * Trigger a simple local notification
     */
    public async showLocalNotification(title: string, body: string, data: any = {}) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
            },
            trigger: null, // trigger immediately
        });
    }

    /**
     * Smart Notify for Expense
     */
    public async notifyNewExpense(userName: string, expenseName: string, amount: string, share: string) {
        const title = '💰 New Shared Expense';
        const body = `${userName} added "${expenseName}" ($${amount}). Your share: $${share}`;
        await this.showLocalNotification(title, body);
    }

    /**
     * Smart Notify for Settlement
     */
    public async notifySettlement(userName: string, amount: string) {
        const title = '🤝 Settlement Received';
        const body = `${userName} settled $${amount} with you.`;
        await this.showLocalNotification(title, body);
    }
}

export const notificationService = NotificationService.getInstance();
